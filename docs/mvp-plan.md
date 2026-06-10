# 100LS Chrome Extension MVP 개발 계획 (v0.2)

> **스코프 변경 이력**:
> - v0.1: Tauri 2 로컬 데스크톱 앱 + BYOC (영화 파일 직접 보유)
> - **v0.2: Chrome Extension (Manifest V3) + Netflix 오버레이 + 멀티 OTT 확장 + Chrome Web Store 공개 준비**

---

## 1. 결정 사항

### 1.1 스코프
- **1차 타겟: Netflix 단일 플랫폼** (검증 속도 우선)
- **확장 가능 구조**: 검증 후 Coupang Play, TVING, Disney+ 단계적 추가
- **배포**: 초기에는 비공개 unpacked 본인 사용 → 검증 후 Chrome Web Store 공개
- 영어 → 한국어 학습 (한국어 모어 화자가 영어를 배우는 수요)

### 1.2 빠진 것 (의도적으로 v0.2에서 안 만드는 것)
- ❌ 비디오 파일 직접 다루기 (BYOC 모델 폐기 — 사용자가 Netflix 보면서 학습)
- ❌ 콘텐츠 자체 호스팅 (DRM 우회 0, 비디오 데이터 0)
- ❌ Whisper/DeepL/Azure API (자막은 Netflix가 제공, 한국어는 사용자 직접 입력)
- ❌ 멀티유저 / 결제 / 클라우드 동기화
- ❌ Wavve 지원 (메이저 확장 중 Wavve 지원 부재 — R&D 리스크 큼)
- ❌ AI 발음 채점 (자가 평가로 갈음)

### 1.3 만드는 것 (핵심 기능)
1. Netflix 페이지에 자동 주입되는 듀얼 자막 오버레이
2. 자막 라인 클릭 → A-B 자동 반복 + **100LS 카운터**
2a. **CustomLoop (사용자 임의 A-B 구간)**: 자막 cue 경계에 묶이지 않는 임의 구간을 A/B 키로 잡고 반복. 자체 100LS 카운터 분리 운영. **Cueloop의 LR 대비 핵심 차별점** (2026-05-26 추가)
3. 사용자가 자막을 직접 **편집·삽입** (영어/한국어 텍스트, 타이밍 수정 + Netflix가 놓친 대사 신규 추가. **"Netflix 자막보다 더 정확하다"는 v0.2 차별점**. 2026-05-26 보강)
4. 받아쓰기(Dictation) 모드
5. 녹음(Shadowing) 모드 + 자가 평가
6. 일일 목표 + 퀘스트 + 스트릭
7. Chrome Web Store 공개를 위한 약관·개인정보 처리방침
8. **자막 라벨링·필터 + 라인·콘텐츠 정리 + 자막 공유** (☑외움/⚠검토/★중요/🙈숨김, 다중 선택 일괄 숨김/삭제, 영화 단위 자막 export/import. 2026-06 보강)
9. **전역 ON/OFF 토글** (영상 컨트롤바 `🎬 Cueloop` 버튼 — LR처럼 끄면 그냥 넷플릭스. 가벼운 시청용. 상태 `chrome.storage.local`. v0.2.5, 2026-06-10 추가)
10. **자막 표시 순서 선택** (영어 위/한국어 위 — 한국어 학습자 대응. 다국어는 v0.3. v0.2.5, 2026-06-10 추가)

### 1.4 스택 (2026 현행 검증)
| 영역 | 선택 | 근거 |
|---|---|---|
| **빌드 도구** | **WXT** | 2026 컨센서스 시장 리더(extensionbooster.com, redreamality.com, blog.park-labs.com). Framework-agnostic, Vite 기반, 가장 작은 번들, 최고 HMR, 활발한 유지보수. **Plasmo/CRXJS는 유지보수 둔화로 제외** |
| Manifest 버전 | **V3** | 2025년부터 의무. MV2는 Chrome 139+에서 자동 비활성화 |
| UI | **React 19 + TypeScript** | 표준. WXT가 React 템플릿 제공 |
| 스타일 | **Tailwind CSS v4** | `@import "tailwindcss";` 한 줄로 작동. v3 설정 방식과 다름 |
| 로컬 DB | **Dexie.js (IndexedDB)** | `chrome.storage.local` 5MB 제한으로 자막+녹음+학습 데이터에 부족. Dexie는 IndexedDB 최상위 래퍼, 수십 GB 가능 |
| 상태관리 | **Zustand** | 가벼움. 사이드 패널·콘텐츠 스크립트 간 동기화는 Dexie observable로 |
| 자막 데이터 수집 | **`JSON.parse` hijack 패턴** | Netflix의 `timedtexttracks` 응답을 가로채는 검증된 방식. Greasyfork에 코드 공개. DRM 우회 아님 |
| 비디오 제어 | **Netflix `<video>` element에 직접 ref** | Netflix 자체 플레이어가 비디오 재생, 우리는 `currentTime`만 조작 |
| 자막 파싱 | **`subtitle` (npm)** + dfxp 파서 | Netflix는 dfxp/TTML 형식, 별도 파싱 필요 |

