import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Cueloop — 영화로 영어 100번 듣기',
    permissions: ['storage', 'sidePanel', 'alarms', 'notifications'],
    host_permissions: [
      'https://*.netflix.com/*',
      // Netflix Open Connect CDN — dfxp 자막 파일이 호스팅됨.
      // background SW에서 fetch할 때 CORS 우회를 위해 필요.
      // Web Store 심사 시 자막 학습 도구 용도 명시 필요 (v0.3+에서 optional_host_permissions로 전환 검토).
      'https://*.nflxvideo.net/*',
    ],
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
