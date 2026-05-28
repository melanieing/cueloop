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

    browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      const message = msg as CueloopMessage;
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
