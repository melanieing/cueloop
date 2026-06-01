# Cueloop 트러블슈팅 로그

> 개발 중 만난 문제 + 해결 방법을 시간순으로 누적. 동일 문제 재발 시 빠르게 참조.

---

## 2026-05-26 / Day 1

### #1. WXT `init`이 비어있지 않은 디렉토리 거부

**증상**:
```
pnpm dlx wxt@latest init . -t react --pm pnpm
# ERROR  The directory /home/melan/cueloop is not empty. Aborted.
```

루트에 `CLAUDE.md`, `.gitignore`, `docs/`가 미리 있어서 막힘.

**해결**:
1. 임시 디렉토리에 스캐폴딩: `pnpm dlx wxt@latest init /tmp/cueloop-wxt-scaffold -t react --pm pnpm`
2. 필요 파일만 선별 복사 (`assets/`, `entrypoints/`, `public/`, `package.json`, `tsconfig.json`, `wxt.config.ts`)
3. **스킵한 파일**: WXT의 `.gitignore` (기존 게 더 포괄적), `README.md` (CLAUDE.md가 메인)
4. `package.json` 이름을 `wxt-react-starter` → `cueloop`, version `0.0.0` → `0.2.0`로 수정
5. 임시 디렉토리 정리

**교훈**: 기존 파일이 있는 프로젝트 루트에 WXT를 도입할 때는 임시 디렉토리 머지 패턴이 표준. WXT는 `--force` 같은 옵션을 제공하지 않음.

---

### #2. pnpm 10+가 esbuild postinstall 차단

**증상**:
```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.27.7, spawn-sync@1.0.15
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

pnpm 10+는 보안상 모든 패키지의 postinstall 스크립트를 기본 차단. esbuild는 postinstall로 플랫폼별 native binary를 설치하므로 이게 막히면 빌드 실패.

**해결**: pnpm이 자동 생성한 `pnpm-workspace.yaml`에 명시:
```yaml
allowBuilds:
  esbuild: true       # Vite 핵심, 필수
  spawn-sync: false   # fx-runner(Firefox 전용), Chrome만 쓰는 우리는 불필요
