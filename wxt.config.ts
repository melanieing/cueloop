import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Cueloop — 영화로 영어 100번 듣기',
    // storage: 오버레이 ON/OFF 전역 토글 상태를 chrome.storage.local에 저장 (content script가
    // 확장 IndexedDB에 접근 못 하므로). 학습 데이터 자체는 여전히 IndexedDB(Dexie).
    permissions: ['storage', 'sidePanel', 'alarms', 'notifications'],
    // popup entrypoint는 제거됨 (action click → sidepanel로 redirect라 dead code).
    // 단 chrome.action.setBadgeText(스트릭 배지)를 쓰려면 action 필드 자체는 필요.
    // default_popup 없음 — setPanelBehavior({openPanelOnActionClick:true})로 사이드패널 토글.
    action: {
      default_title: 'Cueloop',
    },
    host_permissions: [
      'https://*.netflix.com/*',
      // Netflix Open Connect CDN — dfxp 자막 파일이 호스팅됨.
      // background SW에서 fetch할 때 CORS 우회를 위해 필요.
      // Web Store 심사 시 자막 학습 도구 용도 명시 필요 (v0.3+에서 optional_host_permissions로 전환 검토).
      'https://*.nflxvideo.net/*',
    ],
    // options_ui.open_in_tab은 entrypoints/options/index.html의 meta tag로 설정
    // (WXT가 entrypoint 자동 등록 시 여기 manifest 설정을 덮어쓰므로)
  },
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [
      tailwindcss(),
      {
        // Chrome content script UTF-8 검증기가 U+FFFF 같은 noncharacter를 거부.
        // Dexie가 IndexedDB 키 범위 sentinel로 ￿를 쓰는 게 빌드에 그대로 박혀서 로드 실패.
        // 빌드 출력 JS의 모든 비-ASCII 바이트를 \uXXXX로 강제 이스케이프. troubleshooting #7 참조.
        // esbuild charset:ascii는 WXT/Vite 중간에서 누락되는 경우가 있어 generateBundle hook으로 직접 처리.
        name: 'cueloop-ascii-only-js',
        generateBundle(_options, bundle) {
          for (const file of Object.values(bundle)) {
            if (file.type === 'chunk' && file.fileName.endsWith('.js')) {
              file.code = file.code.replace(/[-￿]/g, (c) =>
                '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
              );
            }
          }
        },
      },
    ],
  }),
});
