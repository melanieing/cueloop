# Cueloop

> 영화 한 편을 100번 듣고 따라 말하는 영어 학습법(100LS)을 위한 Netflix Chrome 확장
> Chrome extension that automates the "100 Listenings & Speaking" English-learning method on Netflix

**[🇰🇷 한국어](#-한국어) · [🇺🇸 English](#-english)**

---

## 🇰🇷 한국어

### 한 줄 소개

Netflix 위에 **듀얼 자막 + 라인 단위 A-B 반복 + 100회 카운터**를 제공하는 Chrome 확장. 자막을 직접 편집할 수도 있고, 자막 cue 경계에 묶이지 않는 임의 구간 반복(CustomLoop)도 가능합니다.

### 왜 만들었나

"같은 영화 콘텐츠를 100번 반복해서 듣고 입으로 따라 말하면 영어 회화를 익힐 수 있다" — 장동완 『9등급 꼴찌, 1년 만에 통역사 된 비법』(리더스북, 2017)에서 소개한 **100LS(One Hundred Listenings & Speaking) 학습법**의 도구가 시중에 부족해서 직접 만들었습니다.

### Language Reactor 대비 차별점

이미 [Language Reactor](https://chrome.google.com/webstore/detail/language-reactor/hoombieeljmmljlkjmnheibnpciblicm)(LR)를 사용 중이라면 두 가지 부족함이 있을 거예요:

| 차별점 | LR | Cueloop |
|---|---|---|
| **임의 구간 반복** (CustomLoop) | 자막 cue 단위만 가능 | A/B 키로 어떤 구간이든 마킹 + 반복. 한 라인의 절반만, 두 라인에 걸친 구간만, 자막 없는 구간만 — 모두 가능 |
| **자막 편집·삽입** | 읽기 전용 | Netflix 자막 오류 수정 + 누락 대사 직접 추가. 사용자가 더 정확한 학습 자료를 만들어감 |

### 핵심 기능

- 🎬 **듀얼 자막 오버레이** — 영어 + 한국어 자막을 영상 위에 동시 표시. Netflix 자체 자막은 자동 숨김. `H`/`E` 키로 각각 토글 (둘 다 OFF면 무자막 shadowing).
- 🟣 **전역 ON/OFF 토글** — 영상 컨트롤바의 `🎬 Cueloop` 버튼으로 학습 오버레이를 한 번에 켜고 끔. 끄면 자막 오버레이·단축키가 모두 멈춰 평소 넷플릭스 그대로(가볍게 볼 때). 버튼은 컨트롤바와 함께 나타났다 사라지고, 좁은 화면(<1241px)에선 🎬 아이콘만. OFF 상태에서 사이드패널 라인을 누르면 켜라는 안내가 표시됩니다.
- 🔤 **자막 표시 순서 선택** — 옵션에서 영어 위 / 한국어 위 전환 (기본: 영어 위). 한국어를 배우는 외국인은 한국어를 위로 둘 수 있습니다. 오버레이·사이드패널에 즉시 반영.
- 🔁 **라인 단위 A-B 반복** — 사이드패널 라인의 🔁 클릭 또는 `L` 키. 들은 횟수가 자동 카운트되며 진도 색상으로 표시 (lime → emerald → blue → purple).
- ✂️ **CustomLoop** — `A` 시작 마킹 → `B` 끝 마킹 → `S` 라벨. 자막 cue 무관, 임의 구간 반복.
- ✎ **자막 편집·삽입·시각 조정·복사** — 라인 클릭 → 영어/한국어/메모/시작·종료 시각 모두 수정. ⏱ "지금" 버튼으로 영상 현재 시각을 input에 한 번에. 새 라인 추가, 라인 복사(분할용)도 가능.
- 🎯 **라인 라벨링·필터** — ⚠ 검토(부정확 자막) / ★ 중요(몰랐던 표현) / ☑ 외움 / 🙈 숨김(노래 가사 등) 별도 마크 + 헤더에서 각각 필터링.
- 🧹 **라인·콘텐츠 정리** — 라인 hover 시 단일 삭제, "여러 줄 선택" 모드로 다중 선택 후 일괄 숨김/삭제, 영화 자체도 헤더 휴지통으로 자막·진도까지 통째로 삭제.
- 🔗 **자막 공유** — 한 영화의 자막만(고친 내용·메모 포함, 개인 진도 제외) JSON으로 내보내 공유하거나 불러오기. 깔끔하게 고친 넷플릭스 자막을 나눠 쓰기. 불러오기는 해당 영화만 추가/교체(다른 영화 데이터 안전).
- 📌 **자동 스크롤 + 진도 추적** — 현재 재생 중인 라인이 사이드패널 자동 follow. 토글 ON/OFF. 외운 라인 숨기기 별도 토글. 통계에 외움 비율(외움/(전체−숨김)) 표시.
- 🔥 **일일 목표 + 학습 스트릭** — 학습 시간/100LS 카운트 둘 다 채우면 스트릭 +1. 확장 아이콘에 연속 일수 배지. 사이드패널 🔥 버튼으로 진도 모달 바로 열기.
- ⌨ **사이드패널에서도 단축키** — 영상이 아닌 사이드패널에 포커스가 있어도 단축키 동작 (편집 중일 땐 입력 우선). ⌨ 버튼으로 cheat sheet 모달 바로.
- 📦 **백업/복원** — 모든 학습 데이터 JSON 파일로 export/import. 다른 PC 이전 시 또는 안전성.
- 🎓 **첫 설치 onboarding** — 옵션 페이지에 10단계 시작하기 가이드 + 단축키 cheat sheet 자동 노출.

### 단축키 (Netflix 페이지 또는 사이드패널에서)

| 키 | 동작 |
|---|---|
| `H` | 한국어 자막 표시/숨김 토글 |
| `E` | English 자막 표시/숨김 토글 (둘 다 끄면 무자막 shadowing) |
| `L` | 현재 라인 반복 시작/정지 |
| `SPACE` | 영상 재생 / 일시정지 |
| `A` / `B` | CustomLoop 시작점 / 끝점 마킹 |
| `S` | 진행 중인 CustomLoop에 라벨 저장 |
| `↑` / `↓` | 이전 / 다음 라인으로 점프 |
| `←` / `→` | 2초 뒤로 / 앞으로 |
| `R` | 현재 라인 처음부터 다시 |
| `ESC` | 다중 선택 모드 해제 / 편집 취소 |

라인 텍스트 편집 모드에선 일반 입력이 우선합니다.

### 🔒 개인정보

- **모든 학습 데이터는 사용자 브라우저의 IndexedDB에만 저장**됩니다.
- 외부 서버 전송 0. 분석/트래킹 도구 0. 광고 없음.
- 자세한 사항은 [개인정보 처리방침](https://melanieing.github.io/cueloop/PRIVACY_POLICY)을 참고하세요.

### 설치

> Chrome Web Store 출시 심사 진행 중 (2026-05). 통과 후 본 섹션에 링크 갱신 예정.

개발 빌드(unpacked)를 직접 로드하려면 [개발 셋업](#개발-셋업) 참고.

### 데이터 안전 안내

학습 데이터는 다음 경우 사라질 수 있습니다:

- 확장 프로그램 삭제(uninstall)
- 브라우저 데이터 전체 삭제
- 다른 PC / 다른 브라우저 프로필로 이전
- 디스크 손상 / OS 재설치

→ 옵션 페이지의 **"📥 백업 내보내기"**로 JSON 파일을 정기 백업하세요. 새 환경에서 **"📤 백업 불러오기"**로 복원합니다.

### 지원 플랫폼

- ✅ Netflix (현재)
- 🛠️ Coupang Play, Disney+, TVING, YouTube — v0.3 이후 어댑터 추가 예정

### 개발 셋업

```bash
# 사전 요구: Node 22+, pnpm
pnpm install
pnpm build        # 프로덕션 빌드
pnpm dev          # 개발 (Chrome 자동 로드 — WSL2에선 작동 안 함)
pnpm zip          # Web Store용 zip 생성
pnpm tsc --noEmit # 타입 체크
```

빌드 결과는 `.output/chrome-mv3/`에 생성됩니다. Chrome에서 `chrome://extensions` → 개발자 모드 → 압축해제된 확장 프로그램 로드 → 해당 폴더 선택.

### 기술 스택

- **빌드**: [WXT](https://wxt.dev/) 0.20 (Vite 8 기반)
- **프레임워크**: React 19 + TypeScript (strict)
- **스타일**: Tailwind CSS v4
- **저장소**: Dexie.js 4 (IndexedDB 래퍼) + dexie-react-hooks
- **메시지**: Chrome MV3 + 타입 안전한 discriminated union

### FAQ

**Q. 새 영화를 켰는데 자막이 안 나오고 사이드패널이 이전 영화로 멈춰 있어요.**
페이지를 한 번 **새로고침(F5)** 해보세요. Netflix는 페이지를 새로 불러오지 않고 화면만 바꾸는 방식(SPA)이라, 목록에서 영화로 들어갈 때 가끔 Cueloop이 새 영화를 제때 못 잡습니다. 새로고침하면 새 영화 자막을 정상 수집하고 사이드패널도 갱신됩니다.

**Q. 콘텐츠를 어떻게 구분하나요? 같은 영화인데 진도가 0이 됐어요.**
Cueloop은 Netflix 영상 고유 번호(`netflix.com/watch/70283145`의 숫자)로 콘텐츠를 구분합니다. 영화 1편·에피소드 1화마다 고유 번호가 있고, 시청목록에서 빼거나 복습으로 다시 봐도 번호는 안 바뀌어서 진도가 이어집니다. 단 Netflix 재계약·다른 국가 카탈로그·다른 버전(감독판 등)이면 번호가 달라질 수 있습니다 (드문 경우).

**Q. 제목이 "Netflix 12345"처럼 보여요.**
Netflix가 재생 페이지에선 제목을 제공하지 않습니다. 사이드패널 상단 `✎ 제목` 버튼으로 직접 입력하세요.

**Q. select 박스에 쓰레기 콘텐츠가 쌓여요.**
실제 `/watch/` 페이지에 진입한 콘텐츠만 추가됩니다 (브라우즈 hover 미리보기는 무시). 이미 쌓인 항목은 select 박스 옆 🗑 버튼으로 삭제하세요.

---

## 🇺🇸 English

### TL;DR

A Chrome extension that overlays Netflix with **dual subtitles + line-level A-B repeat + 100-listen counter**. You can edit subtitles in place and create custom A-B segments that aren't bound to subtitle cue boundaries (CustomLoop).

### Why this exists

The "**One Hundred Listenings & Speaking**" (100LS) method — listening to the same movie 100 times while shadowing the lines aloud, popularized in Korean ELT literature — lacked a dedicated tool on Netflix, so I built one.

### What sets Cueloop apart from Language Reactor

Two specific limitations of [Language Reactor](https://chrome.google.com/webstore/detail/language-reactor/hoombieeljmmljlkjmnheibnpciblicm) drove this project:

| Feature | LR | Cueloop |
|---|---|---|
| **Arbitrary-segment repeat** (CustomLoop) | Only at subtitle cue boundaries | `A`/`B` mark any segment — half of one line, across two lines, or subtitle-less stretches |
| **Subtitle editing & insertion** | Read-only | Fix Netflix subtitle errors and add missing lines yourself. Build a more accurate learning script over time |

### Core features

- 🎬 **Dual subtitle overlay** — English + Korean simultaneously. Netflix's native subtitles are auto-hidden. `H`/`E` keys toggle each (turn off both for no-subtitle shadowing).
- 🟣 **Global ON/OFF toggle** — The `🎬 Cueloop` button on the video control bar flips the whole learning overlay on or off. Off = plain Netflix (overlay and shortcuts pause) for casual watching. It fades in/out with the control bar and collapses to just the 🎬 icon on narrow windows (<1241px). Clicking a side-panel line while off shows a hint to turn it back on.
- 🔤 **Subtitle display order** — Swap English-on-top / Korean-on-top in options (English on top by default). Learning Korean? Put Korean on top. Applies to the overlay and side panel instantly.
- 🔁 **Line-level A-B repeat** — Click the line's 🔁 in the side panel or hit `L`. Listen counts increment with color milestones (lime → emerald → blue → purple) up to 100.
- ✂️ **CustomLoop** — `A` mark start → `B` mark end → `S` save label. Repeat any segment, regardless of subtitle cues.
- ✎ **Subtitle editing, insertion, timing & duplicate** — Click a line to edit English/Korean/note/start time/end time. The ⏱ "Now" buttons paste the video's current time straight in. Insert new lines, or duplicate a line (to split it in two).
- 🎯 **Line labeling & filters** — ⚠ Review (inaccurate subtitle) / ★ Important (vocab worth revisiting) / ☑ Memorized / 🙈 Hidden (song lyrics, etc.) — independent marks, each with a header filter.
- 🧹 **Line & content cleanup** — Hover a line for single-line delete; "multi-select" mode to bulk hide or delete; whole movies wiped from the header trash (subtitles + progress + CustomLoops together).
- 🔗 **Subtitle sharing** — Export just one movie's subtitles (edits + notes included, personal progress excluded) as JSON to share, or import a shared set — for distributing cleaned-up Netflix subtitles. Import adds/replaces only that movie, leaving your other movies untouched.
- 📌 **Auto-scroll + progress tracking** — Side panel follows the currently playing line. Auto-scroll itself is a toggle. Hide-memorized is a separate filter. The stats line shows the memorized ratio (memorized / (total − hidden)).
- 🔥 **Daily goals + streak** — Hit both daily learning-time and 100LS-count goals to grow your streak. Streak count displayed as a badge on the extension icon. The 🔥 button opens the progress modal anytime.
- ⌨ **Shortcuts in the side panel too** — Keyboard shortcuts fire even when focus is in the side panel (typing in an input takes precedence). The ⌨ button opens a cheat-sheet modal.
- 📦 **Backup / restore** — Export all learning data to a JSON file and re-import. For moving between PCs or general safety.
- 🎓 **First-run onboarding** — Options page opens automatically on install with a 10-step guide and the keyboard cheat sheet.

### Keyboard shortcuts (Netflix page or side panel)

| Key | Action |
|---|---|
| `H` | Toggle Korean subtitle |
| `E` | Toggle English subtitle (turn off both for no-subtitle shadowing) |
| `L` | Start/stop current-line repeat |
| `SPACE` | Play / pause the video |
| `A` / `B` | Mark CustomLoop start / end |
| `S` | Save label on the active CustomLoop |
| `↑` / `↓` | Previous / next line |
| `←` / `→` | Skip 2 seconds back / forward |
| `R` | Replay current line from the beginning |
| `ESC` | Exit multi-select mode / cancel editing |

In line edit mode, normal input takes precedence.

### 🔒 Privacy

- **All learning data is stored locally in your browser's IndexedDB**.
- Zero external server transmission. Zero analytics/tracking. No ads.
- See the [Privacy Policy](https://melanieing.github.io/cueloop/PRIVACY_POLICY) for details.

### Install

> Chrome Web Store review in progress (May 2026). This section will be updated with a direct link once published.

To load the development build (unpacked) directly, see [Development setup](#development-setup).

### Data-safety notes

Your learning data can be lost in these situations:

- Uninstalling the extension
- Clearing all browser data
- Moving to a different PC or browser profile
- Disk failure / OS reinstall

→ Use the options page's **"📥 Export backup"** to download a JSON file regularly. Restore in a new environment with **"📤 Import backup"**.

### Supported platforms

- ✅ Netflix (current)
- 🛠️ Coupang Play, Disney+, TVING, YouTube — adapters planned for v0.3+

### Development setup

```bash
# Prereq: Node 22+, pnpm
pnpm install
pnpm build        # production build
pnpm dev          # dev mode (auto-loads Chrome — doesn't work in WSL2)
pnpm zip          # generate Web Store zip
pnpm tsc --noEmit # typecheck
```

Build output lands in `.output/chrome-mv3/`. In Chrome, go to `chrome://extensions` → Developer mode → "Load unpacked" → select that folder.

### Tech stack

- **Build**: [WXT](https://wxt.dev/) 0.20 (Vite 8)
- **Framework**: React 19 + TypeScript (strict)
- **Styling**: Tailwind CSS v4
- **Storage**: Dexie.js 4 (IndexedDB wrapper) + dexie-react-hooks
- **Messaging**: Chrome MV3 + typed discriminated unions

### FAQ

**Q. I opened a new movie but no subtitles show and the side panel is stuck on the previous one.**
Try **refreshing the page (F5)**. Netflix is a single-page app that swaps the screen without a full reload, so when you go from the list into a movie, Cueloop occasionally doesn't catch the new title in time. A refresh makes it capture the new movie's subtitles and updates the side panel.

**Q. How are titles identified? My progress reset for the same movie.**
Cueloop identifies content by Netflix's video ID (the number in `netflix.com/watch/70283145`). Each movie / episode has a unique number, and it doesn't change when you remove it from My List or rewatch — so progress carries over. It *can* differ if Netflix re-licenses the content, or across regional catalogs / different versions (director's cut, etc.) — rare cases.

**Q. The title shows as "Netflix 12345".**
Netflix doesn't expose the title on the watch page. Use the `✎ 제목` (title) button at the top of the side panel to enter it once.

**Q. Junk content keeps piling up in the dropdown.**
Only content you actually open at a `/watch/` page is added (browse-page hover previews are ignored). Delete existing junk with the 🗑 button next to the dropdown.

---

## License & Contributing

Source available, personal/learning use. Pull requests welcome for bugfixes and small features. For larger contributions, please open an issue first to discuss.

Contact: melanie0617@gmail.com
