# Cueloop 개발 백로그

> 단일 진실의 소스(SSOT)는 [`mvp-plan.md`](./mvp-plan.md). 이 문서는 **현재 진행 상황 + 다음에 뭐 할지**를 한눈에 보기 위한 작업 트래커.

## 현재 상태

- **단계**: v0.2 / **Web Store Phase 1 운영 중**. v0.2.0 게시(2026-05-30) → v0.2.1 제출 → 심사 중 취소하고 hide 기능 추가해 **v0.2.2로 재제출(2026-06-02), 심사 대기**. 통과 시 기존 사용자 자동 업데이트.
- **마지막 업데이트**: 2026-06-02
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

**Phase 1 — 무료 공개 + 운영 검증** (심사 대기 중)

기본 출시 자료:
- [x] **contents.title 편집 UI** ([Day 4.5 보강](#)) — 사이드패널 헤더 ✎ 버튼. 자동 추출 대신 사용자가 직접 1회 입력. Netflix가 `/watch/` 페이지에선 title metadata를 client에 안 보내서 자동 추출 포기 결정(2026-05-27). 일반 사용자 UX 정상화.
- [x] `docs/PRIVACY_POLICY.md` 작성 (한/영) + GitHub Pages 호스팅 → https://melanieing.github.io/cueloop/PRIVACY_POLICY
- [x] `docs/WEB_STORE_LISTING.md` 작성 — quick-ref 표 + 짧은/상세 설명(한/영) + 권한 정당화 + 스크린샷 가이드
- [x] 스크린샷 5장 캡처 + ImageMagick으로 1280×800 변환 (다크 캔버스 padding)
- [x] Chrome Web Store 개발자 계정 등록 ($5 일회)
- [x] `pnpm zip`으로 확장 zip 생성 → `cueloop-0.2.0-chrome.zip` (~260 kB)
- [x] Web Store 첫 등록 (2026-05-27)

첫 등록 후 UX 개선 (재제출 전 추가 작업):
- [x] **사이드패널 단일 클릭 진입** ([troubleshooting #23](./troubleshooting.md)) — `chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true})`로 cueloop 아이콘 click → 사이드패널 토글. popup auto-open 폐지.
- [x] **Popup → 사이드패널 in-page 모달 통합** — 사이드패널 헤더에 `🔥 N` 버튼 + 클릭 시 진도 바 + 스트릭 + 오늘 달성 박스 모달. popup의 `maintainStreak` safety bump 역할도 사이드패널로 이전.
- [x] **키보드 단축키 forwarding** — 사이드패널에 focus가 있어도 H/L/A/B/S/R/방향키가 동작 (`OVERLAY_SHORTCUT` 메시지 → background → overlay fake KeyboardEvent dispatch). input/편집 중일 땐 그 입력 우선.
- [x] **첫 설치 시 옵션 페이지 자동 열림** — `chrome.runtime.onInstalled` (reason==='install')로 onboarding 자동 노출.
- [x] **🎯 시작하기 onboarding 섹션** — 옵션 페이지 상단에 8단계 사용법 + 단축키 cheat sheet (접기). 일반 사용자 첫 진입 학습 곡선 완화.
- [x] **옵션 페이지 가독성** — `max-w-2xl` → `max-w-4xl`, 별도 탭 열림 ([troubleshooting #22](./troubleshooting.md): WXT 0.20 manifest override 우회 — entrypoint HTML의 `<meta name="manifest.open_in_tab">`).
- [x] **데이터 안전 안내** — 옵션 페이지 백업 섹션에 amber 경고 박스 (4가지 손실 시나리오 + 백업 권장). Listing에 "💾 Where is data stored?" 한/영 항목 추가.
- [x] **라인 시각 편집** ([commit 1a31966](#)) — EditRow에 startMs/endMs input 추가 (InsertLineModal의 `parseTimeToMs` 재사용). 시각 변경 시 검증(`endMs > startMs`).
- [x] **라인 반복 endMs ≠ displayEndMs 분리** ([commit 1a31966](#)) — 자막 표시 시간(다음 라인 startMs까지 연장 UX)과 반복 재생 endMs(사용자 편집한 line.endMs 직접 사용)를 분리. 사용자가 endMs를 줄여도 반복 재생에 즉시 반영.
- [x] **확장 아이콘 교체** — `public/icon/*.png` 5개 사이즈를 ImageMagick으로 `cueloop_small_icon_removebg.png`에서 변환. 투명 배경. 배지 색은 amber → emerald 변경.

콘텐츠 관리 + 데이터 위생 (2차 재제출 전 추가):
- [x] **콘텐츠 삭제** — select 박스 옆 🗑 버튼 + in-page confirm 모달. 콘텐츠 + lines/lineProgress/customLoops/sessions/recordings cascade 삭제 (Dexie transaction). dailyGoals/streak 보존. 삭제 대상이 현재 manual 선택이면 자동 연동 복귀.
- [x] **브라우즈 hover 미리보기 ingest 차단** ([troubleshooting #24](./troubleshooting.md)) — content script가 현재 URL이 `/watch/{id}`이고 그 id가 캡처된 movieId와 일치할 때만 ingest. 썸네일 hover 미리보기 자막이 쓰레기 콘텐츠로 들어오던 문제 해결.
- [x] **옵션 페이지 + README FAQ** — 콘텐츠 식별 방식(Netflix video ID 안정성), 쓰레기 콘텐츠 정리, 제목 직접 입력, 단축키 포커스 조건.
- [x] **이중 언어 README** — 한/영. pitch + LR 비교 + 기능 + 단축키 + privacy + 설치 + 개발 셋업 + FAQ.

재제출:
- [x] Web Store 1차 재제출 (2026-05-28) — UX 개선 (onboarding, 단일 클릭 사이드패널, 진도 모달).
- [x] Web Store 2차 재제출 (2026-05-28) — 콘텐츠 삭제 + hover 차단 + FAQ 포함.
- [x] **CWS 거절 (2026-05-29)** — 사용하지 않는 `storage` 권한 요청. Purple Potassium 정책 위반 ([troubleshooting #25](./troubleshooting.md)).
- [x] **3차 재제출 준비 완료 (2026-05-29)**:
  - `storage` 권한 제거 (Dexie/IndexedDB는 chrome.storage API와 무관)
  - `popup` entrypoint 폴더 삭제 — `openPanelOnActionClick:true` 이후 reachable 안 되던 dead code
  - `action.default_title` 명시 (popup 없어진 후 action field 자체 사라지지 않도록 — chrome.action.setBadgeText 동작 유지)
  - listing form용 영문 권한 정당화 + Single purpose + Data usage 답변 영문화 (`docs/WEB_STORE_LISTING.md`)
  - 다른 권한(sidePanel/alarms/notifications/host_permissions) 모두 사용처 grep으로 검증
- [x] **3차 제출 + 게시 통과 (2026-05-30)** 🎉

## Phase 1 출시 직후 다음 작업 (Active)

- [ ] **본인 unpacked → 정식 버전 데이터 이전** (가장 먼저!):
  1. unpacked 옵션 페이지에서 "📥 백업 내보내기" → 안전한 곳(드라이브/USB)에 JSON 보관
  2. Web Store에서 Cueloop 정식 버전 설치
  3. 정식 버전 옵션 페이지에서 "📤 백업 불러오기" → 동일 JSON 선택 → 복원
  4. 동작 확인 후 unpacked 버전 제거 (선택)
  - ⚠ unpacked 확장 ID(`abjpdggoimiioglekbiofbijbmjkikpp` 아님 / 그 ID는 정식 버전. unpacked는 임시 hash)와 정식 버전 ID가 다른 origin이라 IndexedDB 분리됨
- [x] **v0.2.1 후속 업데이트 제출 완료 (2026-06-01)** — package.json 0.2.0 → 0.2.1, zip 업로드, 검토용 제출. 권한 변경 없음(content_scripts matches만 /watch/* → /* 확장, host_permissions 동일). 심사 통과 후 자동 업데이트.
  - 포함: 라인 단일/일괄 삭제, 콘텐츠 삭제, ⚠검토/★중요 마크+필터, E·SPACE 단축키, ⏱지금 시각 픽커, 라인 시각 편집, 사이드패널 단축키/진도 모달, 브라우즈 hover ingest 차단, EditRow 높이↑, 다른 창 반복 유지
  - **출시 후 발견 2버그 fix 포함**: SPA 진입 시 overlay 미주입(overlay 스크립트 netflix.com/* 전체 매칭 + anchor 가드) + 🔥 첫 클릭 흰화면(useLiveQuery 순수 읽기 전환)
## v0.2.2 — hide 기능 포함해 재제출 (2026-06-02, 심사 대기)
v0.2.1을 심사 중 취소하고 아래 hide 기능을 더해 0.2.2로 bump → 단일 심사로 묶어 제출. 권한 변경 없음.
- [x] 라인 숨김(hide) — 노래 가사 등 학습 대상 아닌 라인을 삭제 대신 목록에서만 숨김 (`Line.isHidden`). 라인별 eye-off 토글 + `🙈 숨김 N` 필터(자동 reset trap fix 포함) + 일괄 숨김(선택 모드 액션)
- [x] "여러 줄 삭제" → "☑ 여러 줄 선택"으로 변경 + 선택 모드에 `🙈 선택 숨김` 추가, 선택 색상 중립화(red→zinc/blue)
- [x] 통계 라인 재구성 — 한국어 % 제거, 학습대상 라인 수(전체−숨김) + ☑외움 비율(외움/(전체−숨김))
- [x] (v0.2.1분 포함) SPA 진입 overlay 미주입 fix, 🔥 흰화면 fix, 그 외 v0.2.1 누적 변경 전부

## v0.2.3 — 자막 공유 기능 (2026-06-04 제출, 심사 대기)
블로그 홍보글에서 "내가 고친 자막 공유" 섹션을 쓰려면 import 기능이 정식 버전에 있어야 해서 별도 버전으로 제출.
- [x] 옵션 페이지 🔗 자막 공유 — 영화 단위 자막 내보내기/불러오기 (`app: 'cueloop-subtitles'`). 자막·고친내용·메모만, 개인 마크/진도/목표/스트릭/CustomLoop 제외. 불러오기는 `[platform+contentId]`로 매칭해 그 영화만 추가/교체(비파괴적), 기존 영화면 amber 경고 모달.
- [ ] **v0.2.3 심사 통과 대기** — 통과 후에야 블로그 독자가 import 가능. 블로그 자막 공유 섹션 공개는 통과 후.

> 참고: v0.2.2가 아직 심사 중이면 취소하고 0.2.3으로 재제출(단일 심사). 이미 통과·게시됐으면 0.2.3을 일반 업데이트로 제출.
- [ ] 본인 + 가까운 1-2명에게 Web Store 링크 공유, 첫 실사용 피드백 수집
- [ ] 매주 사용자 수 + 평점 + 리뷰 체크 (Web Store 개발자 콘솔)
- [ ] Netflix DOM 변경 발생 시 핫픽스 시간 트래킹 (목표: 48시간 내)

v0.2.1 후속 업데이트 누적 변경 (심사 통과 후 `package.json` 0.2.0 → 0.2.1 + zip 재업로드):
- 라인 단일 삭제 (hover SVG trash + in-page confirm) + 다중 선택 모드 (📋 → "여러 줄 삭제") + 일괄 삭제 후 자동 종료
- 라인 반복이 다른 창 포커스 시에도 유지 (`video.timeupdate` 보조 + cancel 임계치 완화)
- 영어 자막 토글 E 키 (둘 다 OFF면 shadowing 모드)
- 사이드패널 단축키 cheat sheet 모달 (⌨ 버튼)
- 오버레이 토스트 + indicator 폰트 자막 크기 가까이 ↑
- 자막 부정확 마크 (⚠) + 필터, 중요 마크 (★) + 필터 — 둘 다 자동 reset trap fix
- 시각 input 옆 ⏱ 지금 버튼 (영상 현재 시각 → input)
- 스페이스바 재생/일시정지 (사이드패널 focus에서도)
- 헤더 그룹화 (정보 팝업 → stats 줄, 토글 → 행 2)
- EditRow textarea 높이 ↑ + 메모도 textarea로

Phase 1 운영 모니터링 (출시 후):
- [ ] 매주 사용자 수 + 평점 + 리뷰 체크
- [ ] Netflix DOM 변경 발생 시 핫픽스 시간 트래킹 (목표: 48시간 내)
- [ ] 자막 ingest 실패율 모니터링
- [ ] 1~3개월 운영 후 Phase 2 (freemium 유료화) 진입 여부 결정
- [ ] **1~3개월 운영 모니터링**:
  - 사용자 수 추세
  - Netflix DOM 변경 발생 시 핫픽스 가능 시간 트래킹
  - 사용자 피드백 (평점, 리뷰, 이메일)
  - 자막 ingest 실패율 등 안정성 지표
- [ ] 진짜 학습 가치 검증 — 1~2명 외부 사용자가 한 달+ 사용 후 후기

**Phase 1 운영 결정 사항 정리** (2026-05-27~28):
- Netflix의 `/watch/` 페이지가 영상 title metadata를 client에 안 보내는 정책 확인 (falcor cache의 `videos[id].summary.value.title`도 undefined). 자동 추출 포기 → 사이드패널 ✎ 제목 UI로 사용자가 1회 직접 입력하는 방향으로 전환.
- 시장조사 결과 + 위험 평가로 **즉시 freemium → Phase 1 무료 검증 우선**으로 결정. v0.2.0 자체에 결제 인프라 없음.
- 사용자 본인 `unpacked` ID와 Web Store 발급 ID가 서로 다른 origin → 출시 후 본인이 정식 버전 설치 시 학습 데이터 분리. **반드시 unpacked 버전에서 "📥 백업 내보내기" → 정식 버전에서 "📤 백업 불러오기"** 절차 필요.
- popup은 manifest에 남겨두지만 action click이 사이드패널로 가서 사실상 unreachable. v0.3에서 manifest 정리 검토.

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
