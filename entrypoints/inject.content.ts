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

export default defineContentScript({
  matches: ['https://*.netflix.com/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const originalParse = JSON.parse;
    JSON.parse = function patched(
      text: string,
      reviver?: (this: unknown, key: string, value: unknown) => unknown,
    ): unknown {
      const data = originalParse(text, reviver);
      try {
        const result = (data as { result?: { movieId?: unknown; timedtexttracks?: unknown } })
          ?.result;
        const movieId = result?.movieId;
        const tracks = result?.timedtexttracks;
        if (movieId != null && Array.isArray(tracks) && tracks.length > 0) {
          window.dispatchEvent(
            new CustomEvent('cueloop/timedtext', {
              detail: { movieId: String(movieId), tracks },
            }),
          );
        }
      } catch {
        // never break Netflix's own JSON parsing
      }
      return data;
    };
    console.log('[Cueloop] JSON.parse hijacked (MAIN world)');

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
