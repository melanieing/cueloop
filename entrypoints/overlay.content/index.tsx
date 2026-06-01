import ReactDOM from 'react-dom/client';
import { Overlay } from '@/src/overlay/Overlay';
import './style.css';

const HIDE_NETFLIX_SUBS_CSS = `
  .player-timedtext,
  .player-timedtext-text-container,
  [data-uia="player-subtitle-text"],
  [data-uia="caption"] {
    display: none !important;
  }
`;

function injectNetflixSubtitleHider(): void {
  if (document.getElementById('cueloop-hide-netflix-subs')) return;
  const style = document.createElement('style');
  style.id = 'cueloop-hide-netflix-subs';
  style.textContent = HIDE_NETFLIX_SUBS_CSS;
  document.head.appendChild(style);
  console.log('[Cueloop overlay] Netflix subtitle hider injected');
}

export default defineContentScript({
  // 모든 netflix 페이지에 로드 — Netflix는 SPA라 /browse → /watch/ 이동이
  // 클라이언트 네비게이션(history.pushState)이고 Chrome MV3는 SPA 네비게이션 시
  // content script를 재주입하지 않음. /watch/*에만 매칭하면 브라우즈에서 영상으로
  // 들어갈 때 overlay가 안 떠서 새로고침해야 함. 전체 매칭 + anchor 함수 가드로 해결.
  matches: ['https://*.netflix.com/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
    console.log('[Cueloop overlay] main() start, location=', location.href);
    injectNetflixSubtitleHider();
    try {
      const ui = await createShadowRootUi(ctx, {
        name: 'cueloop-subtitle-overlay',
        position: 'inline',
        // /watch/ 페이지일 때만 video를 anchor로 반환. autoMount의 MutationObserver가
        // SPA 진입(video 등장)을 감지해 마운트하고, /watch/를 떠나면 unmount.
        // 브라우즈 hover 미리보기 video는 /watch/ 아니라 무시됨.
        anchor: () =>
          location.pathname.startsWith('/watch/')
            ? document.querySelector('video')
            : null,
        append: 'after',
        onMount(container) {
          const video = document.querySelector('video');
          console.log('[Cueloop overlay] onMount, video=', video);
          if (!video) {
            console.warn('[Cueloop overlay] onMount but no video element found');
            return null;
          }
          const root = ReactDOM.createRoot(container);
          root.render(<Overlay video={video} />);
          console.log('[Cueloop overlay] React rendered with video element');
          return root;
        },
        onRemove(root) {
          console.log('[Cueloop overlay] onRemove triggered');
          root?.unmount();
        },
      });
      console.log('[Cueloop overlay] ui created, calling autoMount()');
      ui.autoMount();
    } catch (err) {
      console.error('[Cueloop overlay] setup CRASHED:', err);
    }
  },
});