---

## 2. 아키텍처 (Manifest V3 분리)

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Chrome)                        │
│                                                              │
│  ┌────────────────────────────────────┐                     │
│  │  Netflix Page (https://netflix.com/watch/...)            │
│  │                                                          │
│  │  ┌──────────────┐    ┌────────────────────────────┐    │
│  │  │ Netflix       │    │  Our Content Script         │    │
│  │  │ <video> ─────┼────┤  - DOM mutation observer    │    │
│  │  │ player        │    │  - Subtitle overlay 마운트  │    │
│  │  │              │    │  - currentTime 조작 (A-B)   │    │
│  │  └──────────────┘    │  - 단축키 캡처              │    │
│  │                       └─────────┬───────────────────┘    │
│  │                                  │ CustomEvent           │
│  │  ┌────────────────────────────────▼──────────────────┐  │
│  │  │  Injected Script (page world, document_start)      │  │
│  │  │  - JSON.parse hijack → timedtexttracks 가로채기   │  │
│  │  └────────────────────────────────────────────────────┘  │
│  └──────────────────────────────────────────────────────────┘
│                              │ chrome.runtime.sendMessage    │
│                              ▼                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Background Service Worker                              │ │
│  │  - 메시지 라우팅                                        │ │
│  │  - 일자 롤오버, 스트릭 처리 (chrome.alarms)             │ │
│  │  - 자막 dfxp 다운로드 (CORS bypass)                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                                │
│  ┌──────────────┐  ┌─────────▼─────────┐  ┌──────────────┐  │
│  │ Popup        │  │ Side Panel          │  │ Options      │  │
│  │ (오늘 진도,  │  │ (라인 리스트,       │  │ (목표 설정,  │  │
│  │  스트릭)     │  │  편집,받아쓰기,녹음)│  │  단축키,백업)│  │
│  └──────────────┘  └─────────────────────┘  └──────────────┘  │
│                              │                                │
│                              ▼                                │
│              ┌────────────────────────────┐                  │
│              │ IndexedDB (Dexie)          │                  │
│              │ - contents, lines,         │                  │
│              │   lineProgress, sessions,  │                  │
│              │   dailyGoals, streak,      │                  │
│              │   recordings(Blob), settings│                  │
│              └────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 Entrypoints (WXT 파일 기반 라우팅)

```
entrypoints/
├── background.ts              # Service Worker
├── content.ts                 # Netflix 페이지 주입
├── injected.ts                # Page world 주입 (JSON hijack)
├── popup/                     # 오늘 진도 + 스트릭
│   ├── index.html
│   └── App.tsx
├── sidepanel/                 # 메인 학습 UI
│   ├── index.html
│   └── App.tsx
└── options/                   # 설정 + 백업
    ├── index.html
    └── App.tsx
```

---

## 3. 플랫폼 어댑터 추상화 (멀티 OTT 확장 대비)

핵심: Netflix 의존 코드를 **`PlatformAdapter` 인터페이스 뒤에** 격리. v0.3에서 Coupang Play, TVING, Disney+ 어댑터를 추가할 때 핵심 로직(A-B 반복, 카운터, 받아쓰기, 녹음)은 손대지 않는다.

```typescript
// src/platforms/types.ts
export interface PlatformAdapter {
  readonly id: 'netflix' | 'coupang' | 'tving' | 'disney_plus';
  readonly hostPatterns: RegExp[];

  /** 페이지가 비디오 재생 준비 완료될 때까지 대기 */
  waitForReady(): Promise<void>;

  /** Netflix <video> element 반환. 없으면 null */
  getVideoElement(): HTMLVideoElement | null;

  /** 플랫폼별 자막 데이터를 표준 형식으로 반환 */
  getSubtitleTracks(): Promise<SubtitleTrack[]>;

  /** 플랫폼 자체 자막 숨김 (우리 오버레이만 보이도록) */
  hideNativeSubtitles(): void;

  /** 콘텐츠 고유 식별자 (예: Netflix watchId) */
  getContentId(): string;

  /** 콘텐츠 메타데이터 (제목, 시즌, 에피소드) */
  getContentMetadata(): Promise<ContentMetadata>;
}

export interface SubtitleTrack {
  language: string;        // 'en', 'ko' 등
  label: string;
  cues: SubtitleCue[];
}

export interface SubtitleCue {
  startMs: number;
  endMs: number;
  text: string;
}

export interface ContentMetadata {
  title: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  durationSec?: number;
}
```

```typescript
// src/platforms/index.ts
import { NetflixAdapter } from './netflix';
// import { CoupangAdapter } from './coupang';  // v0.3

const adapters: PlatformAdapter[] = [
  new NetflixAdapter(),
  // new CoupangAdapter(),
];

export function detectAdapter(url: string): PlatformAdapter | null {
  return adapters.find(a => a.hostPatterns.some(p => p.test(url))) ?? null;
}
```

---

## 4. Netflix 자막 데이터 수집 (핵심 기술)

DRM은 비디오 스트림에만 적용되고 자막은 평문 dfxp/TTML. 수집 흐름:

```
1. content script가 document_start에 page world로 inject script 주입
2. inject script가 JSON.parse 오버라이드
3. Netflix가 manifest 응답을 파싱할 때 우리가 가로챔
   → result.timedtexttracks[]에 자막 URL 리스트
4. inject script가 CustomEvent로 content script에 전달
5. content script가 background로 메시지 → CORS bypass로 dfxp 다운로드
6. 자막 파서로 cue 배열 변환 → IndexedDB 저장
```

```typescript
// entrypoints/injected.ts (page world)
const originalParse = JSON.parse;
JSON.parse = function (text: string, reviver?: any) {
  const data = originalParse(text, reviver);
  if (data?.result?.timedtexttracks && data?.result?.movieId) {
    window.dispatchEvent(new CustomEvent('lp100/timedtext', {
      detail: { movieId: data.result.movieId, tracks: data.result.timedtexttracks }
    }));
  }
  return data;
};
```

```typescript
// entrypoints/content.ts (isolated world)
window.addEventListener('lp100/timedtext', (e: any) => {
  const { movieId, tracks } = e.detail;
  chrome.runtime.sendMessage({
    type: 'TIMEDTEXT_CAPTURED',
    payload: { movieId, tracks }
  });
});
```

```typescript
// entrypoints/background.ts (service worker)
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'TIMEDTEXT_CAPTURED') {
    const { movieId, tracks } = msg.payload;
    // tracks에서 영어 자막 URL 추출 → fetch → dfxp 파싱 → DB 저장
    const enTrack = tracks.find(t => t.language === 'en');
    const dfxp = await fetch(enTrack.ttDownloadables['dfxp-ls-sdh'].urls[0].url).then(r => r.text());
    const cues = parseDfxp(dfxp);
    await db.lines.bulkAdd(cues.map((c, i) => ({
      contentId: movieId, seq: i + 1, startMs: c.start, endMs: c.end,
      textEn: c.text, textKo: ''
    })));
  }
});
```

---

## 5. 데이터 모델 (IndexedDB / Dexie)

```typescript
// src/db.ts
import Dexie, { Table } from 'dexie';

export interface Content {
  id?: number;
  platform: 'netflix' | 'coupang' | 'tving' | 'disney_plus';
  contentId: string;           // Netflix watchId 등
  title: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  totalDurationSec?: number;
  createdAt: number;
}

export interface Line {
  id?: number;
  contentId: number;            // FK → Content.id
  seq: number;                  // Netflix 원본 순서. 사용자 삽입 라인은 인접 라인 seq 복사 (정렬은 startMs 기준)
  startMs: number;
  endMs: number;
  textEn: string;
  textKo: string;
  note?: string;
  source: 'platform' | 'user';  // 'platform' = Netflix 원본, 'user' = 사용자가 신규 삽입
  editedAt?: number;            // 마지막 사용자 편집 시각. undefined면 무손댐
}

export interface LineProgress {
  lineId: number;               // PK = Line.id
  listenCount: number;
  dictationAttempts: number;
  dictationCorrect: number;
  shadowCount: number;
  isMemorized: 0 | 1;
  lastListenedAt?: number;
  lastDictatedAt?: number;
}

export interface DailyGoal {
  date: string;                 // PK 'YYYY-MM-DD'
  targetMinutes: number;
  targetListens: number;
  achievedMinutes: number;
  achievedListens: number;
  completed: 0 | 1;
}

export interface Streak {
  id: 1;                        // singleton
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate?: string;
}

export interface Session {
  id?: number;
  contentId: number;
  startedAt: number;
  endedAt?: number;
  activeSeconds: number;
}

export interface Recording {
  id?: number;
  lineId: number;
  blob: Blob;
  durationMs: number;
  selfRating?: 1 | 2 | 3;
  createdAt: number;
}

export interface CustomLoop {
  id?: number;
  contentId: number;            // FK → Content.id
  startMs: number;              // 비디오 절대 timestamp (라인 경계 무관)
  endMs: number;
  label?: string;               // 사용자가 지은 이름 (옵션)
  listenCount: number;          // 이 구간 자체 100LS 카운터 (Line과 독립)
  isMemorized: 0 | 1;
  createdAt: number;
  lastListenedAt?: number;
}

export interface Setting {
  key: string;                  // PK
  value: unknown;               // caller에서 narrowing
}

export class CueloopDb extends Dexie {
  contents!: Table<Content, number>;
  lines!: Table<Line, number>;
  lineProgress!: Table<LineProgress, number>;
  customLoops!: Table<CustomLoop, number>;
  dailyGoals!: Table<DailyGoal, string>;
  streak!: Table<Streak, number>;
  sessions!: Table<Session, number>;
  recordings!: Table<Recording, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('cueloop');
    this.version(1).stores({
      contents: '++id, &[platform+contentId], platform, createdAt',
      lines: '++id, contentId, [contentId+seq], [contentId+startMs]',
      lineProgress: 'lineId, isMemorized, lastListenedAt',
      customLoops: '++id, contentId, [contentId+startMs], lastListenedAt',
      dailyGoals: 'date, completed',
      streak: 'id',
      sessions: '++id, contentId, startedAt',
      recordings: '++id, lineId, createdAt',
      settings: 'key',
    });
  }
}

export const db = new CueloopDb();
```

---

## 6. 일정 — Day-by-Day (총 14일, 하루 1-3시간)

### Day 1: WXT 환경 셋업 + 기본 entrypoints (2h)
```bash
pnpm create wxt@latest lp100
# Framework: React, TypeScript: yes
cd lp100
pnpm install
pnpm install dexie zustand subtitle
pnpm install -D tailwindcss @tailwindcss/vite
pnpm dev   # Chrome이 자동으로 unpacked 로드
```
- `wxt.config.ts`에 manifest 메타데이터 + permissions 작성
- `entrypoints/` 디렉토리에 background/content/popup/sidepanel/options 스켈레톤
- `host_permissions: ["https://*.netflix.com/*"]` — `<all_urls>` 절대 안 됨

### Day 2: Dexie 스키마 + 플랫폼 어댑터 인터페이스 (2h)
- `src/db.ts` 작성 (§5 그대로)
- `src/platforms/types.ts` 작성 (§3 그대로)
- 빈 `NetflixAdapter` 클래스 (Day 3에 채움)
- 메시지 타입 정의 (`src/messages.ts`)

### Day 3: Netflix 자막 데이터 가로채기 (3h)
- `entrypoints/injected.ts`: JSON.parse hijack (§4)
- `entrypoints/content.ts`: page world에 inject script 주입 + CustomEvent 리스닝
- `entrypoints/background.ts`: dfxp 다운로드 + 파싱 + DB 저장
- dfxp 파서: 간단한 XML → cue[] (Netflix는 `<p begin="00:00:01.234" end="...">` 형식)
- **머지 정책**: 같은 `contentId`로 자막 재수집 시 → `source: 'user'` 또는 `editedAt` 있는 라인은 보존, Netflix-only 라인 중 변경된 것만 갱신 (사용자 편집 보호)
- 테스트: 영화 1편 열어서 콘솔에 자막 cue 배열 출력 확인

### Day 4: 사이드 패널 자막 편집 UI (3h, 2026-05-26 스코프 확장)
- chrome.sidePanel API 등록 (manifest에 `side_panel.default_path`)
- 사이드 패널이 열리면 현재 활성 탭의 contentId 확인 → 해당 lines 로드 (정렬은 startMs 기준)
- `@tanstack/react-virtual`로 라인 리스트 가상 스크롤
- 인라인 편집: textEn, textKo, note, startMs, endMs (onBlur로 Dexie put + `editedAt = Date.now()` 갱신)
- **라인 사이 `+` 버튼** → 새 라인 삽입 모달 (startMs/endMs/textEn/textKo 입력, `source: 'user'`로 저장. 인접 라인 seq 복사)
- **시각 뱃지**: 편집된 라인엔 펜 아이콘(`editedAt` 있음), 사용자 추가 라인엔 별도 색/뱃지(`source: 'user'`)
- 이 시점에서 **한국어 자막 직접 입력 작업 + Netflix 자막 오류 수정/누락 보강**이 시작 가능

### Day 5: 비디오 제어 + 듀얼 자막 오버레이 (3h)
- MutationObserver로 `<video>` element 등장 대기
- Netflix 자체 자막 hide: `document.querySelectorAll('.player-timedtext').forEach(el => el.style.display = 'none')`
- React Portal로 video 위에 자체 자막 div 마운트 (position: absolute, bottom)
- **Shadow DOM 사용**: Netflix CSS와 격리 (보안+격리 둘 다)
- requestAnimationFrame loop: `videoEl.currentTime` 기반 현재 cue 찾기
- 자체 자막 div에 영어/한국어 동시 표시. `H` 키로 한국어 토글

### Day 6: A-B 반복 + 100LS 카운터 (3h)
- 자막 라인 클릭 또는 사이드 패널에서 라인 클릭 → `videoEl.currentTime = startMs/1000` + play
- rAF loop에서 `currentTime*1000 >= endMs`이면 즉시 `currentTime = startMs/1000`로 리셋
- 1회 완주(start→end 도달)마다 `db.lineProgress.update(lineId, {listenCount: ++})`
- 카운터 표시 div (큰 폰트): `42 / 100`
- 카운트 25/50/75/100에 도달 시 효과음/색상 피드백
- **CustomLoop (자막 cue 경계 무관 임의 A-B)**:
  - 단축키 `A`: 현재 `videoEl.currentTime`을 startMs로 마킹
  - 단축키 `B`: 현재 `videoEl.currentTime`을 endMs로 마킹 + 즉시 루프 시작 + `db.customLoops.add({...})` 자동 저장
  - 단축키 `S`: label 입력 모달 → 현재 CustomLoop에 label 부여 (없어도 작동)
  - rAF loop은 활성 CustomLoop가 있으면 `customLoop.startMs/endMs` 우선, 없으면 Line 기반
  - CustomLoop 카운터는 Line 카운터와 **완전 독립** 운영 (한쪽 ++이 다른 쪽에 영향 X)
  - 사이드 패널에 "내 구간" 탭: CustomLoop 리스트, 라벨 편집·삭제·재실행

### Day 7: 사이드바 진도 히트맵 + 단축키 (2h)
- 사이드 패널 라인 리스트 좌측에 색상 점: 0→회색, 1-9→연두, 10-29→초록, 30-99→파랑, 100+→보라, isMemorized→★
- 현재 라인 자동 스크롤
- 단축키: `chrome.commands` (popup-level) + content script `keydown` (capture phase로 Netflix 단축키와 충돌 회피)
  - `Space`: 재생/정지 (Netflix 기본과 동일, 우리는 가로채지 않음)
  - `←/→`: ±2초
  - `↑/↓`: 이전/다음 라인
  - `R`: 현재 라인 처음으로
  - `L`: A-B 루프 on/off
  - `H`: 한국어 자막 토글

### Day 8: 받아쓰기(Dictation) 모드 (2h)
- 사이드 패널 받아쓰기 탭
- 라인 선택 → 자막 hide + 해당 구간 재생
- `<textarea>` 입력 → 제출 시 단어 단위 diff
- diff: `diff` npm 또는 자체 Levenshtein
- `dictationAttempts++`, 일치율 ≥ 90%면 `dictationCorrect++`

### Day 9: 녹음(Shadowing) 모드 (3h)
- `navigator.mediaDevices.getUserMedia({audio: true})` + MediaRecorder
- 녹음 결과는 Blob → `db.recordings.add({lineId, blob, durationMs, ...})`
- 원본 라인 재생 → 녹음 재생 순차 (Web Audio API로 동시 재생도 옵션)
- 자가 평가 1-3 별 → `selfRating` + `shadowCount++`
- **마이크 권한은 사이드 패널에서 요청** (Netflix 페이지가 아닌 우리 origin에서)

### Day 10: 외움 처리 + 추천 로직 (1.5h)
- 라인 카드에 "외웠어요" 버튼 → `isMemorized = 1`
- 자동 후보 뱃지: `listenCount ≥ 30 AND dictationCorrect ≥ 3`
- 외운 라인 필터 토글 (사이드바)

### Day 11: 일일 목표 + 퀘스트 (2.5h)
- Options Page에서 `targetMinutes`, `targetListens` 입력
- `sessions` 테이블: 비디오 재생 중 + 윈도우 포커스 + 페이지 visible일 때만 active 측정
- Popup에 두 개의 프로그레스 바
- 둘 다 100% → `dailyGoals.completed = 1` + chrome.notifications

### Day 12: 스트릭 + Popup 배지 (1.5h)
- `chrome.alarms`으로 자정 롤오버 (또는 popup 열 때마다 체크)
- 어제 `completed = 1`이면 `currentStreak++`, 아니면 0
- `chrome.action.setBadgeText({text: String(currentStreak)})` — 아이콘에 스트릭 숫자

### Day 13: 통계 화면 + 플랫폼 어댑터 추상화 마무리 (2h)
- 옵션 페이지 또는 사이드 패널 통계 탭
- 누적 학습 시간, 100LS 도달 라인 수, 외운 라인 수, 30일 히트맵
- `PlatformAdapter` 인터페이스 최종 정리, Netflix 외 의존 코드 없는지 검증
- (선택) `CoupangPlayAdapter` 스텁만 작성

### Day 14: Web Store 준비 + 폴리싱 (3h)
- **개인정보 처리방침 작성** (§7 참조) — 별도 HTML 페이지
- 아이콘: 16/32/48/128 px (Figma 또는 무료 아이콘 사용)
- 스크린샷 5장 (1280×800 또는 640×400)
- 스토어 설명 (한국어/영어)
- 빈 상태 UI, 에러 토스트, 도움말 모달
- 데이터 백업: 옵션 페이지 → JSON export/import (Dexie의 `dexie-export-import` 플러그인)
- `wxt build` + `wxt zip` → Web Store 업로드용 .zip

---

## 7. Chrome Web Store 공개 준비 체크리스트

### 7.1 manifest.json 필수 항목
```json
{
  "manifest_version": 3,
  "name": "100LS — 영화로 영어 100번 듣기 학습",
  "version": "0.2.0",
  "description": "Netflix 시청 중 듀얼 자막·A-B 반복·100회 카운터로 100LS 학습법을 자동화합니다.",
  "permissions": ["storage", "sidePanel", "alarms", "notifications"],
  "host_permissions": ["https://*.netflix.com/*"],
  "content_scripts": [{
    "matches": ["https://*.netflix.com/*"],
    "js": ["content.js"],
    "run_at": "document_start"
  }],
  "background": { "service_worker": "background.js" },
  "side_panel": { "default_path": "sidepanel.html" },
  "action": { "default_popup": "popup.html" },
  "options_page": "options.html",
  "icons": { "16": "...", "48": "...", "128": "..." }
}
```

### 7.2 권한 최소화 원칙 (Web Store 심사 통과율 ↑)
- ❌ `<all_urls>` 절대 금지 → 자동 거절 또는 심사 지연
- ✅ `host_permissions`는 정확히 필요한 도메인만 (`https://*.netflix.com/*`)
- ✅ 새 OTT 추가 시 `optional_host_permissions`로 사용자 동의 받고 추가
- ❌ `tabs` 권한 불필요 (sidePanel만 사용)
- ❌ `webRequest` 불필요 (DOM hijack으로 충분)

### 7.3 개인정보 처리방침 (필수)
공개 URL에 호스팅. 핵심 문구:
> "모든 학습 데이터(자막, 진도, 녹음)는 사용자 브라우저의 IndexedDB에만 저장되며, 어떠한 외부 서버로도 전송되지 않습니다. 본 확장은 사용자의 Netflix 시청 행위에 영향을 주지 않으며, 비디오 스트림이나 결제 정보에 접근하지 않습니다. 자막 데이터는 Netflix가 사용자 브라우저로 공급한 것을 사용자 디바이스 내에서 학습 보조 용도로만 사용합니다."

### 7.4 사용자 약관 (앱 내 동의 단계)
- "본인은 Netflix 정식 구독자이며, Netflix 이용약관을 준수할 책임이 본인에게 있음에 동의합니다."
- "본 확장은 Netflix Inc.의 공식 제품이 아니며, Netflix와 어떠한 제휴 관계도 없습니다."

### 7.5 Web Store 심사에서 거절되지 않으려면
- ❌ DRM 우회 도구로 보일 수 있는 표현 금지 ("Netflix 영상 다운로드" 등)
- ❌ "Netflix" 단어를 이름 맨 앞에 넣지 않기 (상표권 분쟁 예방, "for Netflix" 형태도 위험)
- ✅ 데이터 사용 명세(`description` + privacy policy) 일치
- ✅ 디미니파이 가능한 빌드 결과물 (난독화 금지)
- ✅ 권한 사용 정당화 1줄씩 작성

### 7.6 향후 결제 모델
Chrome Web Store Payments는 deprecated → 자체 결제(Stripe/Toss/Lemon Squeezy) + 라이선스 키 모델. 그러나 **v0.2-0.3은 완전 무료** 유지 권장 (검증 단계).

---

## 8. 잠재적 함정 (미리 알아둘 것)

1. **Netflix DOM 변경 → 확장 깨짐**. 한 달에 1-2회 발생 가능. MutationObserver + 회복력 있는 selector(`querySelector('video')`처럼 일반적인 것)로 대응. Language Reactor도 정기 업데이트 필요.
2. **JSON.parse hijack 타이밍**: page world에 `document_start`에 동기적으로 주입되어야 Netflix의 초기 fetch를 가로챔. WXT의 `runAt: "document_start"` + `world: "MAIN"` 설정 필수.
3. **Service Worker idle 종료**: 30초~5분 후 자동 종료. 모든 상태는 IndexedDB로. 다시 깨어날 때 `chrome.alarms` 또는 메시지 수신 시점에 복원.
4. **Manifest V3 CSP**: 인라인 스크립트 금지, 원격 코드 금지. 모든 JS는 번들에 포함.
5. **Shadow DOM 권장**: 자막 오버레이를 Netflix의 React 재렌더에 영향받지 않도록 Shadow DOM으로 격리.
6. **마이크 권한**: 콘텐츠 스크립트에서 `getUserMedia` 호출 시 host(Netflix)에 권한이 보임. 사이드 패널(우리 origin)에서 요청하는 게 깔끔.
7. **Tailwind v4는 v3와 설정 방식 다름**: `@import "tailwindcss";` 한 줄. PostCSS 설정 불필요. 구버전 튜토리얼 따라가지 말 것.
8. **Chrome v134+ unpacked 제약**: Developer Mode가 켜져 있어야 unpacked 확장 작동. 본인 개발/사용에는 문제없음. Web Store 배포 후에는 무관.
9. **자막 매칭 실패 시 fallback**: Netflix가 영어 자막이 없는 콘텐츠 → "이 콘텐츠는 영어 자막이 없어 학습할 수 없습니다" 메시지 + 자막 있는 콘텐츠 추천.
10. **다중 탭 동시 학습**: 같은 콘텐츠를 두 탭에서 열면 라인 진도가 race condition. 일단 v0.2는 단일 탭 가정, 명시적으로 안내. Dexie의 `liveQuery`로 부분 동기화 가능.

---

## 9. v0.2 완료 검증 지표

본인이 Netflix 영화 1편으로 "100LS 1회분" 실제 학습 후:

1. **Netflix 페이지 진입 시 자동으로 듀얼 자막이 뜨는가?** — 사용자가 별도 조작 없이도
2. **A-B 반복이 키보드만으로 부드러운가?** — 마우스 없이 라인 이동·재반복
3. **한 라인 100회까지 도구가 진짜 도움이 되었나?** — 손으로 셀 때보다 압도적으로 편한가
4. **받아쓰기/녹음이 "외움" 판단을 객관화하는가?** — 본인 주관과 시스템 추천이 일치하는가
5. **일일 퀘스트·스트릭이 동기 유지에 효과 있었나?** — 적어도 일주일 연속 사용
6. **Netflix DOM 변경에도 회복 가능한가?** — 한 번이라도 selector 깨짐 발생했을 때 대처가 작은 패치로 끝나는가
7. **CustomLoop이 LR 대비 진짜 차별점인가?** — 한 라인 안 더 짧은 구간 / 두 라인 걸친 구간 / 자막 없는 구간 셋 다 부드럽게 반복 가능한가
8. **자막 편집·삽입이 실제 학습에 효과 있었나?** — Netflix 자막 오류 수정 또는 놓친 대사 추가 경험이 1번 이상, 그 결과 더 정확한 학습이 됐는가

✅ 6개 → v0.3 진입: Coupang Play / TVING / Disney+ 어댑터 추가 + Chrome Web Store 공개
✅ 미달 항목 → 짧은 스프린트로 보강

---

## 10. 첫 30분에 실행할 것

```bash
# 1. 프로젝트 생성
pnpm create wxt@latest lp100
# Template: react
# TypeScript: yes
# Package manager: pnpm

cd lp100
pnpm install

# 2. 의존성
pnpm install dexie zustand subtitle diff
pnpm install -D tailwindcss @tailwindcss/vite

# 3. Tailwind v4 통합
# vite.config.ts에 추가:
#   import tailwindcss from '@tailwindcss/vite';
#   plugins: [tailwindcss(), ...]
# entrypoints/popup/style.css 등 각 entrypoint의 css에 추가:
#   @import "tailwindcss";

# 4. 첫 실행 — Chrome이 자동으로 unpacked 확장 로드
pnpm dev
```

`wxt.config.ts`:
```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: '100LS — 영화로 영어 100번 듣기',
    description: 'Netflix 시청 중 듀얼 자막·A-B 반복·100회 카운터',
    permissions: ['storage', 'sidePanel', 'alarms', 'notifications'],
    host_permissions: ['https://*.netflix.com/*'],
    side_panel: { default_path: 'sidepanel.html' },
    action: { default_popup: 'popup.html' },
  },
  modules: ['@wxt-dev/module-react'],
});
```

여기까지 되면 Day 1 끝. Day 2부터는 §5 Dexie 스키마와 §3 어댑터 인터페이스를 작성하고 시작.

---

## 11. v0.3 로드맵 (검증 후)

| 단계 | 추가 작업 | 예상 기간 |
|---|---|---|
| v0.3.1 | Coupang Play 어댑터 (영어 학습 콘텐츠 많음) | 3-5일 |
| v0.3.2 | Disney+ 어댑터 | 3-5일 |
| v0.3.3 | TVING 어댑터 | 3-5일 |
| v0.3.4 | YouTube 어댑터 (CC 영상 학습용, 가장 쉬움) | 2-3일 |
| v0.3.5 | Chrome Web Store 첫 배포 | 1주 (심사 포함) |
| v0.4 | FSRS-4.5 기반 SRS, 데이터 클라우드 동기화 (자체 백엔드) | 4-6주 |
| v0.5 | Azure 발음 평가 API 통합 (Pro 기능) | 2-3주 |

핵심: **v0.2 코어 로직(A-B 반복, 100LS 카운터, 받아쓰기, 녹음, 퀘스트)은 v0.3-v0.5에서 손대지 않는다.** 모든 플랫폼 확장은 `PlatformAdapter` 구현만 추가.
