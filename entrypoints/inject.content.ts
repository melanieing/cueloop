interface JumpDetail {
  id: string;
  startMs: number;
}

interface NetflixPlayerLike {
  seek?: (timeMs: number) => unknown;
}

interface NetflixVideoPlayerLike {
  getAllPlayerSessionIds?: () => string[];
  getVideoPlayerBySessionId?: (sid: string) => NetflixPlayerLike | undefined;
}

function getNetflixVideoPlayer(): NetflixVideoPlayerLike | null {
  try {
    const w = window as unknown as {
      netflix?: {
        appContext?: {
          state?: {
            playerApp?: {
              getAPI?: () => { videoPlayer?: NetflixVideoPlayerLike };
            };
          };
        };
      };
    };
    return w.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer ?? null;
  } catch {
    return null;
  }
}

function netflixSeek(startMs: number): { ok: boolean; error?: string; via?: string } {
  const videoPlayer = getNetflixVideoPlayer();
  if (videoPlayer?.getAllPlayerSessionIds && videoPlayer.getVideoPlayerBySessionId) {
    try {
      const sids = videoPlayer.getAllPlayerSessionIds();
      for (const sid of sids) {
        const player = videoPlayer.getVideoPlayerBySessionId(sid);
        if (player?.seek) {
          player.seek(startMs);
          return { ok: true, via: 'netflix-player-api' };
        }
      }
    } catch (err) {
      console.warn('[Cueloop] Netflix Player API seek failed:', err);
    }
  }
  // Fallback: 직접 video element 조작 (M7375 위험 있지만 마지막 수단)
  const video = document.querySelector('video');
  if (video) {
    try {
      video.currentTime = startMs / 1000;
      void video.play().catch(() => {});
      return { ok: true, via: 'video-element-fallback' };
    } catch (err) {
      return { ok: false, error: `video.currentTime failed: ${String(err)}` };
    }
  }
  return { ok: false, error: 'no Netflix Player API and no video element' };
}

// --- Netflix manifest 자막 트랙 탐색 --------------------------------------
// Netflix는 manifest의 자막 트랙 키를 바꾼다 (2026-09: `result.timedtexttracks`
// → `result.textTracks`, 트랙 내부도 `ttDownloadables` → `downloadables`).
// 키 이름을 하드코딩하면 조용히 전부 누락되므로(에러도 안 남음), 정규식 + 깊이
// 탐색으로 찾고 ID도 여러 후보에서 고른다. ([troubleshooting #28])
const TRACK_KEY_RE = /^(?:timedtext|text)tracks$/i;
const ID_KEYS = ['movieId', 'viewableId', 'mainContentViewableId', 'contentId'];
const MAX_SCAN_DEPTH = 8;
const MAX_HITS = 2;

interface TrackHit {
  movieId: string | null;
  tracks: unknown[];
}

function scanForTracks(
  node: unknown,
  depth: number,
  inheritedId: string | null,
  out: TrackHit[],
): void {
  if (!node || typeof node !== 'object' || depth > MAX_SCAN_DEPTH || out.length >= MAX_HITS) {
    return;
  }
  const obj = node as Record<string, unknown>;

  // 자식으로 내려가기 전에 현재 레벨의 ID를 먼저 잡아 상속시킨다.
  let id = inheritedId;
  for (const key of ID_KEYS) {
    const value = obj[key];
    if (typeof value === 'string' || typeof value === 'number') {
      id = String(value);
      break;
    }
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (TRACK_KEY_RE.test(key) && Array.isArray(value) && value.length > 0) {
      out.push({ movieId: id, tracks: value });
      return;
    }
  }

  for (const key of Object.keys(obj)) {
    scanForTracks(obj[key], depth + 1, id, out);
    if (out.length >= MAX_HITS) return;
  }
}

function watchIdFromUrl(): string | null {
  const m = location.pathname.match(/^\/watch\/(\d+)/);
  return m ? m[1] : null;
}

export default defineContentScript({
  matches: ['https://*.netflix.com/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    let missWarnings = 0;
    const originalParse = JSON.parse;
    JSON.parse = function patched(
      text: string,
      reviver?: (this: unknown, key: string, value: unknown) => unknown,
    ): unknown {
      const data = originalParse(text, reviver);
      try {
        // 값싼 사전 필터 — 자막 트랙이 들어있을 수 있는 응답만 깊이 탐색한다.
        // (`texttracks`는 `timedtexttracks`의 부분 문자열이라 구/신 둘 다 걸린다.)
        if (typeof text === 'string' && text.length > 200 && /texttracks/i.test(text)) {
          const hits: TrackHit[] = [];
          scanForTracks(data, 0, null, hits);
          if (hits.length === 0 && missWarnings < 3) {
            // 조용한 실패 방지 ([troubleshooting #28]): 자막 트랙이 있을 법한
            // 응답인데 못 찾았으면 구조가 또 바뀐 것. 최상위 키를 남긴다.
            missWarnings++;
            const topKeys =
              data && typeof data === 'object' ? Object.keys(data as object).slice(0, 12) : [];
            console.warn(
              '[Cueloop] textTracks 같은 응답인데 트랙 배열을 못 찾음 — manifest 구조 변경 의심. topKeys:',
              topKeys,
            );
          }
          for (const hit of hits) {
            const movieId = hit.movieId ?? watchIdFromUrl();
            if (!movieId) continue;
            window.dispatchEvent(
              new CustomEvent('cueloop/timedtext', {
                detail: { movieId, tracks: hit.tracks },
              }),
            );
          }
        }
      } catch {
        // never break Netflix's own JSON parsing
      }
      return data;
    };
    console.log('[Cueloop] JSON.parse hijacked (MAIN world) — build: textTracks-aware v0.2.6');

    window.addEventListener('cueloop/jump', (event) => {
      const detail = (event as CustomEvent<JumpDetail>).detail;
      if (!detail?.id || typeof detail.startMs !== 'number') return;
      const result = netflixSeek(detail.startMs);
      console.log(`[Cueloop] jump via ${result.via ?? 'fail'}: ${result.ok ? 'OK' : result.error}`);
      window.dispatchEvent(
        new CustomEvent('cueloop/jump-result', {
          detail: { id: detail.id, ...result },
        }),
      );
    });
  },
});
