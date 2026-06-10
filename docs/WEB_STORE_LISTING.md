# Cueloop — Chrome Web Store 등록 자료

> Phase 1 무료 공개용. v0.2.0 기준.

## 📋 등록 form에 채울 정보 (빠른 참조)

| Web Store form 항목 | 값 |
|---|---|
| 확장 이름 | Cueloop — 영화로 영어 100번 듣기 |
| 카테고리 | Education |
| 공식 URL (Homepage) | https://github.com/melanieing/cueloop |
| 개인정보처리방침 URL | https://melanieing.github.io/cueloop/PRIVACY_POLICY |
| 지원/문의 이메일 | melanie0617@gmail.com |
| 개발자 표시 이름 | melanieing |

## ✓ 이름 / 카테고리 / 언어

| 항목 | 값 |
|---|---|
| 확장 이름 | **Cueloop — 영화로 영어 100번 듣기** |
| 카테고리 | 교육 (Education) |
| 기본 언어 | 한국어 |
| 추가 언어 | 영어 |

**중요 규칙** (CLAUDE.md 함정 #7):
- 이름 맨 앞에 "Netflix" 단어 금지 (상표권)
- 설명에 "DRM 우회", "다운로드" 표현 절대 금지 (자동 거절)

---

## ✓ 짧은 설명 (Short Description, 132자 이내)

### 한국어 (권장)
```
영화 한 편을 100번 듣고 따라 말하는 학습법(100LS)을 위한 듀얼 자막 + A-B 반복 + 자막 편집 + 일일 목표 도구.
```
(95자 — OK)

### English
```
Dual subtitles + A-B repeat + subtitle editing + daily goals for the "100 Listenings" English learning method.
```
(115자 — OK)

---

## ✓ 상세 설명 (Detailed Description)

### 한국어

```
Cueloop은 영화 한 편을 100번 반복 듣고 따라 말하는 학습법(100LS)을 위해 만들어진 영어 학습 도구입니다.

▶ 핵심 기능

🎬 듀얼 자막 오버레이
영상 위에 영어 + 한국어 자막을 동시에 표시합니다. Netflix 자체 자막은 자동으로 숨겨집니다.

🟣 전역 ON/OFF 토글
영상 컨트롤바의 🎬 Cueloop 버튼으로 학습 오버레이를 한 번에 켜고 끕니다. 끄면 자막 오버레이·단축키가 모두 멈춰 평소 넷플릭스 그대로 — 가볍게 볼 땐 끄고, 학습할 땐 켭니다. 버튼은 컨트롤바와 함께 나타났다 사라지고, 좁은 화면에선 🎬 아이콘만 남습니다.

🔤 자막 표시 순서 선택
영어를 위/한국어를 아래(기본)로 보여주거나, 그 반대로 옵션 페이지에서 전환할 수 있습니다. 한국어를 배우는 분은 한국어를 위로 둘 수 있습니다.

🔁 라인 단위 A-B 반복 + 100LS 카운터
자막 라인을 클릭하면 그 구간만 자동 반복됩니다. 들은 횟수가 카운트되어 100번 도달까지 진행 상황을 색상으로 보여줍니다 (lime → emerald → blue → purple).

✂️ 임의 구간 반복 (CustomLoop)
A 키로 시작, B 키로 끝 마킹. 자막 cue 경계에 묶이지 않고 사용자가 원하는 어떤 구간이든 반복 가능. S 키로 라벨 저장.

✎ 자막 편집·삽입·시각 조정
Netflix 자막에 오류가 있으면 사이드 패널에서 직접 수정할 수 있습니다. 영어/한국어/메모/시작 시각/종료 시각 모두 편집 가능. ⏱ "지금" 버튼으로 영상의 현재 재생 시각을 input에 한 번에 채워 넣을 수 있어서 정확한 구간을 만들기 편합니다. 누락된 대사도 새 라인으로 추가. 한 라인을 둘로 쪼개고 싶을 땐 라인 복사 버튼으로 바로 아래에 같은 내용의 새 라인을 만들어 나눌 수 있습니다.

🎯 자막 라벨링·필터
- ⚠ 검토: 정확히 들리지 않는 자막에 마크하고 나중에 한꺼번에 보기
- ★ 중요: 몰랐던 단어/표현이 있는 라인 즐겨찾기
- ☑ 외움: 충분히 들은 라인은 외움 처리 → 나머지에 집중
- 🙈 숨김: 노래 가사·삽입곡 등 학습 대상 아닌 라인은 삭제 대신 목록에서 숨김 (되돌리기 가능)
- 헤더 토글로 각각 필터링하거나 한꺼번에 조합

🧹 라인·콘텐츠 정리
라인 호버 시 한 줄 삭제, "여러 줄 선택" 모드로 다중 선택 후 일괄 숨김/삭제. 영화 자체도 헤더 휴지통 버튼으로 자막·진도·CustomLoop까지 한 번에 정리. 시청목록 빠진 영화도 깨끗하게.

🔗 자막 공유
한 영화의 자막만(고친 내용·메모 포함, 개인 진도 제외) JSON으로 내보내 다른 사람과 공유하거나, 공유받은 자막을 불러올 수 있습니다. 넷플릭스 자막 오류를 깔끔하게 고쳐서 나눠 쓰기 좋습니다. 불러오기는 해당 영화만 추가/교체하고 다른 영화 데이터는 그대로 둡니다.

📌 자동 스크롤 + 진도 추적
영상 재생 중인 라인을 사이드 패널이 자동으로 따라가며 보여줍니다. 자동 스크롤은 토글로 ON/OFF 가능. 외움 처리한 라인은 숨기기 가능.

🔥 일일 목표 + 학습 스트릭
매일 학습 시간과 100LS 카운트 목표를 설정하면, 둘 다 채우는 날마다 스트릭이 +1. 확장 아이콘에 연속 일수가 배지로 표시됩니다. 사이드패널 🔥 버튼으로 진도/스트릭 모달 바로 열기.

⌨ 사이드패널에서도 단축키 사용 가능
영상이 아닌 사이드패널에 포커스가 있어도 단축키가 그대로 동작 (라인 편집 중일 땐 일반 입력 우선). 단축키가 헷갈리면 사이드패널 ⌨ 버튼으로 cheat sheet 모달 바로 열기.

📦 백업 / 복원
모든 학습 데이터를 JSON 파일로 내보내고 복원 가능. 다른 PC로 옮길 때나 데이터 안전성을 위해.

💾 데이터는 어디에?
모든 학습 데이터는 사용자의 브라우저 안(IndexedDB)에만 저장됩니다. 외부 서버 전송 0. 그래서 확장을 삭제하거나 다른 PC로 옮길 땐 옵션 페이지의 "백업 내보내기" 기능으로 JSON 파일을 미리 받아두세요. 새 환경에서 "백업 불러오기"로 한 번에 복원할 수 있습니다.

🎓 첫 설치 시 사용법 안내
확장을 처음 설치하면 옵션 페이지가 자동으로 열려서 10단계 시작하기 가이드를 보여줍니다. 단축키 cheat sheet도 함께.

▶ 단축키

- H: 한국어 자막 토글
- E: English 자막 토글 (H와 E 둘 다 OFF면 무자막 shadowing)
- L: 현재 라인 반복 시작/정지
- SPACE: 영상 재생 / 일시정지
- A / B: CustomLoop 시작점 / 끝점 마킹
- S: CustomLoop 라벨 저장
- ↑ / ↓: 이전/다음 라인
- ← / →: 2초 뒤로/앞으로
- R: 현재 라인 처음부터 다시
- ESC: 선택 모드 해제 / 편집 취소

▶ 개인정보

- 모든 학습 데이터는 사용자의 브라우저에만 저장됩니다 (IndexedDB).
- 외부 서버 전송 0. 분석 도구 0. 광고 없음.
- 자세한 내용: 개인정보 처리방침 참조.

▶ 지원 플랫폼

- 현재: Netflix
- 예정: Coupang Play, Disney+, TVING, YouTube (v0.3 이후)

▶ 100LS 학습법

장동완 『9등급 꼴찌, 1년 만에 통역사 된 비법』(리더스북, 2017)에서 소개된 영어 학습법으로,
같은 영화 콘텐츠를 100번 반복해서 듣고 입으로 따라 말하면서 영어 회화를 학습하는 방법입니다.
Cueloop은 이 학습법을 Netflix 환경에서 부드럽게 실행할 수 있도록 만든 도구입니다.
```

### English

```
Cueloop is an English-learning tool for the "100 Listenings & Speaking" (100LS) method — listening to a single movie 100 times and shadowing the lines.

▶ Core Features

🎬 Dual Subtitle Overlay
Shows English + Korean subtitles simultaneously over the video. Netflix's native subtitles are automatically hidden.

🟣 Global ON/OFF Toggle
The 🎬 Cueloop button on the video control bar flips the entire learning overlay on or off. Off means plain Netflix — the subtitle overlay and shortcuts all pause, so you can watch casually and switch Cueloop back on when you want to study. The button fades in and out with the control bar and collapses to just the 🎬 icon on narrow windows.

🔤 Subtitle Display Order
Show English on top / Korean below (default), or swap them from the options page. If you're learning Korean, you can put Korean on top.

🔁 Line-level A-B Repeat + 100LS Counter
Click any subtitle line to auto-repeat just that segment. Listen counts are tracked with color milestones (lime → emerald → blue → purple) up to 100.

✂️ Arbitrary Segment Repeat (CustomLoop)
Press A to mark the start, B to mark the end. Repeat any segment you want — not tied to subtitle cue boundaries. Press S to save a label.

✎ Subtitle Editing, Insertion & Timing
Fix Netflix subtitle errors directly in the side panel. Edit English / Korean / note / start time / end time. The ⏱ "Now" buttons paste the video's current playback time straight into the start/end inputs so dialing in a precise repeat range is one click. Insert missing lines too. To split one line into two, the line-duplicate button drops a copy right below so you can divide it up.

🎯 Line Labeling & Filters
- ⚠ Review: mark a line whose subtitle you can't make out, revisit them later
- ★ Important: bookmark vocabulary or expressions you want to revisit
- ☑ Memorized: mark lines you've drilled enough; hide them to focus on the rest
- 🙈 Hidden: tuck away non-dialogue lines (song lyrics, etc.) without deleting them — reversible
- Header toggles filter each independently or combine them all

🧹 Line & Content Cleanup
Hover a line for a single-line delete; the "Multi-select" mode lets you select many and bulk-hide or bulk-delete in one go. Whole movies can be wiped (subtitles + progress + CustomLoops together) from the header trash button — useful for cleaning out titles you no longer watch.

🔗 Subtitle Sharing
Export just one movie's subtitles (edits and notes included, personal progress excluded) as JSON to share with others, or import a shared set — great for distributing cleaned-up Netflix subtitles. Importing adds or replaces only that movie and leaves your other movies untouched.

📌 Auto-scroll + Progress Tracking
The side panel automatically follows the currently playing line. Auto-scroll itself is a toggle. Hide memorized lines to focus on what's left.

🔥 Daily Goals + Learning Streak
Set daily learning time and 100LS count goals. Hit both and your streak grows by 1. The streak count is displayed as a badge on the extension icon. Open the progress + streak modal anytime from the 🔥 button in the side panel header.

⌨ Shortcuts Work in the Side Panel Too
Keyboard shortcuts fire even when focus is in the side panel (typing in an input takes precedence). The ⌨ button in the side panel opens a cheat-sheet modal without having to dig into options.

📦 Backup / Restore
Export all learning data as a JSON file and restore it. For moving to another PC or data safety.

💾 Where is data stored?
All learning data is kept locally in your browser (IndexedDB). Zero external server transmission. When you uninstall the extension or move to a new PC, use "Export backup" in the options page to save a JSON file first. Restore everything in the new environment with "Import backup".

🎓 First-Run Onboarding
On first install the options page opens automatically with a 10-step "Getting Started" guide and the keyboard cheat sheet, so you never have to wonder how to begin.

▶ Keyboard Shortcuts

- H: Toggle Korean subtitle
- E: Toggle English subtitle (with both H and E off, you get no-subtitle shadowing)
- L: Start/stop current line repeat
- SPACE: Play / pause the video
- A / B: Mark CustomLoop start / end
- S: Save CustomLoop label
- ↑ / ↓: Previous / next line
- ← / →: Skip 2 seconds backward / forward
- R: Replay current line from start
- ESC: Exit multi-select mode / cancel editing

▶ Privacy

- All learning data stays in your browser (IndexedDB).
- Zero external server transmission. Zero analytics. No ads.
- See privacy policy for details.

▶ Supported Platforms

- Currently: Netflix
- Planned: Coupang Play, Disney+, TVING, YouTube (post-v0.3)

▶ About the 100LS Method

A language learning method introduced by Dong-wan Jang in "9th Grade Bottom to Translator in 1 Year" (Readers Book, 2017),
where you listen to the same movie content 100 times and shadow the lines aloud to learn English conversation.
Cueloop is a tool that makes this method smooth to execute on Netflix.
```

---

## ✓ 권한 정당화 (Permission Justification, 심사 시 필수)

각 권한에 대해 Web Store 심사관에게 설명할 텍스트:

### `storage`
```
Stores small UI preferences in chrome.storage.local so they sync instantly between the content script and the extension pages: the global ON/OFF toggle (whether the learning overlay is active) and the subtitle display order (English-on-top or Korean-on-top). All learning data (subtitles, progress, streaks) lives in the user's local IndexedDB, not in this permission. No data is sent to any server.
```

### `sidePanel`
```
Provides the learning side panel UI where users review subtitle lines, edit them, manage A-B repeat segments (CustomLoops), and track learning progress.
```

### `alarms`
```
Schedules a daily midnight alarm to update the learning streak counter. The alarm runs entirely locally with no external calls.
```

### `notifications`
```
Shows a desktop notification when the user achieves both daily learning goals (study time and 100LS repeat count). No remote notification service is used.
```

### Host permission `https://*.netflix.com/*`
```
The extension injects a dual subtitle overlay (Shadow DOM, isolated from Netflix's own CSS) on Netflix watch pages and captures the subtitle track URLs from the page's JSON data so it can fetch the subtitle files. The extension does not modify, download, or redistribute Netflix's video content — only subtitles, which are displayed back to the user in the same browser session for English-learning purposes.
```

### Host permission `https://*.nflxvideo.net/*`
```
Netflix hosts subtitle files (XML / dfxp / ttml format — text only, not video, not executable code) on its Open Connect CDN at *.nflxvideo.net. The extension's background service worker fetches only these subtitle text files from this domain to bypass page-level CORS restrictions, and stores them locally in the user's IndexedDB for learning. No video stream is accessed or downloaded.
```

### Data usage disclosure (CWS form)
| Item | Answer |
|---|---|
| Personally identifiable info | No |
| Health info | No |
| Financial info | No |
| Authentication info | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| **Website content** | **Yes** (Netflix subtitles captured and stored locally) |
| Data transferred off device | No |
| Data sold or shared | No |
| Data used for unrelated purposes | No |

### Single purpose (CWS form)
```
A tool that automates the "100 Listenings" English-learning method on Netflix. Dual subtitle overlay, line-level A-B repeat, in-place subtitle editing, and learning progress tracking are all integrated to serve this single educational purpose.
```

---

## ✓ 스크린샷 캡처 가이드

Chrome Web Store 권장 해상도: **1280×800 또는 640×400 (PNG/JPG)**. 5장 권장.

| # | 장면 | 캡처 방법 |
|---|---|---|
| 1 | **듀얼 자막 오버레이** | Netflix watch 페이지, 영어+한국어 자막 동시 표시. 화면 하단에 100LS 카운터(예: 30/100) 보이게. |
| 2 | **사이드패널 라인 리스트** | 라인 여러 줄 + 진도 색상 dot + 현재 라인 파란 highlight + ✨ 외움 후보 뱃지 / ⚠ 검토 / ★ 중요 마크가 보이는 view. |
| 3 | **CustomLoop 차별점** | 사이드패널의 "🔁 내 구간" 섹션이 펼쳐진 상태 + 보라 톤 강조. 라벨 있는 loop 2-3개. |
| 4 | **자막 편집 (차별점 #2)** | LineRow가 EditRow로 펼쳐진 상태 (영어/한국어/메모 + 시각 input + ⏱ 지금 버튼 + ⚠/★ 체크박스). |
| 5 | **사이드패널 진도 모달** | 🔥 진도 버튼 클릭으로 펼친 모달 — 스트릭 + 학습 시간/100LS 두 progress bar + 🎉 오늘 목표 달성 박스. |

**캡처 도구**: Windows 캡처 도구 (`Win + Shift + S`) 또는 OBS. 캡처 후 Photoshop/Squoosh로 1280×800으로 crop.

---

## ✓ 등록 전 체크리스트

- [x] Chrome Web Store 개발자 계정 등록 ($5 일회성) (2026-05-27)
- [x] privacy_policy 호스팅 URL 확보 → https://melanieing.github.io/cueloop/PRIVACY_POLICY (GitHub Pages, main /docs)
- [x] privacy_policy.md의 placeholder 채움 (이메일, GitHub URL — 2026-05-27)
- [x] GitHub Pages 활성화 (main /docs)
- [x] 스크린샷 5장 캡처 + ImageMagick으로 1280×800 cueloop-dark 캔버스 padding 변환
- [x] 확장 zip 파일 (`pnpm zip`) — `cueloop-0.2.0-chrome.zip` (~260 kB)
- [x] 한 줄 설명 / 상세 설명(한/영) / 권한 정당화 / 데이터 안전(💾) 항목 작성
- [x] **1차 제출** (2026-05-27) — 심사 대기 도중 UX 개선 작업 발견하여 검토 취소
- [x] **재제출** (2026-05-28) — 같은 v0.2.0, UX 개선 반영 zip + 갱신된 listing 텍스트
- [x] **v0.2.5 제출 준비** (2026-06-10) — `cueloop-0.2.5-chrome.zip`. 전역 ON/OFF 토글, 자막 표시 순서(영/한), 자동 연동 버그픽스, 토글 컨트롤바 동기화/컴팩트, OFF 안내 토스트. ⚠ **권한 추가: `storage`**(토글·자막순서 상태 저장에 실사용) → 제출 form에 위 `storage` 정당화 텍스트 입력 필수(권한 변경이라 심사 더 볼 수 있음).
- [ ] **심사 통과 대기 중** (1-3일 예상)

## ✓ 등록 후 운영 (Phase 1 모니터링) — 출시 후 시작

- [ ] **본인 unpacked → 정식 버전 데이터 이전** (출시 직후 가장 먼저):
  - unpacked 버전 옵션 페이지에서 "📥 백업 내보내기" 실행 → 안전한 곳에 보관
  - Web Store 정식 버전 설치
  - 정식 버전 옵션 페이지에서 "📤 백업 불러오기" → 동일 JSON 선택 → 복원
  - 동작 확인 후 unpacked 버전 제거 (선택)
- [ ] 본인 + 가까운 1-2명에게 공유, 첫 실사용 피드백 수집
- [ ] 매주 사용자 수 + 평점 + 리뷰 체크 (Web Store 개발자 콘솔)
- [ ] Netflix DOM 변경 발생 시 핫픽스 시간 트래킹 (목표: 48시간 내)
- [ ] 자막 ingest 실패율 모니터링 (필요시 사용자 보고용 채널 추가)
- [ ] 1~3개월 운영 후 Phase 2 (freemium 유료화) 진입 여부 결정 — KPI: 정기 사용자 수, Netflix 안정성 트랙 레코드
