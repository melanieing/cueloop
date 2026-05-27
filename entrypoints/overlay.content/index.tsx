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
  matches: ['https://*.netflix.com/watch/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
    console.log('[Cueloop overlay] main() start, location=', location.href);
    injectNetflixSubtitleHider();
    try {
      const ui = await createShadowRootUi(ctx, {
        name: 'cueloop-subtitle-overlay',
        position: 'inline',
        anchor: 'video',
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