```

`pnpm install` 재실행 → esbuild postinstall 정상 실행 확인:
```
.../esbuild@0.27.7/node_modules/esbuild postinstall$ node install.js
.../esbuild@0.27.7/node_modules/esbuild postinstall: Done
```

**의존성 확인 방법**: `pnpm why <package>`로 어떤 패키지가 끌고 오는지 추적 가능.

**교훈**: 새 dependency 추가 시 pnpm이 build script 경고를 또 띄울 수 있음. 그때마다 `pnpm why`로 출처 확인 후 `allowBuilds`에 명시.

---

### #3. `@types/diff`가 deprecated

**증상**: `pnpm add -D @types/diff` 시 deprecated 경고.

**원인**: `diff` v9.0.0이 자체 타입 정의를 번들에 포함 (`libcjs/index.d.ts`, `libesm/index.d.ts`). DefinitelyTyped(`@types/diff`)는 더 이상 유지되지 않음.

**확인 방법**:
```bash
node -e "const p=require('./node_modules/diff/package.json'); console.log(p.types, JSON.stringify(p.exports?.['.']))"
```

**해결**: `pnpm remove @types/diff`. mvp-plan §10에 `@types/diff` 언급은 없으므로 잘못 추측한 게 원인. 새 패키지 추가 시 항상 해당 패키지의 `package.json`에서 `types`/`typings`/`exports.types` 확인 후 `@types/*` 필요 여부 판단.

**교훈**: 2026년에는 대부분의 활발한 npm 패키지가 자체 TS 타입을 제공. `@types/*`는 추가 전 deprecated 여부 + 본 패키지의 types 필드를 먼저 확인.

---

### #4. WXT가 `entrypoints/injected.ts`를 content script로 자동 등록 안 함

**증상**: `entrypoints/injected.ts`에 `defineContentScript({ world: 'MAIN', ... })`를 정의하고 빌드했더니 `.output/chrome-mv3/injected.js`는 생성되지만 manifest의 `content_scripts`에 **등록 안 됨**. 페이지에 주입이 안 됨.

**원인**: WXT의 content script 자동 인식은 다음 파일명 패턴만 매칭:
- `entrypoints/content.{ts,js}`
- `entrypoints/content/index.{ts,js}`
- `entrypoints/*.content.{ts,js}`
- `entrypoints/*.content/index.{ts,js}`

`injected.ts`는 패턴 외라 unlisted script로 처리됨 (번들은 생성되나 manifest 등록 X).

**해결**: `entrypoints/injected.ts` → `entrypoints/inject.content.ts`로 이름 변경. 빌드 후 manifest에 두 번째 `content_scripts` 항목(world: "MAIN")이 등록됨.

**CLAUDE.md 불일치 주의**: CLAUDE.md의 디렉토리 구조 예시에 `injected.ts`로 적혀 있는데 이는 mvp-plan 시점의 의도이고 WXT 규칙과 어긋남. 실제 파일은 `inject.content.ts`. CLAUDE.md 갱신은 사용자 판단.

**교훈**: WXT는 entrypoint를 파일명 패턴으로 자동 분류. 새 entrypoint 추가 시 WXT 공식 패턴 (https://wxt.dev/guide/essentials/entrypoints) 확인 후 작명. 빌드 후 `.output/.../manifest.json`을 직접 열어 의도대로 등록됐는지 확인 필수.

---

### #5. WXT `pnpm dev`가 WSL에서 watch 모드 유지 안 하고 즉시 종료

**증상**: WSL2 Ubuntu에서 `pnpm dev` 실행 시:
```
✔ Started dev server @ http://localhost:3000
✔ Built extension in 398 ms
WARN  Cannot open browser when using WSL. Load ".output/chrome-mv3-dev" as an unpacked extension manually
```
출력 직후 exit code 0으로 **종료**. `ps`로 확인해도 wxt/vite 프로세스 없음. HMR 작동 안 함.

**원인**: WXT 0.20은 dev 모드에서 브라우저 자동 launch를 핵심으로 가정하는데, WSL이면 launch 스킵 + 그대로 종료. `--watch`, `--no-browser` 같은 별도 플래그 없음 (`wxt --help` 확인).

**현재 우회**: Day 1 단계에서는 `pnpm build`(production 빌드)로 갈음. 코드 수정 → `pnpm build` → Chrome 확장 카드 "새로고침" 버튼으로 반영. HMR은 포기.

**로드 경로**: `\\wsl.localhost\Ubuntu\home\melan\cueloop\.output\chrome-mv3` (dev 빌드인 `chrome-mv3-dev`가 아닌 production `chrome-mv3` 사용 — dev 빌드는 reload 인프라가 끊긴 상태로 남아있어 권장 X)

**향후 검토**: `web-ext.config.ts`에 Windows Chrome 바이너리 경로(`/mnt/c/Program Files/Google/Chrome/Application/chrome.exe`) 지정해서 WXT가 WSL interop으로 launch하도록 설정 시도. 또는 `wxt build --watch` 같은 자체 watcher 조합. Day 2+ 에서 개발 빈도 따라 결정.

---

### #6. Day 3 자막 fetch — `TypeError: Failed to fetch` (CORS) → background SW + CDN host_permissions로 해결

**증상**: Netflix 영화 재생 시 chrome://extensions의 Cueloop 에러 로그:
```
[Cueloop] failed to ingest en track: TypeError: Failed to fetch
컨텍스트: https://www.netflix.com/browse
스택: content-scripts/content.js:5 (k)
```

JSON.parse hijack + timedtext capture까지는 정상, 그 다음 dfxp fetch에서 CORS 실패.

**원인**: Netflix dfxp 자막은 `*.oca.nflxvideo.net` (Netflix Open Connect CDN)에 호스팅됨. MV3에서 **content script는 일반 페이지 스크립트와 동일한 CORS 규칙 적용** → host_permissions 있어도 외부 도메인 fetch 차단. 반면 **background Service Worker는 host_permissions에 선언된 호스트에 대해 CORS 우회 가능**.

**잘못된 초기 결정**: Day 3 시작 시 mvp-plan §4의 "background fetch" 설계에서 deviation해서 content.ts에서 fetch 시도 → CORS 벽에 부딪힘. mvp-plan §4 원안이 맞았음.

**해결** (mvp-plan §4 원안 복귀):
1. `wxt.config.ts`에 CDN host_permissions 추가:
   ```ts
   host_permissions: [
     'https://*.netflix.com/*',
     'https://*.nflxvideo.net/*',  // Netflix Open Connect CDN (자막 호스팅)
   ]
   ```
2. fetch + 파싱 + 저장 로직을 **background.ts (Service Worker)로 이동**
3. content.ts는 CustomEvent → `browser.runtime.sendMessage` 메시지 forwarding만
4. background.ts에서 `ingestNetflixTracks()` 호출 → CORS 우회된 fetch 동작

**WXT API 노트**: `chrome.runtime.*` 직접 호출은 WXT 타입 정의에서 누락 → TS 에러. **`browser.runtime.*` 사용 권장** (WXT auto-import).

**Web Store 심사 고려**: CDN host_permissions 추가는 권한 범위가 넓어져서 심사 강화될 수 있음. v0.3+ Web Store 배포 시 `optional_host_permissions` + `chrome.permissions.request()` 패턴으로 전환 검토. v0.2 private build에선 그대로 OK.

**교훈**: MV3 CORS — content script와 background SW의 fetch 권한이 다름. 외부 도메인 fetch가 필요하면 무조건 background로. 추측 말고 mvp-plan 원안을 따랐어야 함.

---

### #7. Chrome content script "UTF-8로 인코딩되지 않았습니다" — Dexie의 U+FFFF noncharacter

**증상**: 확장 로드 시:
```
콘텐츠 스크립트에 파일('content-scripts/content.js')을 로드할 수 없습니다.
UTF-8로 인코딩되지 않았습니다.
매니페스트를 로드할 수 없습니다.
```

WSL `\\wsl.localhost\` 경로뿐 아니라 Windows NTFS(`C:\Users\melan\cueloop-ext`)로 복사해도 동일 에러 → 파일시스템 이슈 아님.

**초기 오진 (기록용)**: WSL 9P 프로토콜의 큰 파일 청크 읽기 이슈로 추정했으나 틀림. Day 1~2 빌드(content.js ~3kB)에선 멀쩡, Day 3 빌드(103kB)에서 발현하는 패턴 때문에 파일 크기 의심했지만 실제론 무관.

**진짜 원인** (Python으로 바이트 단위 스캔해서 확인):
- content.js에 비-ASCII 바이트 6개:
  - `0xef 0xbf 0xbf` = **U+FFFF** (Unicode noncharacter) × 3 — **Dexie 내부에서 IndexedDB 키 범위의 "최대값 sentinel"로 사용** (`` `￿` ``)
  - `0xe2 0x86 0x92` = **U+2192** `→` — 우리 에러 메시지(`fetch ${url} → HTTP ${r.status}`)에 쓴 화살표
- Chrome의 content script 로더는 **U+FFFF / U+FFFE 같은 Unicode noncharacter를 거부**. 기술적으론 유효 UTF-8이지만 Unicode 표준이 "절대 텍스트로 사용 금지"로 정의한 코드포인트.

**해결**: `wxt.config.ts`의 vite plugin에 빌드 후처리 추가 — 모든 JS 산출물의 비-ASCII 바이트를 `\uXXXX` 이스케이프 시퀀스로 변환:
```ts
{
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
}
```

런타임엔 JS 엔진이 `\uXXXX`를 정상 디코딩하므로 동작 영향 0. 파일 크기는 한국어 1글자당 3→6바이트로 약간 증가 (popup/sidepanel/options에 한국어 placeholder 있어서 ~50-100바이트 증가).

**왜 esbuild `charset: 'ascii'`만으론 안 됐는가**: 시도했지만 WXT/Vite 중간 단계에서 누락된 듯 — 빌드 후에도 non-ASCII 바이트 그대로 남음. `generateBundle` hook으로 직접 처리하는 게 확실.

**`build:win` 스크립트는 유지** — Windows Chrome에서 로드 편의용(`\\wsl.localhost\` 경로보다 NTFS가 일반적으로 안정적):
```
"build:win": "wxt build && mkdir -p /mnt/c/Users/melan/cueloop-ext && rm -rf /mnt/c/Users/melan/cueloop-ext/* && cp -r .output/chrome-mv3/* /mnt/c/Users/melan/cueloop-ext/"
```

**교훈**: Chrome content script UTF-8 검증은 엄격함. Dexie 같은 IndexedDB 라이브러리는 sentinel로 U+FFFF를 흔히 씀 → MV3 content script에서 IndexedDB 라이브러리 쓸 때 항상 ASCII-only 빌드 후처리 필요. 인코딩 에러 디버깅 시 첫 가설(파일시스템)에 매달리지 말고 **실제 파일 바이트를 직접 검사** (`python3 -c "data=open('x.js','rb').read(); print([(i,b) for i,b in enumerate(data) if b>=128][:10])"`).

---

### #8. 자막 머지 — 영어/한국어 startMs 정렬이 ±50ms로는 너무 빠듯해서 모두 unmatched

**증상**: Day 3 첫 성공 후 SW 로그:
```
[Cueloop] merged en track (0 updated, 1726 existing preserved)
[Cueloop] merged ko track (0 updated, 1726 existing preserved)
```

영어는 이미 들어가서 0 updated가 정상. 한국어는 textKo가 빈 상태인데 업데이트가 0건 → 모든 한국어 cue가 매칭 실패.

**원인**: 초기 머지 로직이 `±[0, 10, 20, 30, 40, 50]ms` 6개 지점만 검사 (`Map.get` step=10ms). Netflix 자막은 언어별 제작 단계에서 ms 단위로 미세하게 다르게 잘리는 경우가 있어서 (예: en=12345, ko=12347 → 2ms 차이) 6지점 lookup으로 다 놓침.

**해결**:
1. `Map.get` step lookup → **sortedCandidates 배열 + 이진 탐색**으로 가장 가까운 후보 찾기
2. 허용 오차 50ms → **200ms로 완화** (자막 제작 ms-level 변동 + 짧은 cue 사이 간격까지 커버)
3. unmatched 개수 로깅 추가 (`merge ko: 5/1726 cues had no match within 200ms` 같은 형태로 향후 진단)

**교훈**: cross-language alignment는 정확 매칭 불가능 가정. 항상 nearest-neighbor + tolerance 패턴. dfxp의 startMs를 그대로 Map 키로 쓰는 건 함정.

---

### #9. IndexedDB origin 분리 — content script에서 dexie 직접 쓰면 안 됨

**증상**: background SW가 1726행 저장했는데 Netflix 탭 DevTools의 IndexedDB에는 "총 항목: 0"으로 표시. SW Console 로그(`merged en track (0 updated, 1726 existing preserved)`)와 모순.

**원인**: Chrome 확장의 IndexedDB는 실행 컨텍스트 origin별로 분리됨.
- **background SW + extension pages (popup/sidepanel/options)**: `chrome-extension://[id]` origin
- **content script**: isolated world에서 돌지만 **IndexedDB는 페이지 origin에 저장** (web API는 page partition을 따름)

Day 3 초기 버전(CORS 실패 전)에 content.ts가 `import { db }` 했었음. 그때 페이지 origin(netflix.com)에 cueloop DB 스키마가 자동 생성됨. fetch가 실패해서 데이터는 안 들어갔지만 빈 스키마가 남음. 사용자가 Netflix 탭 DevTools에서 본 게 이 잔재. 진짜 데이터는 extension origin에 있음.

**해결**:
1. **content script에서 `db` 직접 import/사용 금지** — 항상 background에 메시지로 요청
2. **데이터 확인은 항상 extension origin에서** — chrome://extensions → Cueloop → Inspect views: service worker → Application → IndexedDB → cueloop
3. 페이지 origin에 남은 빈 잔재 DB는 수동 삭제 (Netflix 탭 DevTools → Application → IndexedDB → cueloop 우클릭 → Delete database). 데이터 누출 우려는 없지만 혼동 방지

**향후 규칙** (CLAUDE.md 반영 권장):
- DB 쓰기/읽기 단일 origin = extension origin
- content script → background (메시지로 요청)
- sidepanel/popup/options → 직접 dexie 가능 (extension origin)
- inject.content.ts (MAIN world) → 절대 dexie 안 씀

**교훈**: MV3 storage partitioning은 chrome.storage뿐 아니라 IndexedDB/localStorage 같은 web API에도 적용. 확장이 페이지에 주입하는 코드라도 origin이 페이지. 데이터 분리 정책 반드시 문서화.

---

### #10. 한국어 머지 — multi-cue match로 일부만 업데이트 (Day 4에서 개선 예정)

**증상** (Day 3 후속): `[Cueloop] merged ko track (18 updated, 1726 existing preserved)` — 매칭된 1474건 중 18건만 textKo 채워짐.

**의심 원인**: 영어 cue 1726개 vs 한국어 cue 1563개로 cue 수가 다름. 영어는 노이즈 표현(`[door slams]`)까지 자막 처리해서 보통 더 많고 잘게 쪼개짐. 여러 한국어 cue가 같은 영어 라인에 binary-search nearest로 매칭되면 **마지막 cue가 이전 매칭을 덮어씀**. 그러면 두 번째 매칭부터는 match.textKo가 이미 이전 cue.text와 같아서 patch가 비어 update 안 됨. 18건은 cue 텍스트가 정말 달라서 패치된 경우.

**임시 상태**: 18행이라도 textKo 들어가서 한국어 자막 기능 자체는 동작. Day 4 사이드패널 UI에서 실제 매칭 패턴 보면서 알고리즘 개선:
- 한 영어 라인에 여러 한국어 cue 매칭 시 합쳐서 저장 (`text1\ntext2`)
- 또는 한국어 cue별 유일 매칭 보장 (matched 영어 라인 제외)
- 또는 양방향 매칭 (영어 cue도 한국어 라인에 추가)

Day 4에서 머지 결정 미루기로. v0.2 검증 지표 #8(자막 편집 효과)에서 영향 있으면 우선순위 올림.

---

### #11. DevTools Application 탭이 extension origin IndexedDB를 enumerate 못 함 (Chromium 버그)

**증상**: chrome-extension:// origin인 SW DevTools, Options/Sidepanel/Popup DevTools 모두 Application → IndexedDB에 `"indexedDB가 감지되지 않음"` 표시. 데이터는 분명히 있는데 UI에 안 뜸.

**검증**: 같은 SW Console에서 `indexedDB.databases().then(console.log)` → `[{name: 'cueloop', version: 10}]` 정상 반환. `indexedDB.open('cueloop')`로 count 쿼리 → 1779행 확인. JS API는 작동, DevTools UI만 enumerate 실패.

**원인**: Chrome DevTools의 Application 패널 IDB 섹션이 `IndexedDB.requestDatabaseNames` CDP를 호출하는데, chrome-extension:// origin에선 빈 응답 반환. Chromium의 storage partition 구현과 DevTools 백엔드 결합 이슈로 수년간 알려진 버그. 일반 web origin(`https://...`)에선 정상.

**우회 방법** (영향도 순):
1. **`chrome://indexeddb-internals/`** — Chrome 내부 IDB inspector. 시스템 전체 IDB 목록 + origin + store별 entry 수. 가장 확실
2. **DevTools Console에서 JS로 쿼리**: `indexedDB.databases()`, `indexedDB.open('cueloop')`, `transaction().objectStore().count()`
3. **확장 자체 UI 만들어서 데이터 보기** — Cueloop의 경우 Day 4 사이드패널 UI가 이 역할

**교훈**: extension origin IndexedDB 디버깅은 DevTools에 의존하지 말 것. 처음부터 자체 UI(또는 chrome://indexeddb-internals)로 검증 흐름 세팅.

---

### #12. Dexie 자동 version bump (`version: 10` 관찰)

**증상**: `this.version(1).stores({...})`로 선언했는데 `indexedDB.databases()` 결과는 `version: 10`.

**원인 추정**: Day 2~3 사이 우리가 db.ts schema를 여러 번 수정함 (Line에 source/editedAt 추가, customLoops 테이블 추가, lib path 변경 등). Dexie 4.x는 schema 변경을 감지하면 내부적으로 IDB version을 자동 bump (각 reload마다 +1). dev 단계라 마이그레이션 코드 없이도 무난히 동작했지만, 프로덕션이면 사용자 데이터 손실 위험.

**현재 상태**: 데이터 정합성 영향 없음. 1779행 다 정상 query 가능.

**해야 할 것 (Day 13~14에서)**: schema가 stable해지면 `version(1).stores({finalSchema})` 단일 선언으로 고정. 이후 schema 변경 시 명시적 `version(2).upgrade(tx => ...)` 패턴으로 마이그레이션 보장.

---

### #13. 콘텐츠 표시명이 movieId 숫자라 UX 약함 (메타데이터 미구현)

**증상**: Day 4 사이드패널 헤더 드롭다운에 `Netflix 80184100 (netflix)` 같은 의미 없는 숫자 표시. 사용자가 같은 시리즈의 다른 에피소드를 본 경우 둘 다 "Netflix 80XXXXXX"로만 표시되어 어떤 에피소드인지 식별 불가.

**원인**: Day 3 `netflix-subtitles.ts::ensureContent`가 title을 `` `Netflix ${movieId}` `` placeholder로 채움. Content schema의 `seriesTitle`, `season`, `episode`는 그대로 undefined. `NetflixAdapter.getContentMetadata()`는 throw 스켈레톤 (Day 3에서 채울 예정이었으나 fetch flow에 집중하느라 미루어짐).

**해결책 (Chunk C 후속)**:
1. `inject.content.ts`의 JSON.parse hijack에서 timedtexttracks 외의 메타데이터 필드도 같이 캡처 (Netflix 응답에 title/series 정보가 같이 오는 경우)
2. 없으면 DOM 폴백: `document.title`, `[data-uia="video-title"]`, `[data-uia="video-canvas"] [data-uia^="title"]` 등
3. `Content.title`, `seriesTitle`, `season`, `episode` 필드 업데이트
4. 사이드패널 드롭다운: `"시리즈제목 S1E2 - 에피소드제목"` 형태로 표시

**현재 상태**: 데이터 모델은 정상 (각 에피소드별 독립 Content + 자막), 표시만 약함. 학습 흐름엔 영향 없음.

**우선순위**: Chunk C 끝나고 별도 "Day 4.5" 작업으로 처리. 또는 늦으면 mvp-plan §6 Day 13 어댑터 정리 때.

---

### #14. Netflix M7375 에러 — `video.currentTime` 직접 조작 시 DRM 충돌

**증상**: 사이드패널의 jump-to-line 클릭 → 콘텐츠 영역에 `서비스 이용에 불편을 드려 죄송합니다 / 오류 코드: M7375` 표시. 영상 재생 중단.

**원인**: content script에서 `document.querySelector('video').currentTime = X`로 직접 seek 시 Netflix DRM 매니페스트 검증과 충돌. Netflix가 비정상 seek로 감지 → manifest 재요청 시도 → 일부 케이스에서 M7375 playback error. video element 직접 manipulation은 Netflix가 라이센스 검증을 다시 트리거하는 경로라 위험.

**해결**: **Netflix Player API**를 통한 seek 사용. MAIN world(`inject.content.ts`)에서만 접근 가능:
```ts
const videoPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
const sessionIds = videoPlayer?.getAllPlayerSessionIds?.() ?? [];
for (const sid of sessionIds) {
  const player = videoPlayer.getVideoPlayerBySessionId(sid);
  player?.seek(startMs); // ms 단위, DRM과 정상 협상
}
```

**아키텍처 변경**:
```
sidepanel click
  → background (tabs.query, 메시지 forwarding)
  → content.ts (isolated): JUMP_TO_LINE_IN_TAB 수신 → CustomEvent 'cueloop/jump' 발행
  → inject.content.ts (MAIN world): netflix Player API .seek() → CustomEvent 'cueloop/jump-result' 응답
  → content.ts: sendResponse → background → sidepanel
```

isolated world에선 `window.netflix` 객체 보이지 않음 (페이지 전역). MAIN world의 inject script만 접근 가능. CustomEvent로 두 world 사이 통신.

**Fallback**: Player API 못 찾으면 `video.currentTime` 직접 조작 (M7375 위험 알면서 마지막 수단). 우리 빌드에 fallback 코드 남아있지만 일반 케이스엔 안 실행.

**향후 위험**: Netflix가 Player API 경로(`netflix.appContext.state.playerApp...`) 바꾸면 깨짐. CLAUDE.md 함정 #3과 같은 원리. 진단 방법: Netflix 페이지 Console에서 `console.log(Object.keys(netflix?.appContext?.state ?? {}))`.

**교훈**: DRM 보호된 video element는 절대 직접 manipulation 안 함. 항상 플랫폼 자체 player API 경유. v0.3에서 다른 플랫폼(Coupang Play, Disney+) 어댑터 추가 시 동일 원칙 적용.

**재발 (2026-05-26 Day 6 Chunk G)**: A-B 반복 코드에서 `video.currentTime = ...` 두 번 사용 → 즉시 M7375 + `onRemove triggered` (Netflix가 video element 재생성). Overlay.tsx의 toggleRepeat과 rAF loop의 endMs reset 두 군데. **fix**: 동일 `cueloop/jump` CustomEvent 채널 재활용. 반복 reset이 빈번하므로 `lastSeekAtRef` + 250ms cooldown 가드 추가 (seek 직후 다음 reset/해제 판정 잠시 보류). 다른 비디오 제어 코드 추가 시 항상 `netflixSeek()` 헬퍼 사용 — `video.currentTime`에 절대 직접 쓰지 말 것.

---

### #15. 사이드패널이 active 탭을 따라가야 — `chrome.tabs.onActivated/onUpdated` + broadcast 패턴

**증상**: 사용자가 Netflix에서 영화 A 보고 있는데 사이드패널은 영화 B 자막 표시. 자막 편집/jump가 잘못된 콘텐츠에 적용됨.

**원인**: Day 4 Chunk A에서 사이드패널이 "가장 최근 추가된 콘텐츠"를 디폴트로 표시하는 단순화 적용. mvp-plan §6 Day 4가 명시한 "현재 활성 탭의 contentId 확인"을 미룬 게 근원. 결과: Netflix 탭 전환해도 사이드패널 갱신 안 됨.

**해결 패턴** (Chrome MV3 cross-context):
1. **background SW**: `chrome.tabs.onActivated` + `chrome.tabs.onUpdated` listener → 활성 Netflix watch 탭의 movieId 추출 → DB 조회 → `ACTIVE_CONTENT_CHANGED` 메시지를 `chrome.runtime.sendMessage`로 broadcast
2. **sidepanel**: `useActiveTabContent` 훅으로 mount 시 `QUERY_ACTIVE_CONTENT` 1회 + broadcast listener 등록
3. **manual 선택 우선**: 사용자가 드롭다운으로 다른 영상 선택 시 `manualSelectedId` state. 단 active와 같은 ID 선택 시는 manual 모드 진입 안 함 (자동 연동 유지)

**Chrome 권한**: `tabs.query({active: true, currentWindow: true})`와 `tabs.query({url: 'https://*.netflix.com/watch/*'})`는 `host_permissions: 'https://*.netflix.com/*'`만으로 작동 (`tabs` 권한 별도 불필요). 단 다른 탭의 URL을 보려면 그 도메인의 host_permissions 필요.

**MV3 SW 종료 대비**: SW는 idle 시 종료되므로 background에 글로벌 변수로 active state 캐시 X. 매번 `chrome.tabs.query`로 즉시 조회.

**교훈**: extension은 multi-context (background SW / sidepanel page / content script). UI가 다른 context의 데이터를 봐야 할 때는 단순 dexie liveQuery로 부족. message broadcast 패턴 필수. Dexie의 cross-context observable이 SW↔page 사이에선 보장 안 됨 ([troubleshooting #11](.) 관련).

---

### #16. WXT `createShadowRootUi` onMount 3번째 인자는 anchor가 아니라 shadowHost

**증상**: Day 5 듀얼 자막 오버레이 구현 시 컴포넌트가 마운트는 됐는데 화면에 안 보임. 페이지 콘솔 로그:
```
[Cueloop overlay] onMount triggered. anchor= <cueloop-subtitle-overlay>...
```
3번째 인자에 우리가 만든 shadow host custom element가 들어옴. video element가 아님.

**오해**: `anchor: 'video'` 옵션과 `onMount(container, shadow, anchor)` 시그니처를 보고 3번째 인자가 anchor(즉 video)일 거라 가정. TypeScript는 시그니처 검증 안 함 (any 또는 HTMLElement).

**실제 WXT 0.20 시그니처**:
```ts
onMount(uiContainer, shadow, shadowHost) => TMounted
```
3번째는 **shadowHost** (UI를 감싸는 우리 custom element). anchor 옵션은 mount 위치만 결정, element reference는 전달 안 함.

**원인 추가 영향**:
- video로 잘못 받은 shadow host를 `Overlay` 컴포넌트에 prop으로 넘김 → `video.currentTime` 접근 시 undefined → NaN → rAF loop가 cue 매칭 못함 → currentLine null
- `lines.length === 0`이면 null 리턴 → 마운트 자체 검증 신호도 없음 (사용자에게 "안 보임" 으로만 보임)

**해결**:
```ts
onMount(container) {
  const video = document.querySelector('video');  // 직접 구함
  if (!video) return null;
  const root = ReactDOM.createRoot(container);
  root.render(<Overlay video={video} />);
  return root;
}
```
+ `lines.length === 0`이어도 디버그 표시 렌더 (마운트 시각 검증)

**교훈**: third-party API 시그니처는 매개변수 이름 가정 X. 첫 통합 시 실제 값을 `console.log`로 dump해서 확인. WXT 같은 작은 함수에도 적용. troubleshooting #14의 Netflix Player API path 가정 회피 교훈과 동일 원칙.

---

### #17. 사이드패널 사용자 편집이 오버레이에 반영 안 됨 — broadcast 누락 + currentLine state 갱신 누락

**증상**: 사용자가 사이드패널에서 #57 라인 textEn을 합쳐서 수정했는데 오버레이는 옛 textEn 표시. 사이드패널과 오버레이 표시가 불일치.

**원인 두 가지**:

1. **broadcast 누락**: `CONTENTS_UPDATED` 메시지가 background SW의 자막 ingest 완료 시에만 발행됨. 사이드패널의 `db.lines.update/delete/add` 호출 시엔 broadcast 안 함. → 오버레이가 옛 lines 캐시 그대로 사용.
2. **lineId 동일 시 setState 안 함**: 오버레이 rAF tick이 `if (lineId !== lastLineId) setCurrentLine(line)`로 성능 최적화. 사용자가 텍스트만 수정하면 같은 lineId의 새 객체 → setState 호출 안 됨 → React가 옛 line 객체로 렌더.

**해결**:
1. `src/lib/broadcastUpdate.ts` 신규 — `broadcastContentUpdate(contentId)` 헬퍼. `chrome.runtime.sendMessage`로 CONTENTS_UPDATED 발행. sender 자신은 안 받으므로 sidepanel은 자체 dexie liveQuery로 동기화, overlay만 fetch 트리거.
2. 사이드패널의 3개 변경 지점에서 헬퍼 호출: `LineRow.save`, `LineRow.remove`, `InsertLineModal.save`
3. 오버레이 `loadLines()`에서 lines refetch 후 즉시 `findCurrentLine` + `setCurrentLine` 명시 호출 (lineId 비교 무시). `lastLineIdRef`도 갱신해서 rAF tick과 일관.
4. 반복 중이던 라인이 편집/삭제됐을 경우 `repeatingLineRef`도 갱신 또는 해제.

**규칙 (CLAUDE.md 추가 검토)**:
- IDB write 직후 항상 `broadcastContentUpdate()` 호출 — sidepanel/popup/options 모든 extension page에서
- 새로 추가되는 cross-context 데이터 의존 UI도 같은 broadcast handler 등록 패턴 따를 것

**교훈**: 같은 origin이라도 Chrome extension은 context별 module instance가 분리됨. dexie observable이 cross-context broadcast 자동 안 함. 모든 IDB write 후 명시적 broadcast 필수. 이미 [troubleshooting #11], [#15]에서 같은 원칙 경고했으나 새 변경 지점마다 까먹기 쉬움 → 헬퍼 함수로 강제.

---

### #18. Chrome MV3 — `runtime.sendMessage`는 extension page → content script로 도달 안 함. background 경유 필수

**증상** (Chunk G 후속): sidepanel에서 `broadcastContentUpdate()` 호출 → 콘솔에 `[broadcast] CONTENTS_UPDATED ... delivered, response: undefined` 정상 발송. 그런데 overlay(content script) 페이지 콘솔엔 `received CONTENTS_UPDATED` 로그가 **전혀 안 뜸**. listener 호출조차 안 됨.

**원인**: Chrome MV3의 메시지 라우팅 규칙.
| sender | receiver | `runtime.sendMessage` 도달? |
|---|---|---|
| extension page → extension page (popup/sidepanel/options) | ✅ |
| extension page → background SW | ✅ |
| **extension page → content script** | ❌ |
| content script → background/extension page | ✅ |
| **background → content script** | ❌ (`chrome.tabs.sendMessage` 필요) |

content script에 메시지 보내려면 항상 `chrome.tabs.sendMessage(tabId, msg)` 사용. background가 라우터 역할 해야 함.

**오랫동안 숨어있었던 이유**: background ingest 후 CONTENTS_UPDATED를 broadcast했을 때도 overlay는 사실 못 받았음. 다만 새 영화 ingest 직후 사용자가 overlay mount → overlay가 자체적으로 `GET_LINES_FOR_MOVIE` 호출 → 자막 보임. 이 우연 때문에 broadcast 실패가 가려짐.

**해결**: background에 `forwardToWatchTabs(msg)` 헬퍼 추가.
- background의 onMessage handler에 `CONTENTS_UPDATED` 케이스 추가 → 받으면 모든 netflix watch 탭에 `tabs.sendMessage`로 forward
- background 자체 ingest 후에도 forward 호출 (runtime.sendMessage로 sidepanel 알림 + forwardToWatchTabs로 overlay 알림)

```
sidepanel 편집 
  → broadcastContentUpdate() 
  → runtime.sendMessage(CONTENTS_UPDATED) 
  → background SW 받음
  → tabs.query('netflix.com/watch/*') → 각 탭에 tabs.sendMessage
  → overlay listener 호출 → loadLines() refetch
```

**향후 규칙**: cross-context 메시지 설계 시
- "어느 sender → 어느 receiver"를 위 표로 항상 확인
- content script가 receiver면 background 경유 필수
- 새 alert 타입 추가 시 background.ts에도 forward 핸들러 추가 잊지 말 것

**교훈**: 메시지 보낸다고 다 받는 게 아님. Chrome MV3의 IPC 규칙은 비대칭. 첫 통합 시 양쪽에 로그 박아서 listener 호출 여부 검증 필수. "broadcast가 발송됐는데 안 됨"이면 항상 라우팅 규칙 의심.

---

### #19. 사이드패널 자동 스크롤 — 가상화 측정 race condition + EditRow reflow freeze

**증상 사슬** (Day 7 Chunk K 진행 중 단계별로 발견):
1. resume 버튼 클릭해도 스크롤 안 됨 (`scrollTop`이 영원히 0)
2. 박스가 위아래로 겹치거나 사이에 큰 빈 공간
3. 처음 영상 재생 시 자동 스크롤이 발화되지 않음 (한 번 클릭/resume 해야 시작)
4. 현재 라인 편집 클릭 시 브라우저 전체 freeze (수백 ms~수 초)

**근본 원인 사슬**:
1. **잘못된 스크롤 컨테이너**: 사이드패널 최상위 `min-h-screen` → 콘텐츠가 viewport보다 길어지면 컨테이너 자체가 늘어나서 **document가 스크롤**됨. `flex-1 overflow-auto`로 의도한 안쪽 div는 실제 스크롤 컨테이너가 아니라 `scrollTop=0` 유지. virtualizer/`scrollTo` 모두 무효. → `h-screen overflow-hidden`으로 100vh 고정해야 안쪽 div가 진짜 컨테이너가 됨.
2. **react-virtual measureElement race condition**: 진짜 스크롤 컨테이너가 잡힌 뒤엔 virtualizer가 본격 작동했지만, `broadcastContentUpdate`로 `lines` 배열이 새 ref로 자주 refetch되며 virtualizer 측정 캐시가 reset/race → 어떤 라인은 estimateSize로 placed된 그대로, 다른 라인은 실측으로 placed → 겹침/빈공간.
3. **useEffect dep에 `scrollEl` 누락**: 첫 진입 시 `currentLineId`가 `scrollEl` 콜백 ref 셋업보다 먼저 도착 → effect는 `scrollEl=null`로 fire되어 무효, 이후 scrollEl이 set되어도 dep에 없어서 re-fire 안 됨.
4. **자연 flow에서 EditRow mount의 reflow 폭증**: 가상화 제거 후 1486 라인을 자연 flow로 렌더했더니, 한 라인이 ReadOnlyRow(~80px) → EditRow(~280px)로 mount되면서 그 아래 형제 박스 전부의 layout 재계산 → 메인 스레드 freeze. 더해서 `textarea.autofocus`가 native scroll을 일으켜 자동 scrollIntoView와 한 frame에서 충돌, freeze 심화.

**해결**:
1. 최상위 `min-h-screen` → `h-screen overflow-hidden`. 안쪽 `flex-1 overflow-auto`가 실제 스크롤 컨테이너로 작동.
2. **`@tanstack/react-virtual` 제거**. 가상화 대신 1486개 div 자연 flow + 각 wrapper에 `content-visibility: auto; contain-intrinsic-size: auto 100px` 적용. viewport 밖 박스는 layout/render skip → reflow 영향 박스가 5~10개로 축소 (1486→~7 대략 200배 개선). 측정 race 자체가 없음. scrollIntoView 호출 시 해당 박스는 자동으로 layout 계산되어 정확.
3. 자동 스크롤 useEffect의 dep에 `scrollEl` 추가 + `data-line-id`로 라인 찾아 `scrollIntoView({block:'center'})`.
4. **자동 pause/감지 로직 전부 제거**. 대신 헤더에 `📌 자동 스크롤 ON/OFF` 명시적 토글 + 토글 OFF일 때만 "📺 현재 라인으로 ↓" 점프 버튼 노출. 편집 시작 시 토글 자동 OFF + `editingLineId != null`이면 scrollIntoView skip. `textarea.focus({preventScroll:true})`로 native scroll-on-focus 차단.
5. `LineRow` `React.memo` + custom compare (listenCount/isMemorized/isCurrent/isEditing만 비교) — `lines` ref 변경 시 변경된 라인만 re-render.

**교훈**:
- **가상화는 동적 크기에서 측정 race가 잘 생긴다**. 라인 수가 천 단위면 `content-visibility: auto`가 더 단순하고 견고한 대안. 라이브러리 의존성 1개 줄어듦.
- **스크롤 컨테이너는 명시적으로 100vh 고정**. `min-h-screen`은 outer scroll로 빠짐 (콘텐츠가 길면). `h-screen + overflow-hidden + 자식 flex-1 overflow-auto`가 견고한 패턴.
- **자동 동작은 edge case 폭증의 원인**. "사용자 휠 감지 → 자동 pause → 자동 resume" 같은 흐름은 모든 조합을 잡아야 함. **명시적 토글이 단순하고 예측 가능**. UX 단순화 == 코드 단순화.
- **동적 height 변경은 viewport 안 일부만 reflow에 영향**받게 격리해야 함. `content-visibility: auto`가 이 격리의 표준 메커니즘.
- useEffect dep에 비동기로 set되는 ref-state(callback ref → setState)는 반드시 포함. 누락 시 race condition으로 "처음 한 번 안 됨" 패턴 발생.

---

### #20. WXT 0.20 build prepare — background entrypoint module top-level의 `browser.alarms` listener와 IIFE가 unhandled rejection 유발

**증상** (Day 11~12 Chunk Q 진행 중): 사이드패널 자동 스크롤 변경, popup 신설, streak 로직 추가 시점에 `pnpm build`가 `Preparing...` 직후 stack trace 없이 다음 메시지로 죽음:
```
UnhandledPromiseRejection: ... reason "[object Object]"
   at throwUnhandledRejectionsMode (node:internal/process/promises:392:7)
```
- `pnpm tsc --noEmit`는 깨끗하게 통과 (TypeScript error 아님)
- `wxt build --debug`도 같은 메시지만 출력, 추가 정보 없음
- `.wxt`/`.output` 디렉토리 clean 후에도 재현
- stub 코드는 OK, 실제 코드는 fail — 한 줄씩 격리하여 진단

**근본 원인** (긴 격리 끝에 발견된 두 가지):

1. **background.ts의 module top-level에 `browser.alarms.onAlarm.addListener(...)` 또는 async IIFE 호출**.
   - WXT가 background entrypoint를 prepare 단계에 분석할 때, `defineBackground(() => {...})` 콜백 외부의 top-level chrome.* API 호출이 unhandled rejection을 일으킴.
   - 동일 코드를 `defineBackground` 콜백 안으로 옮기면 즉시 빌드 통과.

2. **`db.streak.get/put`을 호출하는 함수를 lib 파일(`src/lib/streak.ts` 등)에서 export하고 background 등 다른 entrypoint에서 import**.
   - 동일 코드를 background.ts 안에 inline으로 두거나, `dailyGoal.ts` 같은 *기존* lib 파일에 통합하면 일부 케이스 OK.
   - 단, lib 파일에서 export하고 cross-entrypoint import 시 항상 fail.
   - 원인 미상 (Vite chunk graph + WXT prepare 상호작용 추정).

**해결**:
1. `browser.alarms.create` + `onAlarm.addListener` + 시작 시 IIFE를 모두 `export default defineBackground(() => { ... })` 콜백 *내부*로 이동.
2. streak 로직을 별도 lib 파일 없이 **background.ts와 popup/App.tsx에 각각 inline** 정의. `db.streak` 테이블은 사용 안 하고 `db.settings`의 `__streak__` key에 Streak 객체 저장 (key-value 형태). `Streak` interface는 그대로 재사용.
3. `Setting.value: unknown` 타입이라 `value as Streak` 캐스팅으로 복원.

**추가 진단 단서**: WXT prepare가 어떤 비동기 작업의 reject를 catch 안 하고 unhandled로 흘려보내는 게 본질적 bug. 향후 WXT 버전 업 시 lib 분리 재시도 가능.

**교훈**:
- WXT background entrypoint에서 chrome.* API listener/호출은 **반드시 `defineBackground` 콜백 내부**에. top-level 부작용은 WXT 빌드 파이프라인이 잘 못 처리함.
- WXT 빌드가 "[object Object]" unhandled rejection으로 죽으면: ① TypeScript error 없는지 확인, ② 최근 추가한 lib 파일의 cross-entrypoint import 격리, ③ background top-level의 부작용 격리 — 세 가지 의심.
- 빌드 파이프라인에 ESLint `react-hooks/rules-of-hooks` 통합 미루어둠 → 가끔 Hook rule 위반이 빌드는 통과하고 런타임에서 발견됨 (Chunk L의 early-return 뒤 useMemo 사례). Day 13~14 cleanup 후보.

---

### #21. Chrome MV3 extension options page에서 `window.confirm()` silent fail

**증상** (Day 14 Chunk S 백업 import 진행 중): `<input type="file">` onChange에서 `window.confirm("복원 확인...")` 호출했는데:
- 파일 선택 후 confirm dialog가 **뜨지 않음**
- import 함수도 호출 안 됨 (confirm이 false 반환한 것처럼 동작)
- 콘솔에 에러 없음
- 사용자 입장에선 "버튼 눌렀는데 아무 반응 없음"

**원인**: Chrome MV3 extension의 options page (HTML 페이지)에서 `window.confirm`/`alert`/`prompt` 같은 native modal dialog가 정책상 차단되거나 silent fail되는 케이스. Sidepanel/popup 같은 다른 extension UI에선 동작하기도 해서 일관성 없음. 페이지 user gesture context에서 직접 호출해도 확실히 떴다 안 떴다 함.

**해결**: native dialog 완전 제거. **in-page React 모달**로 교체.
- 파일 선택 → state로 `pendingImportFile` 저장만
- 조건부로 fixed/overlay 모달 렌더 (다크 테마, [취소] / [복원 실행] 두 버튼)
- 확인 클릭 시 실제 import 함수 호출

**교훈**:
- extension UI에서 native dialog (`confirm`/`alert`/`prompt`)는 신뢰하지 말 것. 빌드해놓고 동작 의존하지 말고, 처음부터 in-page modal 패턴 사용.
- UX 일관성 측면에서도 in-page modal이 더 나음 (다크 테마, 커스텀 버튼 라벨, 위험 액션 시각 강조 등).

---

### #22. WXT options entrypoint가 wxt.config.ts의 manifest 설정을 덮어쓴다 (`open_in_tab`)

**증상**: 옵션 페이지가 `chrome://extensions?options=...` 형태의 **모달**로만 열려서 가로 폭이 Chrome이 강제하는 ~600px에 고정. Tailwind `max-w-4xl` 적용 안 됨. 사용자가 옵션 페이지를 읽기 불편.

**1차 시도 (실패)**: `wxt.config.ts`의 `manifest.options_ui.open_in_tab: true` 추가 → 빌드 후 `manifest.json` 직접 열어 확인하니 `"options_ui":{"open_in_tab":false,...}`로 **WXT가 false로 override**해서 효과 없음.

**원인**: WXT 0.20이 `entrypoints/options/index.html`을 자동 인식해서 options entrypoint로 등록할 때, 자체 default(`open_in_tab: false`)로 manifest를 생성. wxt.config.ts의 `manifest.options_ui` 설정은 entrypoint 자동 등록 결과에 덮어쓰임 (entrypoint 등록이 후에 일어남).

**해결**: entrypoint HTML 자체에 `<meta>` 태그로 명시:
```html
<head>
  <meta name="manifest.open_in_tab" content="true" />
  <title>Cueloop · 설정</title>
</head>
```
빌드 결과 `manifest.json`에 `"open_in_tab":true` 정상 반영. wxt.config.ts의 중복 설정은 제거하고 사유 주석만 남김.

**교훈**:
- WXT 0.20에서 entrypoint별 manifest 속성은 **entrypoint 파일의 `<meta>` 태그가 우선**. wxt.config.ts의 manifest section은 entrypoint 자동 인식에서 덮어쓰일 수 있음.
- 빌드 후 `.output/chrome-mv3/manifest.json`을 직접 확인하는 습관 — 빌드 시간 1초라 빠른 sanity check 가능.
- WXT 0.21+ 또는 다른 메이저 버전에선 동작 다를 수 있음. 버전 업 시 재검증.

---

### #23. Web Store 등록 후 UX 개선 — Action click을 popup이 아닌 sidepanel로

**상황** (Phase 1 출시 직전): 확장 아이콘 클릭 시 popup이 뜨는데, 사용자가 사이드패널을 열려면 "우클릭 → 측면 패널 열기" 두 단계 필요. 더 직관적인 UX 요구.

**원인**: manifest의 `action.default_popup: 'popup.html'`만 정의돼있어서 click → popup이 default. side panel은 별도로 열어야 함.

**해결** (`chrome.sidePanel.setPanelBehavior` API):
```ts
// defineBackground 콜백 안에서
void browser.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});
```
이 한 줄로 action click이 popup 대신 sidepanel을 토글. popup은 manifest에 남아있지만 자동으로 안 열림.

**Trade-off + 후속 작업**: popup의 진도/스트릭 UI가 사용자에게서 사라짐. **사이드패널 헤더에 🔥 N emerald 버튼 추가 → 클릭 시 in-page 모달로 popup과 동일 내용 표시**로 대체. popup이 했던 `maintainStreak` safety bump 역할도 사이드패널로 이동 (mount 시 한 번).

**키보드 단축키 forwarding** (같은 시점에 진행): 사이드패널에 focus가 있을 때도 H/L/A/B/S/R/방향키가 동작하도록:
- 사이드패널 `document.addEventListener('keydown', ...)` 추가
- input/textarea/select/contentEditable에 focus 있거나 라인 편집·제목 편집 중이면 무시
- 그 외엔 `OVERLAY_SHORTCUT` 메시지를 background로 → `OVERLAY_SHORTCUT_IN_TAB`로 forward → overlay에서 fake `KeyboardEvent` dispatch → 기존 keydown listener가 동일 처리

**교훈**:
- `setPanelBehavior` 호출도 background top-level이 아닌 `defineBackground` 콜백 안에서 (troubleshooting #20과 같은 원칙).
- popup → 사이드패널 모달 통합 패턴은 manifest 변경 없이 가능. popup.html은 그대로 두고 action behavior만 변경.
- 키보드 forward에서 fake `KeyboardEvent` dispatch는 기존 listener 재활용 깔끔. 단 `isTypingInInput()` 체크가 Netflix 페이지 activeElement 기준으로 동작하니 Netflix 내부 input focus 케이스만 잠재 영향 (실사용 거의 없음).

---

### #24. Netflix 브라우즈 페이지 썸네일 hover 미리보기가 자막을 캡처해 쓰레기 콘텐츠 양산

**증상**: 사용자가 `netflix.com/browse` 등에서 영화 클릭 없이 **썸네일에 마우스만 올려도** Netflix가 미리보기 영상을 자동 재생. 그 미리보기의 `timedtexttracks` JSON이 MAIN world의 `JSON.parse` hijack에 잡혀 background로 forward → ingest → 사이드패널 select 박스에 보지도 않은 콘텐츠가 쌓임. 개발 중 테스트 + 실사용 둘 다 문제.

**원인**: `inject.content.ts`의 JSON.parse hijack은 페이지에서 발생하는 모든 timedtext fetch를 무차별 캡처. hover 미리보기도 일반 재생과 동일하게 자막을 fetch하므로 구분 없이 잡힘.

**해결**: `content.ts`의 `cueloop/timedtext` 핸들러에서 **현재 URL 가드** 추가.
```ts
const currentMovieId = currentMovieIdFromUrl(); // /watch/(\d+) 매칭
if (currentMovieId !== detail.movieId) {
  // 브라우즈 hover 미리보기 또는 watch 중 다른 영화 hover → 무시
  return; // seenMovies에 add 안 함 → 실제 watch 진입 시 재캡처되면 정상 ingest
}
```
- 현재 페이지가 `/watch/{id}`이고 그 `{id}`가 캡처된 movieId와 **둘 다 일치**할 때만 ingest.
- 브라우즈 페이지는 URL이 `/browse`·`/title/...`라 `currentMovieIdFromUrl()`이 null → 무시.
- watch 중 다른 영화 hover는 URL movieId ≠ 캡처 movieId → 무시.

**timing 주의**: Netflix는 SPA라 watch 진입 시 URL 변경이 timedtext fetch보다 먼저 일어나는 게 일반적이라 정상 ingest됨. 무시된 경우 `seenMovies`에 add하지 않으므로, 혹시 첫 캡처가 URL 변경 전이었어도 재캡처 시 ingest 가능. 실사용 검증 결과 누락 없음.

**교훈**:
- 페이지 전역 hijack(JSON.parse, fetch 등)은 "원하는 컨텍스트"만 통과시키는 가드가 필수. 캡처는 광범위하게 하되 **소비 시점에 컨텍스트 검증**.
- Netflix hover 미리보기처럼 사용자가 의도하지 않은 자동 재생이 데이터 오염원이 될 수 있음. URL/movieId 일치는 "사용자가 실제로 그 콘텐츠를 보고 있다"는 신뢰할 만한 신호.

### #25. Chrome Web Store 거절: 사용하지 않는 `storage` 권한 ("Purple Potassium")

**증상** (2026-05-29 CWS 심사 결과): 2차 재제출 직후 심사 거절. 사유:
> "다음 권한을 요청하지만 사용하지는 않습니다 (storage)."
> "위반 참조 ID: Purple Potassium"
> CWS Permissions Policy: "제품의 기능 또는 서비스를 구현하는 데 필요한 가장 좁은 범위의 액세스 권한을 요청합니다. 아직 구현되지 않은 서비스 또는 기능에 도움이 될 수 있는 권한을 요청하여 제품의 '미래에 대비'하지 마세요."

**원인**:
- `wxt.config.ts`의 `permissions`에 `'storage'`가 있었음 — Day 1 WXT 스캐폴딩 또는 초기 설계 시점에 "혹시 모르니"로 들어간 것
- 실제 코드: `grep -rn "chrome\.storage\|browser\.storage"` 결과 **0건**
- 모든 데이터는 IndexedDB(Dexie)에 저장. IndexedDB는 일반 web API라 Chrome `storage` 권한과 완전 무관
- CWS의 자동 정적 분석이 manifest에 선언된 권한과 코드 사용처를 비교해 mismatch 검출

**해결**:
1. `wxt.config.ts`의 `permissions`에서 `'storage'` 삭제 → `['sidePanel', 'alarms', 'notifications']`
2. `PRIVACY_POLICY.md`와 `WEB_STORE_LISTING.md`의 권한 표에서도 storage 행 제거
3. 빌드 후 `.output/chrome-mv3/manifest.json` 직접 열어 `"permissions"` 확인 — `storage` 빠진 것 검증
4. 새 zip 만들어 재제출

**부수적 정리 (재제출 직전 같이)**:
- **`popup` entrypoint 폴더 삭제** — 이전 작업에서 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`로 action click을 사이드패널로 redirect해서 popup은 더 이상 안 열림. 사실상 dead code. popup의 진도/스트릭 UI는 이미 사이드패널 모달로 통합됨. 심사관이 "reachable 아닌 popup이 왜 등록?" 의문 가질 가능성 사전 차단.
- WXT가 popup entrypoint 제거 시 `manifest.action`도 함께 사라지면 `chrome.action.setBadgeText`(스트릭 배지) 동작 불가 → `wxt.config.ts`에 `action: { default_title: 'Cueloop' }`만 명시적으로 추가해서 action field 자체는 유지.

**다른 권한 사전 검증** (재거절 방지, grep 결과로 검증):
- `sidePanel`: `browser.sidePanel.setPanelBehavior` (background.ts) ✓
- `alarms`: `browser.alarms.create` + `onAlarm` (background.ts) ✓
- `notifications`: `browser.notifications.create` (background.ts) ✓
- `https://*.netflix.com/*`: content script 주입 + overlay UI ✓
- `https://*.nflxvideo.net/*`: background SW의 자막 fetch ✓

**listing form 사전 정리** (영문):
- Permission justification 텍스트를 영문으로 다듬어서 `WEB_STORE_LISTING.md`에 박아둠 (form 복붙용)
- "Data usage" 항목: `Website content`만 **Yes** (자막 캡처), 나머지 전부 No. 외부 전송도 모두 No.
- Single purpose 영문 작성: 100LS 단일 학습 목적 명시

**교훈**:
- 빌드 후 manifest.json을 직접 열어보는 습관 (troubleshooting #22의 `open_in_tab` 케이스와 동일). 권한 선언과 실제 사용 일치 여부 grep으로 정기 검증.
- WXT 스캐폴딩 기본 권한이라고 무비판적으로 두지 말 것. 실제 사용 안 하면 즉시 제거.
- CWS는 영문 form 입력이 안전. 본사 심사라 한국어 정당화는 미스커뮤니케이션 위험.
- "Purple Potassium"은 unused permissions 위반의 CWS 내부 코드명. 같은 violation code가 나오면 같은 종류의 문제 — 권한 감사 우선.

---

### #26. 출시 후 2버그 — SPA 진입 시 overlay 미주입 + 🔥 첫 클릭 흰화면

**증상** (v0.2.0 게시 직후, 2026-05-30~06-01): 둘 다 "첫 로드 때 깨지고 새로고침/재생 후엔 정상" 패턴.
1. Netflix 브라우즈에서 썸네일 클릭 → watch 진입 시, 새로고침 안 하면 우리 자막이 안 뜨고 Netflix 기본 자막이 나옴 + 자동 스크롤도 안 됨. 새로고침하면 정상.
2. 사이드패널 열자마자(영상 재생 전) 🔥 진도 버튼 클릭 → 사이드패널 전체가 흰 화면. 영상 조금 재생 후 누르면 정상.

**원인 1 — SPA 네비게이션 + content script 매칭 범위**:
- overlay content script가 `matches: ['https://*.netflix.com/watch/*']`로 /watch/에만 매칭됨.
- Netflix는 SPA. 브라우즈 → /watch/ 이동이 `history.pushState` 기반 클라이언트 네비게이션이고, **Chrome MV3는 SPA 네비게이션 시 content script를 재주입하지 않음**.
- 그래서 /watch/에만 매칭된 overlay(자막 렌더 + Netflix 자막 hider + 자동 스크롤 전부 포함)가 첫 진입 시 안 돎. 풀 리로드(새로고침)해야 주입됨.
- inject/content 스크립트는 `netflix.com/*` 전체 매칭이라 영향 없었음 → overlay만 깨진 이유.

**해결 1**: overlay도 `matches: ['https://*.netflix.com/*']` 전체 매칭으로. 대신 `createShadowRootUi`의 `anchor`를 함수로 바꿔 `/watch/`일 때만 `<video>` 반환, 그 외엔 null. autoMount의 MutationObserver가 SPA 진입(video 등장)을 감지해 마운트, /watch/를 떠나면 unmount. 브라우즈 hover 미리보기 video는 path가 /watch/ 아니라 무시됨. (host_permissions는 그대로 netflix.com이라 권한 변경 아님 — 가벼운 재심사.)

**원인 2 — useLiveQuery 콜백 안에서 DB 쓰기**:
- 사이드패널 진도 모달의 `todayGoal` liveQuery가 `getOrCreateTodayGoal()` 호출 → 오늘 dailyGoals row 없으면 `db.dailyGoals.put`으로 **씀**.
- dexie `useLiveQuery`는 읽은 테이블이 바뀌면 재실행. 콜백 안에서 그 테이블에 쓰니 재실행 cascade → React render 폭주 → 흰 화면.
- 영상 재생 후엔 SESSION_TICK이 이미 row를 만들어둬서 put이 안 일어남 → 안전. "처음에만" 터진 이유.

**해결 2**: liveQuery는 순수 읽기로. `readTodayGoal()`(dailyGoal.ts, 쓰기 없음) + `loadStreakReadonly()`(사이드패널) 추가하고 표시용 liveQuery 둘 다 교체. 실제 row 생성/갱신은 기존 쓰기 경로(SESSION_TICK background, 옵션 페이지 setSetting, maintainStreakSide mount effect)가 그대로 담당하므로 영속성 변화 없음.

**교훈**:
- **MV3 + SPA**: content script가 특정 경로에만 매칭되면 SPA 클라이언트 네비게이션으로 그 경로에 들어갈 때 주입 안 됨. SPA 사이트에선 넓게 매칭하고 anchor/로직에서 가드. (inject/content가 전체 매칭이라 안 깨진 게 힌트였음.)
- **useLiveQuery 콜백은 순수 읽기여야 함**. 안에서 쓰면 재실행 cascade → 흰 화면. 쓰기는 effect/이벤트 핸들러/background로 분리. dexie-react-hooks 공식 권고사항이기도 함.
- 두 버그 모두 "첫 로드만 깨지고 이후 정상" 패턴 → 초기화 타이밍/주입 race 의심 신호.

---
