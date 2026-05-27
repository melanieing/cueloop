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

🔁 라인 단위 A-B 반복 + 100LS 카운터
자막 라인을 클릭하면 그 구간만 자동 반복됩니다. 들은 횟수가 카운트되어 100번 도달까지 진행 상황을 색상으로 보여줍니다 (lime → emerald → blue → purple).

✂️ 임의 구간 반복 (CustomLoop)
A 키로 시작, B 키로 끝 마킹. 자막 cue 경계에 묶이지 않고 사용자가 원하는 어떤 구간이든 반복 가능. S 키로 라벨 저장.

✎ 자막 편집·삽입
Netflix 자막에 오류가 있으면 사이드 패널에서 직접 수정할 수 있습니다. 누락된 대사도 새 라인으로 추가 가능. 더 정확한 학습을 위해.

📌 자동 스크롤 + 진도 추적
영상 재생 중인 라인을 사이드 패널이 자동으로 따라가며 보여줍니다. 외움 처리한 라인은 숨기기 가능.

🔥 일일 목표 + 학습 스트릭
매일 학습 시간과 100LS 카운트 목표를 설정하면, 둘 다 채우는 날마다 스트릭이 +1. 확장 아이콘에 연속 일수가 배지로 표시됩니다.

📦 백업 / 복원
모든 학습 데이터를 JSON 파일로 내보내고 복원 가능. 다른 PC로 옮길 때나 데이터 안전성을 위해.

▶ 단축키

- H: 한국어 자막 토글
- L: 현재 라인 반복 시작/정지
- A / B: CustomLoop 시작점 / 끝점 마킹
- S: CustomLoop 라벨 저장
- ↑ / ↓: 이전/다음 라인
- ← / →: 2초 뒤로/앞으로
- R: 현재 라인 처음부터 다시

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

🔁 Line-level A-B Repeat + 100LS Counter
Click any subtitle line to auto-repeat just that segment. Listen counts are tracked with color milestones (lime → emerald → blue → purple) up to 100.

✂️ Arbitrary Segment Repeat (CustomLoop)
Press A to mark the start, B to mark the end. Repeat any segment you want — not tied to subtitle cue boundaries. Press S to save a label.

✎ Subtitle Editing & Insertion
Fix Netflix subtitle errors directly in the side panel. Add missing lines as new entries. For more accurate learning.

📌 Auto-scroll + Progress Tracking
The side panel automatically follows the currently playing line. Hide memorized lines to focus on what's left.

🔥 Daily Goals + Learning Streak
Set daily learning time and 100LS count goals. Hit both and your streak grows by 1. The streak count is displayed as a badge on the extension icon.

📦 Backup / Restore
Export all learning data as a JSON file and restore it. For moving to another PC or data safety.

▶ Keyboard Shortcuts

- H: Toggle Korean subtitle
- L: Start/stop current line repeat
- A / B: Mark CustomLoop start / end
- S: Save CustomLoop label
- ↑ / ↓: Previous / next line
- ← / →: Skip 2 seconds backward / forward
- R: Replay current line from start

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
Standard Chrome storage permission. Required for Dexie/IndexedDB to function. No data is sent externally.
```

### `sidePanel`
```
Provides the learning side panel UI where users review lines, edit subtitles, manage CustomLoops, and track progress.
```

### `alarms`
```
Schedules a daily midnight alarm to update the learning streak counter (no external calls — runs entirely locally).
```

### `notifications`
```
Shows a desktop notification when the user achieves their daily learning goal. No remote notification service used.
```

### Host permission `https://*.netflix.com/*`
```
Injects a dual subtitle overlay (Shadow DOM, isolated from Netflix CSS) and captures Netflix's own subtitle track URLs from the page's JSON data so the extension can fetch the subtitles. The extension does not modify, download, or redistribute Netflix's video content — only subtitles, which are displayed back to the user in the same browser session.
```

### Host permission `https://*.nflxvideo.net/*`
```
Netflix hosts subtitle files (dfxp/ttml format) on its Open Connect CDN at nflxvideo.net. The extension fetches these subtitle files from the background service worker (to bypass page-level CORS restrictions) and stores them locally in IndexedDB for the user's learning. No video stream data is accessed.
```

---

## ✓ 스크린샷 캡처 가이드

Chrome Web Store 권장 해상도: **1280×800 또는 640×400 (PNG/JPG)**. 5장 권장.

| # | 장면 | 캡처 방법 |
|---|---|---|
| 1 | **듀얼 자막 오버레이** | Netflix watch 페이지, 영어+한국어 자막 동시 표시. 화면 하단에 100LS 카운터(예: 30/100) 보이게. |
| 2 | **사이드패널 라인 리스트** | 라인 여러 줄 + 진도 색상 dot + 현재 라인 파란 highlight + ✨ 외움 후보 뱃지가 보이는 view. |
| 3 | **CustomLoop 차별점** | 사이드패널의 "🔁 내 구간" 섹션이 펼쳐진 상태 + 보라 톤 강조. 라벨 있는 loop 2-3개. |
| 4 | **자막 편집 (차별점 #2)** | LineRow가 EditRow로 펼쳐진 상태 (영어/한국어/메모 input). |
| 5 | **Popup 진도 + 스트릭** | 확장 아이콘 클릭 popup. 🔥 스트릭 + 두 progress bar + 🎉 오늘 목표 달성 박스. |

**캡처 도구**: Windows 캡처 도구 (`Win + Shift + S`) 또는 OBS. 캡처 후 Photoshop/Squoosh로 1280×800으로 crop.

---

## ✓ 등록 전 체크리스트

- [ ] Chrome Web Store 개발자 계정 등록 ($5 일회성)
- [ ] privacy_policy 호스팅 URL 확보 (GitHub Pages / Notion / 개인 도메인)
- [x] privacy_policy.md의 placeholder 채움 (이메일, GitHub URL — 2026-05-27)
- [x] GitHub Pages 활성화 (main /docs) → https://melanieing.github.io/cueloop/PRIVACY_POLICY
- [ ] 스크린샷 5장 캡처
- [ ] 확장 zip 파일 (`pnpm zip` — wxt가 자동 생성)
- [ ] 한 줄 설명 / 상세 설명 / 권한 정당화 텍스트 복붙 준비
- [ ] 첫 등록 후 심사 대기 (보통 1-3일, 새 확장은 더 길 수 있음)

## ✓ 등록 후 운영 (Phase 1 모니터링)

- [ ] 매주 사용자 수 + 평점 + 리뷰 체크
- [ ] Netflix DOM 변경 발생 시 핫픽스 시간 트래킹 (목표: 48시간 내)
- [ ] 자막 ingest 실패율 모니터링 (필요시 사용자 보고용 채널 추가)
- [ ] 1~3개월 운영 후 Phase 2 (freemium 유료화) 진입 여부 결정
