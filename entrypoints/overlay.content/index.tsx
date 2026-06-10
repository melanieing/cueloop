import ReactDOM from 'react-dom/client';
import { CueloopRoot } from '@/src/overlay/Overlay';
import {
  getOverlayEnabled,
  setOverlayEnabled,
  onOverlayEnabledChange,
} from '@/src/lib/overlayEnabled';
import './style.css';

// Cueloop ON/OFF 토글 버튼.
// Netflix DOM(컨트롤바)은 마우스 idle 시 사라지고 구조가 자주 바뀌어 의존하지 않는다.
// 또 우리 오버레이 안(영상 위)에 두면 Netflix 투명 클릭 레이어 아래라 클릭이 재생/정지로 새버린다.
// → 버튼을 document.body 최상위(클릭 레이어보다 위)에 fixed로 붙여 확실히 클릭되게 하고,
//    전체화면일 땐 fullscreen 요소로 re-parent해서 전체화면에서도 보이게 한다.
function setupToggleButton(ctx: { onInvalidated: (cb: () => void) => void }): void {
  let enabled = true;

  const btn = document.createElement('button');
  btn.id = 'cueloop-toggle';
  btn.type = 'button';
  // px 단위 사용 — Netflix가 html font-size를 줄여놔 rem이 작게 나오는 문제 회피.
  Object.assign(btn.style, {
    position: 'fixed',
    // 좌측 컨트롤(재생·10초뒤·10초앞·음량) 우측 빈 공간 + 컨트롤 행 높이에 맞춤.
    // body 최상위 fixed라 Netflix DOM 의존 없음. (화면 폭에 따라 미세 조정 가능)
    left: '345px',
    bottom: '44px',
    zIndex: '2147483647',
    pointerEvents: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    borderRadius: '9999px',
    border: '1px solid rgba(255,255,255,0.2)',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '15px',
    fontWeight: '700',
    whiteSpace: 'nowrap',
    lineHeight: '1',
    boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
    transition: 'opacity 0.15s',
  } as CSSStyleDeclaration);

  // 🎬 이모지 대신 우리 서비스 아이콘. 배경 밝기에 따라 변형을 바꿔 대비 확보:
  //  - ON  = 파스텔 연보라(밝은 배경) → 원본(어두운) 아이콘
  //  - OFF = 검정(어두운 배경)       → darkmode(밝은) 아이콘
  // content script가 netflix.com에서 확장 이미지를 쓰려면 web_accessible_resources 필요(wxt.config).
  const ICON_FOR_LIGHT_BG = browser.runtime.getURL('/cueloop-icon.png'); // 원본(어두운 아이콘)
  const ICON_FOR_DARK_BG = browser.runtime.getURL('/cueloop-icon-dark.png'); // darkmode(밝은 아이콘)
  const iconImg = document.createElement('img');
  iconImg.alt = '';
  Object.assign(iconImg.style, {
    height: '18px',
    width: '18px',
    objectFit: 'contain',
    display: 'block',
    flex: '0 0 auto',
    pointerEvents: 'none',
  } as CSSStyleDeclaration);
  const labelSpan = document.createElement('span');
  labelSpan.style.pointerEvents = 'none';
  btn.append(iconImg, labelSpan);

  // 컨트롤바 동기화 상태: 마우스 활동이 있으면 visible, idle이면 숨김.
  let visible = true;
  let hovering = false;

  // 좁은 너비에선 중앙 제목과 겹치고 컨트롤바 높이도 낮아지므로,
  // 라벨을 떼고 🎬 이모지만(작은 버튼) + 버튼 행에 맞춰 아래로 내린다.
  const COMPACT_WIDTH = 1241;

  function render(): void {
    const compact = window.innerWidth < COMPACT_WIDTH;
    // 컴팩트는 아이콘만, 일반은 아이콘 + "Cueloop ON/OFF" 라벨.
    labelSpan.textContent = compact ? '' : `Cueloop ${enabled ? 'ON' : 'OFF'}`;
    labelSpan.style.display = compact ? 'none' : 'inline';
    btn.style.gap = compact ? '0' : '6px';
    btn.style.padding = compact ? '7px' : '9px 16px';
    btn.style.bottom = compact ? '20px' : '44px';
    // ON = 파스텔 연보라(밝은 배경) → 어두운 글자/아이콘. OFF = 검정 → 밝은 글자/아이콘.
    btn.style.color = enabled ? '#3b0764' : 'rgba(255,255,255,0.85)';
    btn.style.background = enabled
      ? 'rgba(196,181,253,0.96)'
      : 'rgba(0,0,0,0.7)';
    btn.style.borderColor = enabled
      ? 'rgba(124,58,237,0.55)'
      : 'rgba(255,255,255,0.25)';
    const wantIcon = enabled ? ICON_FOR_LIGHT_BG : ICON_FOR_DARK_BG;
    if (iconImg.src !== wantIcon) iconImg.src = wantIcon; // 같은 src 재할당(=재로드) 방지
    btn.title = enabled
      ? 'Cueloop 켜짐 — 클릭하면 끄고 평소 넷플릭스로 (자막 직접 변경 가능)'
      : 'Cueloop 꺼짐 — 클릭하면 학습 오버레이 켜기';
    // idle이면 컨트롤바와 함께 사라짐. 버튼에 hover 중이면 유지.
    if (!visible && !hovering) {
      btn.style.opacity = '0';
      btn.style.pointerEvents = 'none';
    } else {
      btn.style.opacity = hovering ? '1' : enabled ? '0.95' : '0.7';
      btn.style.pointerEvents = 'auto';
    }
  }
  btn.addEventListener('mouseenter', () => {
    hovering = true;
    render();
  });
  btn.addEventListener('mouseleave', () => {
    hovering = false;
    render();
  });

  // Netflix 컨트롤바와 동기화: 컨트롤바 DOM에 의존하지 않고(월 1-2회 변경 위험)
  // 컨트롤바와 같은 입력(마우스 활동)에 반응 → 마우스 움직이면 표시, idle 3초 후
  // 숨김(Netflix 기본 타이밍과 동일). 결과적으로 재생바와 같이 나타났다 사라짐.
  let idleTimer = 0;
  function poke(): void {
    if (!visible) {
      visible = true;
      render();
    }
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      visible = false;
      render();
    }, 2500);
  }
  document.addEventListener('mousemove', poke, { passive: true });
  document.addEventListener('mousedown', poke, { passive: true });
  poke();

  // 너비 변경 시 compact 라벨 갱신.
  const onResize = () => render();
  window.addEventListener('resize', onResize, { passive: true });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    void setOverlayEnabled(!enabled); // onChange 구독이 enabled/표시 갱신
  });

  void getOverlayEnabled().then((v) => {
    enabled = v;
    render();
  });
  const offSub = onOverlayEnabledChange((v) => {
    enabled = v;
    render();
  });
  render();

  // /watch/ 페이지에서만 표시. 전체화면이면 fullscreen 요소에, 아니면 body에 붙임.
  function place(): void {
    const onWatch = location.pathname.startsWith('/watch/');
    if (!onWatch) {
      btn.remove();
      return;
    }
    const parent = document.fullscreenElement ?? document.body;
    if (btn.parentElement !== parent) parent.appendChild(btn);
  }

  place();
  document.addEventListener('fullscreenchange', place);
  // SPA 네비게이션(/browse ↔ /watch/) 대응 — 가벼운 1초 폴링.
  const poll = window.setInterval(place, 1000);

  ctx.onInvalidated(() => {
    window.clearInterval(poll);
    window.clearTimeout(idleTimer);
    document.removeEventListener('fullscreenchange', place);
    document.removeEventListener('mousemove', poke);
    document.removeEventListener('mousedown', poke);
    window.removeEventListener('resize', onResize);
    offSub();
    btn.remove();
  });
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
    setupToggleButton(ctx);
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
          root.render(<CueloopRoot video={video} />);
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
