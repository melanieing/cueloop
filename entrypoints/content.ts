import type { CueloopMessage } from '@/src/messages';

interface TimedtextDetail {
  movieId: string;
  tracks: unknown[];
}

interface JumpResultDetail {
  id: string;
  ok: boolean;
  error?: string;
  via?: string;
}

const seenMovies = new Set<string>();

/**
 * /watch/ 진입 후 이 시간 안에 자막이 안 들어오면 실패로 간주한다.
 * Netflix manifest 캡처 → background fetch → DB 저장까지 넉넉히 잡은 값.
 */
const HEALTH_CHECK_DELAY_MS = 20_000;

function getPageTitleForMovie(movieId: string): string | undefined {
  const pathMatch = location.pathname.match(/^\/watch\/(\d+)/);
  if (!pathMatch) return undefined;
  if (pathMatch[1] !== movieId) return undefined;
  const cleaned = document.title.replace(/\s*[-|]\s*Netflix\s*$/i, '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'netflix' || cleaned.length < 2) {
    return undefined;
  }
  return cleaned;
}

function currentMovieIdFromUrl(): string | null {
  const m = location.pathname.match(/^\/watch\/(\d+)/);
  return m ? m[1] : null;
}

function jumpInPage(startMs: number): Promise<{ ok: boolean; error?: string; via?: string }> {
  return new Promise((resolve) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    let settled = false;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<JumpResultDetail>).detail;
      if (detail?.id !== id) return;
      settled = true;
      window.removeEventListener('cueloop/jump-result', handler);
      resolve({ ok: detail.ok, error: detail.error, via: detail.via });
    };
    window.addEventListener('cueloop/jump-result', handler);
    setTimeout(() => {
      if (!settled) {
        window.removeEventListener('cueloop/jump-result', handler);
        resolve({ ok: false, error: 'jump timeout (2s)' });
      }
    }, 2000);
    window.dispatchEvent(
      new CustomEvent('cueloop/jump', { detail: { id, startMs } }),
    );
  });
}

export default defineContentScript({
  matches: ['https://*.netflix.com/*'],
  runAt: 'document_start',
  main() {
    console.log('[Cueloop] content script loaded on Netflix');

    window.addEventListener('cueloop/timedtext', (event) => {
      const detail = (event as CustomEvent<TimedtextDetail>).detail;
      if (!detail?.movieId) return;

      // 현재 /watch/{id} 페이지이고 그 id가 캡처된 movieId와 일치할 때만 ingest.
      // 브라우즈 페이지 썸네일 hover 미리보기(또는 watch 중 다른 영화 hover)는
      // URL이 다르므로 무시 → select box에 쓰레기 콘텐츠 안 들어감.
      // seenMovies에 add하지 않아서, 실제 watch 진입 시 재캡처되면 정상 ingest.
      const currentMovieId = currentMovieIdFromUrl();
      if (currentMovieId !== detail.movieId) {
        console.log(
          `[Cueloop] ignoring timedtext for ${detail.movieId} — not the current watch page (current=${currentMovieId ?? 'none'})`,
        );
        return;
      }

      if (seenMovies.has(detail.movieId)) return;
      seenMovies.add(detail.movieId);

      console.log(
        `[Cueloop] captured timedtext for movie ${detail.movieId} (${detail.tracks.length} tracks), waiting 300ms then forwarding`,
      );

      setTimeout(() => {
        const pageTitle = getPageTitleForMovie(detail.movieId);
        const msg: CueloopMessage = {
          type: 'NETFLIX_TIMEDTEXT_CAPTURED',
          payload: {
            movieId: detail.movieId,
            rawTracks: detail.tracks,
            pageTitle,
          },
        };
        browser.runtime.sendMessage(msg).catch((err: unknown) => {
          console.warn('[Cueloop] sendMessage rejected:', err);
        });
      }, 300);
    });

    // === 인제스트 헬스체크 ===
    // 조용한 실패 방지 ([troubleshooting #28]). Netflix가 manifest 구조를 바꾸면
    // 캡처 조건이 미스돼도 에러가 안 나서 3개월간 발견이 늦었다. /watch/ 진입 후
    // 일정 시간 안에 자막이 안 들어오면 background에 자가 점검을 요청한다.
    const healthScheduled = new Set<string>();

    function scheduleHealthCheck(movieId: string) {
      if (healthScheduled.has(movieId)) return;
      healthScheduled.add(movieId);
      setTimeout(() => {
        // 그새 다른 콘텐츠로 옮겼으면 판단 근거가 없으니 건너뛴다.
        if (currentMovieIdFromUrl() !== movieId) return;
        const msg: CueloopMessage = {
          type: 'INGEST_HEALTH_CHECK',
          payload: { movieId, captured: seenMovies.has(movieId) },
        };
        browser.runtime.sendMessage(msg).catch(() => {});
      }, HEALTH_CHECK_DELAY_MS);
    }

    // SPA 네비게이션은 content script를 재주입하지 않으므로 URL을 직접 관찰한다.
    let lastWatchId: string | null = null;
    function pollWatchId() {
      const id = currentMovieIdFromUrl();
      if (id === lastWatchId) return;
      lastWatchId = id;
      if (id) scheduleHealthCheck(id);
    }
    pollWatchId();
    setInterval(pollWatchId, 2000);

    browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      const message = msg as CueloopMessage;
      if (message?.type === 'GET_CURRENT_VIDEO_TIME_IN_TAB') {
        const video = document.querySelector('video');
        if (!video) {
          sendResponse({ ok: false, error: 'video element not found' });
          return false;
        }
        const timeMs = Math.floor(video.currentTime * 1000);
        sendResponse({ ok: true, timeMs });
        return false;
      }
      if (message?.type === 'JUMP_TO_LINE_IN_TAB') {
        const { expectedMovieId, startMs } = message.payload;
        const currentMovieId = currentMovieIdFromUrl();
        if (currentMovieId !== expectedMovieId) {
          sendResponse({
            ok: false,
            error: `not on /watch/${expectedMovieId} (current=${currentMovieId ?? 'none'})`,
          });
          return false;
        }
        void jumpInPage(startMs).then((result) => {
          console.log(`[Cueloop] jump (in-tab) result:`, result);
          sendResponse(result);
        });
        return true;
      }
      return false;
    });
  },
});
