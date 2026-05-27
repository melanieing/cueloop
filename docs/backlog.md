# Cueloop 개발 백로그

> 단일 진실의 소스(SSOT)는 [`mvp-plan.md`](./mvp-plan.md). 이 문서는 **현재 진행 상황 + 다음에 뭐 할지**를 한눈에 보기 위한 작업 트래커.

## 현재 상태

- **단계**: v0.2 / **🎉 선택된 모든 chunk 완료** (Day 1~7, Day 10~12, Day 14 백업). Day 8/9 스코프 제외. Day 13(통계), Day 14 Web Store + 어댑터 추상화는 v0.3 이후.
- **마지막 업데이트**: 2026-05-27
- **빌드 산출물**: `.output/chrome-mv3/` (production 빌드). dev watch는 WSL에서 작동 안 함 ([troubleshooting #5](./troubleshooting.md))
- **핵심 차별점 (2가지)**:
  - CustomLoop (임의 A-B 구간 반복) — Day 2 schema 반영, Day 6 구현
  - 사용자 자막 편집·삽입 ("Netflix보다 정확") — Day 2 schema 반영(Line.source/editedAt), Day 4 UI 확장

## Day 1 진행 상황 — WXT 환경 셋업 + 기본 entrypoints

- [x] WXT 0.20.26 React 템플릿 스캐폴딩 (cueloop 루트에 머지)
- [x] `package.json` 이름/버전/description 갱신 (`cueloop` / `0.2.0`)
- [x] `pnpm install` + esbuild build script 승인 (`pnpm-workspace.yaml`)
- [x] 런타임 의존성 추가 (`dexie` 4.4.2, `zustand` 5.0.13, `subtitle` 4.2.2, `diff` 9.0.0) — `@types/diff`는 diff v9 자체 타입 내장으로 불필요
- [x] Tailwind v4 설치 (`tailwindcss` 4.3.0, `@tailwindcss/vite` 4.3.0) + `wxt.config.ts` vite 훅에 플러그인 등록 + `entrypoints/popup/style.css`에 `@import "tailwindcss";` — `pnpm build`로 CSS 컴파일 확인
- [x] `wxt.config.ts` 확장 — `name`, `permissions`(4종), `host_permissions: ['https://*.netflix.com/*']`. `action`은 WXT가 popup/에서 자동 와이어링, `side_panel`은 sidepanel/ 생성 시 자동 등록 예정이라 명시 안 함. `description`은 package.json에서 자동 상속
- [x] entrypoints 스켈레톤 확장 — `content.ts`(Netflix matches + document_start), `inject.content.ts`(MAIN world, JSON.parse hijack 자리만 잡음), `sidepanel/`, `options/`(각각 Tailwind 적용 placeholder), `popup/index.html` title 수정. `injected.ts` 이름은 WXT 규약 위반이라 `inject.content.ts`로 변경 ([troubleshooting #4](./troubleshooting.md))
- [x] **빌드 검증 완료** — Windows Chrome에서 수동 Load unpacked. 확장명/권한/Popup/Side Panel(Tailwind 검정)/Options(Tailwind 흰색)/Netflix isolated content script/MAIN world inject script 모두 확인. `pnpm dev`는 WSL에서 즉시 종료되는 이슈 발견 ([troubleshooting #5](./troubleshooting.md))이라 `pnpm build` (production)로 갈음

## Day 2 진행 상황 — Dexie 스키마 + 플랫폼 어댑터 인터페이스

- [x] `src/db.ts` — Dexie 9 테이블 (`contents, lines, lineProgress, customLoops, dailyGoals, streak, sessions, recordings, settings`). DB 이름 `cueloop`. `Setting.value: unknown`로 strict 강화. **Line에 `source: 'platform' | 'user'` + `editedAt?` 필드 추가** (자막 편집·삽입 차별점 지원)
- [x] **CustomLoop 테이블 신규** — 사용자 임의 A-B 구간 (LR 대비 핵심 차별점). `[contentId+startMs]` 복합 인덱스. mvp-plan §1.3, §5, §6 Day 6, §9 모두 보강
- [x] `src/platforms/types.ts` — `PlatformAdapter` 인터페이스 (6 메서드) + `SubtitleCue`, `SubtitleTrack`, `ContentMetadata` DTO
- [x] `src/platforms/netflix.ts` — `NetflixAdapter` 스켈레톤 (id + hostPatterns만 실제, 6 메서드는 Day 3/5에서 채울 throw 자리)
- [x] `src/platforms/index.ts` — `detectAdapter(url)` registry + types re-export
- [x] `src/messages.ts` — `CueloopMessage` 디스크리미네이티드 union. 현재 `NETFLIX_TIMEDTEXT_CAPTURED` 1종, Day 3+에서 확장. 플랫폼-종속 메시지는 `NETFLIX_*` 접두어 컨벤션
- [x] `pnpm compile` + `pnpm build` 통과. (src/* 파일은 entrypoint 미사용이라 빌드 산출물에 미포함, 정상)

## Day 3 진행 상황 — Netflix 자막 가로채기

- [x] `src/lib/dfxp.ts` — DFXP/TTML 정규식 파서. 시간 형식 ticks(`t`)/`HH:MM:SS.mmm`/`s`/`ms` 모두 지원. `<br>` → `\n`, HTML entities decode, 빈 cue 스킵
- [x] `src/platforms/netflix-subtitles.ts` — `ingestNetflixTracks()`. English/Korean 트랙 필터, dfxp URL 우선순위(`dfxp-ls-sdh > imsc1.1 > simplesdh > dfxp-isd > webvtt-lssdh-ios8`), fetch, 파싱, **머지 정책**(`source:'user'` OR `editedAt` 있는 라인 보존, ±50ms 허용오차 매칭)
- [x] `entrypoints/inject.content.ts` — JSON.parse hijack. `result.movieId + result.timedtexttracks` 캡처 시 `cueloop/timedtext` CustomEvent 발행. try/catch로 Netflix 자체 파싱 절대 깨지 않게
- [x] `entrypoints/content.ts` — CustomEvent 수신 → `browser.runtime.sendMessage`로 background에 forwarding. `seenMovies` Set으로 중복 호출 방지
- [x] `entrypoints/background.ts` — `NETFLIX_TIMEDTEXT_CAPTURED` 메시지 수신 → `ingestNetflixTracks()` 호출 (fetch + 파싱 + DB 저장)
- [x] **host_permissions에 `https://*.nflxvideo.net/*` 추가** — Netflix Open Connect CDN에 자막 호스팅됨. background SW에서 CORS 우회 fetch에 필요 ([troubleshooting #6](./troubleshooting.md))
- [x] 초기에 mvp-plan §4 deviation으로 content script fetch 시도했으나 CORS 실패 → mvp-plan §4 원안(background fetch) 복귀
- [x] **머지 startMs 매칭 버그 수정** — `Map.get` step lookup → 이진 탐색 + 허용 오차 50ms→200ms ([troubleshooting #8](./troubleshooting.md))
- [x] **사용자 검증 완료** — JSON.parse hijack/메시지/CORS우회 fetch/dfxp 파싱/DB 저장 전 흐름 작동. 영화 2편(80184100, 80999618) 자막 ingest, 영어 1779행 + 한국어 일부 textKo 채워짐
- [x] **IDB origin 분리 이슈 발견** ([troubleshooting #9](./troubleshooting.md)) — 데이터 확인은 extension origin (SW DevTools)에서. content script에서 dexie 직접 쓰지 말 것 (페이지 origin에 저장됨)
- [x] **DevTools 버그 발견** ([troubleshooting #11](./troubleshooting.md)) — Chromium이 extension origin IDB를 Application 탭에 enumerate 안 함. `chrome://indexeddb-internals/` 또는 Console JS API로 우회. Day 4 사이드패널 UI가 영구 해법
- [x] **데이터 1779행 (영화 2편) 정상 저장 확인** — `indexedDB.open('cueloop').transaction('lines').objectStore('lines').count()` = 1779

## Day 4 진행 상황 — 사이드 패널 자막 편집 UI

- [x] **Chunk A**: 사이드패널 라인 리스트 (가상 스크롤). `@tanstack/react-virtual` 3.13.25 + `dexie-react-hooks` 4.4.0 추가. `src/hooks/useContents.ts` + `useLines.ts`. 1779행 부드럽게 스크롤 검증
- [x] **Chunk B**: 인라인 편집 (textEn/textKo/note). 클릭→편집 모드, Ctrl+Enter 저장, Esc 취소. `editedAt` 자동 갱신. 콘텐츠 스위처 드롭다운
- [x] **Chunk C**: 신규 라인 삽입 (헤더 "+ 새 라인" 모달, 시간 형식 `MM:SS.mmm` 또는 ms 직접). 시각 뱃지 (편집 ✎ 앰버 / 사용자추가 👤 보라). `source: 'user'` + `editedAt` 자동 set. 통계: 편집수 / 추가수 카운터
- [ ] **Chunk D**: 한국어 머지 알고리즘 개선 ([troubleshooting #10](./troubleshooting.md)) — multi-cue match 처리. 영화 1(1726행 중 한국어 1%)에서 효과 클 것
- [ ] **Day 4.5**: 콘텐츠 메타데이터 추출 ([troubleshooting #13](./troubleshooting.md)) — "Netflix 80184100" → 진짜 영화/에피소드 제목

- [x] **Day 4.5: 콘텐츠 메타데이터** — `document.title` 추출 시도했으나 Netflix가 영상 페이지에서도 title을 "넷플릭스"만 표시하는 케이스 다수. 사용자 결정으로 보류 ([troubleshooting #13](./troubleshooting.md)). 드롭다운 표시는 `Title (Netflix ID)` 또는 ID-only로
- [x] **Chunk D 후속: 사이드패널 자동 refresh** — Cross-context broadcast (`CONTENTS_UPDATED`) + `useDbVersion` 훅. background 쓰기 → sidepanel 자동 re-render
- [x] **Day 5 조기 진입 (jump-to-line + 라인 삭제 + active 탭 추적)**:
  - jump-to-line via Netflix Player API (M7375 회피, [troubleshooting #14](./troubleshooting.md))
  - 라인 삭제 (편집 모드 🗑 버튼)
  - 사이드패널이 active Netflix 탭 자동 추적 ([troubleshooting #15](./troubleshooting.md)) — `chrome.tabs.onActivated/onUpdated` + `ACTIVE_CONTENT_CHANGED` broadcast. "📺 자동 연동" / "📺 현재 영상으로" 토글 UI

## Day 5 — 듀얼 자막 오버레이 (완료)

- [x] WXT `createShadowRootUi` + `anchor: 'video'` autoMount로 Netflix video 옆에 Shadow DOM 마운트
- [x] `requestAnimationFrame` loop로 video.currentTime → 현재 cue 찾기 (binary search)
- [x] 영어 + 한국어 두 줄 표시 (영어 3.375rem, 한국어 2.625rem)
- [x] Netflix 자체 자막 hide (CSS injection, `.player-timedtext` 등 셀렉터)
- [x] H 키 한국어 토글 + 토스트
- [x] 한국어 OFF indicator (우상단)
- [x] 표시 종료 시점을 다음 라인 startMs로 확장 (학습 도구 특성: 빈 화면 최소화)
- [x] **WXT onMount 시그니처 오해 해결** ([troubleshooting #16](./troubleshooting.md)) — 3번째 인자는 shadowHost, video는 직접 querySelector
- [x] **Netflix M7375 회피** ([troubleshooting #14](./troubleshooting.md)) — Netflix Player API의 `.seek()` 채널 (inject MAIN world)
- [x] 사이드패널 → overlay 자동 refresh ([troubleshooting #17, #18](./troubleshooting.md)) — sidepanel write → broadcast → background forward → tabs.sendMessage → overlay

## Day 6 — A-B 반복 + 100LS 카운터 + CustomLoop (완료)

- [x] **L 키 라인 반복** + 100LS 카운터 + 색상 마일스톤 (amber/green/purple)
- [x] `lineProgress.listenCount` 자동 증가 (background INCREMENT_LINE_LISTEN)
- [x] 반복 자동 해제 (사용자 jump 시) + 250ms seek cooldown
- [x] **카운터 폰트 2.75rem** + textShadow
- [x] **CustomLoop 차별점 #1 (사용자 강조)**: A/B/S 키
  - A: 시작점 마킹
  - B: 끝점 마킹 + 자동 DB 저장 + 즉시 반복 시작
  - S: 라벨 입력 (prompt 동안 cooldown 무한화 + 닫힘 후 startMs로 재seek로 반복 유지)
- [x] **사이드패널 "🔁 내 구간" 섹션** — CustomLoop 리스트 표시/▶재생/✎라벨/🗑삭제
- [x] 사이드패널 ▶ 재생 → background → tabs.sendMessage → overlay에 PLAY_CUSTOM_LOOP_IN_TAB → 반복 자동 시작
- [x] CustomLoop 카운터는 Line.lineProgress와 **완전 독립** (mvp-plan 명세)

## Day 14 — 백업 import/export (완료, Chunk S)

- [x] **Options Page 백업 섹션** — 📥 백업 내보내기 / 📤 백업 불러오기 두 버튼.
- [x] **Export**: 7개 테이블(contents, lines, lineProgress, customLoops, dailyGoals, sessions, settings) → 단일 JSON. 파일명 `cueloop-backup-YYYY-MM-DD.json`. recordings는 v0.2 미사용이라 제외.
- [x] **Import**: 파일 선택 → in-page 모달 확인 → Dexie transaction으로 `clear()` + `bulkPut()` 원자적 복원. 완료 후 테이블별 카운트 표시.
- [x] **`window.confirm` 대신 in-page 모달** ([troubleshooting #21](./troubleshooting.md)) — Chrome MV3 extension options page에서 native dialog가 silent fail하는 케이스 우회 + 다크 테마 일관.

## Day 11~12 — 일일 목표 + 퀘스트 + 스트릭 + Popup 배지 (완료, Chunk O~Q)

- [x] **Chunk O**: Options Page에 일일 목표 입력 (`dailyTargetMinutes`/`dailyTargetListens`). `useLiveQuery`로 즉시 저장. 다크 테마. 옵션 변경 시 오늘 dailyGoal row의 target도 즉시 sync.
- [x] **Chunk P (Day 11)**: `src/lib/dailyGoal.ts`에 `getOrCreateTodayGoal` / `addAchievedSeconds` / `addAchievedListen` / `todayKey`. settings에서 매번 target 다시 읽어 sync. `SESSION_TICK` 메시지로 overlay → background tick. overlay에서 1초 interval로 active 측정 (영상 재생 + tab visible + window focus) → 10초 batch + visibilitychange/pagehide flush. listen 증가(L 키, 사이드패널 🔁, CustomLoop 반복) 시 `achievedListens` +1. 완료 transition 시 `chrome.notifications` "🎉 오늘 목표 달성!" 알림.
- [x] **Chunk Q (Day 11+12)**: Popup UI — 🔥 currentStreak + 두 진도 바 + ⚙ 설정 버튼. `chrome.action.setBadgeText`로 toolbar 아이콘에 streak 숫자 표시 (`#10b981` emerald 배경). `chrome.alarms.create('cueloop-midnight')` 자정 + 5초 buffer로 24시간 주기 → `maintainStreak` (lastCompletedDate가 오늘/어제 아니면 0으로 reset). 완료 transition 시 `bumpStreakOnComplete` (어제면 +1, 아니면 1로 시작). popup 마운트 시 safety bump — transition 시점 stub였던 경우 등 stale state 복구.
- [x] **WXT 0.20 빌드 버그 회피** ([troubleshooting #20](./troubleshooting.md)) — alarms listener/IIFE는 `defineBackground` 콜백 내부에. streak 로직은 lib 파일 분리 대신 background.ts + popup/App.tsx에 inline. `db.streak` 테이블 대신 `db.settings`의 `__streak__` key 사용.
- [x] **확장 아이콘 교체** — public/icon/*.png (16/32/48/96/128) cueloop 보라 로고로 교체. WXT 초록 puzzle 기본 아이콘 제거.
- [x] **Popup default 템플릿 정리** — WXT React 템플릿 잔존물 (WXT+React 로고, count 버튼 등) 제거 + Tailwind 다크 테마 일관.

## Day 8 — 받아쓰기(Dictation) 모드 ❌ **v0.2 스코프 제외**

**결정** (2026-05-27): 받아쓰기는 *쓰기* 연습이라 Cueloop의 본질(말하기/100LS)과 맞지 않음. 사용자 의도는 "입에서 영어 대사가 나오는지 검증". 이상적 구현은 음성 인식(Web Speech API SpeechRecognition) 기반 발화 검증이지만:
- 한국인 영어 발음에서 Chrome 음성 인식 정확도 미지수
- 마이크 권한 + 실시간 인식 + noise handling 등 UX 복잡도
- v0.2 14일 스코프 위험

→ v0.2에선 발화 검증 자체를 제외. v0.3에서 음성 인식 검증 재검토.

`Line.dictationAttempts/dictationCorrect` 필드는 schema에 남겨두되 v0.2에선 미사용. Day 13~14 schema 정리 시 제거 또는 보류 결정.

## Day 9 — 녹음(Shadowing) 모드 ❌ **v0.2 스코프 제외**

**결정** (2026-05-27): v0.2 핵심 차별점(CustomLoop, 자막 편집)에 집중하기 위해 녹음 + 자가 평가 시스템도 v0.3 이후로 미룸. MVP 시간 절약.

`Recording` 테이블 + `LineProgress.shadowCount` + `Recording.selfRating` schema는 남겨두되 v0.2에선 미사용. Day 13~14 schema 정리 시 결정.

v0.3에서 음성 인식 발화 검증과 함께 통합 검토.

## Day 10 — 외움 처리 + 추천 (완료, Chunk L 단일)

- [x] **외움 후보 자동 뱃지** — `listenCount ≥ 30 && !isMemorized`이면 LineRow에 `✨ 외움?` amber pulse 표시 + ☐ 체크박스 amber 강조. 사용자 유도 패턴.
- [x] **외운 라인 숨기기 토글** — 헤더 우측 `☑ 외움 N` / `🙈 외움 N 숨김`. memorizedCount > 0일 때만 노출.
- [x] **사이드패널 라인 🔁 반복 토글** — `PLAY_LINE_LOOP` / `STOP_REPEAT` / `REPEATING_LINE_CHANGED` 메시지로 overlay와 양방향 sync. L 키와 GUI 어디서 시작/정지해도 양쪽 일관.
- [x] **dictation 후보 조건 단순화** — mvp-plan 원안 `listenCount ≥ 30 AND dictationCorrect ≥ 3` → `listenCount ≥ 30`만. Day 8/9 스코프 제외 결과.
- [x] **react Hooks rules 위반 수정** — early return 뒤 useMemo → 앞으로 이동. ESLint react-hooks/rules-of-hooks가 잡았어야 함 (빌드 파이프라인에 lint 미통합, Day 13~14 cleanup 후보).

## Day 7 — 진도 히트맵 + 단축키 + 사이드패널 자동 스크롤 (완료)

- [x] **진도 히트맵 색상 dot** — LineRow에 listenCount 기반 색상 (zinc/lime/emerald/blue/purple) + 카운터 뱃지
- [x] **외움(memorized) 토글** — ☐/☑ 체크박스 (★ → 체크표시로 변경, 사용자 직관 반영)
- [x] **사이드패널 자동 스크롤** — `CURRENT_LINE_CHANGED` 메시지 (overlay → sidepanel)로 현재 라인 동기화 + 파란 배경 하이라이트
- [x] **`📌 자동 스크롤 ON/OFF` 명시 토글** — 헤더 우측, 사용자 직접 제어
- [x] **`📺 현재 라인으로 ↓` 점프 버튼** — 토글 OFF일 때만 노출, 단순 점프 (토글 상태 안 건드림)
- [x] **편집 시작 시 자동 토글 OFF** — 편집 중 자동 스크롤 차단
- [x] **`content-visibility: auto`로 가상화 대체** ([troubleshooting #19](./troubleshooting.md)) — react-virtual 제거, 1486 라인 자연 flow + viewport 밖 layout skip. 측정 race condition 제거 + EditRow mount freeze 해소.
- [x] **`h-screen overflow-hidden`로 진짜 스크롤 컨테이너 확보** — `min-h-screen`의 outer scroll 문제 해결
- [x] **`LineRow` `React.memo` + custom compare** — `lines` ref 변경 시 변경된 라인만 re-render
- [x] **단축키 키맵 통합 검증** — Day 5/6에서 정의된 H/L/A/B/S/←/→/↑/↓/R 모두 동시 작동 확인

## 추후 정리 (Day 13~14 또는 v0.3)

- [ ] **Dexie schema version 정리** ([troubleshooting #12](./troubleshooting.md)) — `version: 10`까지 auto-bump됨. schema freeze 시점에 단일 `version(1).stores({final})`로 정리
- [x] `pnpm compile` + `pnpm build` 통과 (content.js 103kB Dexie 번들 포함, inject.js 716B)

## Day 2~14 큰 그림 (mvp-plan §6 요약)

| Day | 작업 | 예상 |
|---|---|---|
| 2 | Dexie 스키마 + `PlatformAdapter` 인터페이스 + 메시지 타입 | 2h |
| 3 | Netflix 자막 가로채기 (JSON.parse hijack + dfxp 파서) | 3h |
| 4 | 사이드 패널 자막 편집 UI (가상 스크롤, 인라인 편집) | 2h |
| 5 | 비디오 제어 + 듀얼 자막 오버레이 (Shadow DOM) | 3h |
| 6 | A-B 반복 + 100LS 카운터 | 3h |
| 7 | 진도 히트맵 + 단축키 | 2h |
| 8 | 받아쓰기(Dictation) 모드 | 2h |
| 9 | 녹음(Shadowing) 모드 + 자가 평가 | 3h |
| 10 | 외움 처리 + 추천 로직 | 1.5h |
| 11 | 일일 목표 + 퀘스트 | 2.5h |
| 12 | 스트릭 + Popup 배지 | 1.5h |
| 13 | 통계 화면 + 어댑터 추상화 마무리 | 2h |
| 14 | Web Store 준비 + 폴리싱 + 백업 export/import | 3h |

## v0.2 완료 검증 지표 (mvp-plan §9)

1. Netflix 페이지 진입 시 자동 듀얼 자막
2. 키보드만으로 A-B 반복 부드러움
3. 100회 카운터가 손으로 셀 때보다 압도적으로 편함
4. 받아쓰기/녹음이 "외움" 판단을 객관화
5. 일일 퀘스트·스트릭이 일주일 이상 동기 유지
6. Netflix DOM 변경 시 작은 패치로 회복 가능
7. **CustomLoop이 LR 대비 진짜 차별점인가?** — 한 라인 안 더 짧은 구간 / 두 라인 걸친 구간 / 자막 없는 구간 셋 다 부드럽게 반복 가능한가
8. **자막 편집·삽입이 실제 학습에 효과 있었나?** — Netflix 자막 오류 수정 또는 놓친 대사 추가 경험이 1번 이상, 그 결과 더 정확한 학습이 됐는가

## Web Store 단계적 출시 계획 (2026-05-27 결정)

**Phase 0 — 현재 상태 (✓ 완료)**: 본인 학습용 unpacked 확장. 핵심 기능 + 백업까지 완비.

**Phase 1 — 무료 공개 + 운영 검증** (진행 중)
- [x] **contents.title 편집 UI** ([Day 4.5 보강](#)) — 사이드패널 헤더 ✎ 버튼. 자동 추출 대신 사용자가 직접 1회 입력. 일반 사용자 UX 정상화.
- [x] `docs/PRIVACY_POLICY.md` 초안 작성 (한/영, TODO placeholder 2개: 이메일 + GitHub URL)
- [x] `docs/WEB_STORE_LISTING.md` 초안 작성 — 짧은 설명 / 상세 설명(한/영) / 권한 정당화 / 스크린샷 가이드 / 등록 체크리스트
- [ ] Privacy policy 호스팅 URL 확보 (GitHub Pages or Notion or 개인 도메인)
- [ ] `[TODO]` placeholder 채우기 (이메일, GitHub URL)
- [ ] 스크린샷 5장 캡처 (1280×800)
- [ ] Chrome Web Store 개발자 계정 등록 ($5 일회)
- [ ] `pnpm zip`으로 확장 zip 생성
- [ ] Web Store 첫 등록 + 심사 통과 (보통 1-3일, 새 확장은 더 길 수 있음)
- [ ] **1~3개월 운영 모니터링**:
  - 사용자 수 추세
  - Netflix DOM 변경 발생 시 핫픽스 가능 시간 트래킹
  - 사용자 피드백 (평점, 리뷰, 이메일)
  - 자막 ingest 실패율 등 안정성 지표
- [ ] 진짜 학습 가치 검증 — 1~2명 외부 사용자가 한 달+ 사용 후 후기

**Phase 2 — freemium PRO 도입** (Phase 1 검증 후 결정)
- [ ] **수익 모델 결정**: freemium 권장 (LR 패턴) — 무료(영화 2편 / CustomLoop 5개 등 제한) + PRO(무제한 + 일일 목표 + 스트릭 + 백업)
- [ ] **가격**: 월 **₩6,900** / 연 **₩59,000** (월 환산 ₩4,917, 30% 할인) / 평생 ₩89,000 early supporter
- [ ] **결제 인프라**: ExtensionPay (Chrome Web Store payments 대체 표준) + Stripe. 라이센스 검증 백엔드 (Cloudflare Workers 또는 Vercel 등 서버리스).
- [ ] PRO 기능 게이팅 코드 (free tier 제한 + PRO unlock 분기)
- [ ] 환불·CS 대응 채널 (이메일 + Notion FAQ)

**Phase 3 — 멀티 OTT + AI 기능** (v0.3 본격 확장)
- [ ] Coupang Play / Disney+ / TVING / YouTube 어댑터 (PlatformAdapter 구현 추가만, v0.2 코어 로직 무수정)
- [ ] 받아쓰기/녹음/발화 검증 (음성 인식 기반)
- [ ] FSRS-4.5 SRS, 통계 화면, 클라우드 동기화 (선택), Azure 발음 평가 (선택)

**의사결정 근거** (시장조사 2026-05-27):
- Language Reactor PRO $5/월 = ₩7,000 (직접 경쟁, freemium 모델)
- 한국 영어 학습 앱 수용 가격대 월 ₩5,000~15,000
- Chrome Web Store 자체 결제는 2021년 종료, 외부(ExtensionPay) 필수
- 자막 추출 확장 법적 분쟁 0건 (LR 등 다 운영 중) — 단 "DRM 우회/다운로드" 표현 절대 X
- 우려: Netflix DOM 잦은 변경 + 유료 사용자 환불 위험 → Phase 1로 안정성 검증 후 유료화

핵심 원칙: **v0.2 코어 로직은 Phase 2~3에서 손대지 않는다.** 플랫폼 확장은 `PlatformAdapter` 구현 추가만, 수익화는 게이팅 코드만 얹기.
