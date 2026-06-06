# Cueloop

> Chrome Extension Manifest V3로 만드는 영어 학습 도구. Netflix 위에 듀얼 자막 오버레이를 띄우고, 자막 라인 단위로 A-B 반복(100LS 학습법) + 받아쓰기 + 녹음 + 일일 퀘스트를 제공한다.

## 프로젝트 본질

- **학습법**: 100LS (One Hundred Listening & Speaking) — 같은 영화 콘텐츠를 100번 듣고 따라 말하는 학습법 (장동완 『9등급 꼴찌, 1년 만에 통역사 된 비법』, 리더스북 2017)
- **타겟**: 한국어 모어 화자가 영어를 학습하는 수요
- **현재 단계**: v0.2 — Netflix 단일 플랫폼. **Chrome Web Store 게시 완료**(Item ID `abjpdggoimiioglekbiofbijbmjkikpp`), Phase 1 무료 운영 중. 진행 현황은 `docs/backlog.md` 참조.
- **추후**: v0.3 멀티 OTT 확장 (Coupang Play, TVING, Disney+) + freemium 수익화 검토

## 만드는 것 (v0.2 핵심 기능)

1. Netflix 페이지에 자동 주입되는 듀얼 자막(영+한) 오버레이
2. 자막 라인 클릭 → A-B 자동 반복 + 100LS 카운터 + 임의 구간 반복(CustomLoop)
3. 사용자가 자막을 직접 편집·삽입·시각조정·복사(분할) (퀄리티 보장)
4. 자막 라벨링/필터 (⚠검토 / ★중요 / ☑외움 / 🙈숨김) + 라인·콘텐츠 정리(삭제)
5. 자막 공유 (영화 단위 자막만 export/import)
6. 일일 목표 + 스트릭 + 백업/복원

> ⚠ 초기 계획의 **받아쓰기(Dictation)·녹음(Shadowing) 모드는 v0.2에서 보류**(쓰기/녹음은 100LS '말하기' 본질과 거리가 있어 v0.3 음성인식 검증과 함께 재검토). 대신 자막 편집·라벨링·공유 쪽을 강화함. 상세는 docs/backlog.md.

## 의도적으로 안 만드는 것 (v0.2 스코프 밖)

- ❌ 비디오 파일 직접 처리 (Netflix가 재생함)
- ❌ DRM 우회 (자막만 다룸, Netflix 비디오 스트림은 절대 손대지 않음)
- ❌ 자막 자동 생성/번역 API (Whisper/DeepL/Azure) — 사용자가 한국어 직접 입력
- ❌ 멀티유저/결제/클라우드 동기화
- ❌ Wavve 지원 (메이저 확장 부재, R&D 리스크 큼)
- ❌ AI 발음 채점 (자가 평가로 갈음)

## 기술 스택 (2026 현행 검증, 사용자 preference 반영)

- **빌드**: WXT (2026 컨센서스 시장 리더. Plasmo/CRXJS는 유지보수 둔화로 제외)
- **Manifest V3** 의무 (MV2는 Chrome 139+에서 자동 비활성)
- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4** (`@import "tailwindcss";` 한 줄, v3 설정 방식과 다름)
- **Dexie.js** (IndexedDB) — `chrome.storage`는 5MB 제한으로 부족
- **Zustand** (상태)
- **subtitle, diff** (npm 라이브러리)

## 디렉토리 구조 약속

```
cueloop/
├── CLAUDE.md                  # 이 파일
├── CLAUDE.local.md            # 개인 메모 (gitignore)
├── docs/
│   ├── mvp-plan.md            # 전체 14일 일정, 데이터 모델, Day-by-Day
│   └── research-report.md     # 100LS 학습법, 법적 검토, 시장 분석 (있는 경우)
├── entrypoints/               # WXT entrypoints
│   ├── background.ts
│   ├── content.ts
│   ├── injected.ts            # page world (JSON.parse hijack)
│   ├── popup/
│   ├── sidepanel/
│   └── options/
├── src/
│   ├── db.ts                  # Dexie 스키마
│   ├── platforms/
│   │   ├── types.ts           # PlatformAdapter 인터페이스
│   │   ├── netflix.ts
│   │   └── index.ts           # adapter registry
│   ├── components/
│   ├── stores/                # Zustand
│   └── messages.ts            # chrome.runtime 메시지 타입
├── wxt.config.ts
└── package.json
```

## 코딩 스타일

- TypeScript strict mode 항상 켜둠
- 함수 컴포넌트만 사용 (class component 금지)
- 상태는 Zustand 또는 useReducer (Redux 금지)
- DOM 접근은 항상 ref 또는 useEffect 내부에서 (직접 document 접근 금지, content script 예외)
- 자막 오버레이는 Shadow DOM으로 격리 (Netflix CSS와 충돌 방지)
- 모든 영속 데이터는 Dexie/IndexedDB로 (`chrome.storage`는 설정값만)
- 메시지는 타입 안전하게 (`src/messages.ts`에 모든 타입 정의)

## 자주 쓰는 명령어

```bash
pnpm dev              # 개발 빌드 + Chrome 자동 로드
pnpm build            # 프로덕션 빌드
pnpm zip              # Web Store용 zip
pnpm tsc --noEmit     # 타입 체크
```

## 잠재적 함정 (반드시 알아둘 것)

1. **v0.1 Tauri 계획서는 폐기됨**: 콘텐츠 수급 문제로 Chrome Extension 방향으로 전면 전환됨. docs/에 옛 Tauri 계획이 남아있어도 무시.
2. **Tailwind v4는 v3와 설정 방식이 완전히 다름**: `tailwind.config.js` 없음. `@import "tailwindcss";` 한 줄. 구버전 튜토리얼 따라가지 말 것.
3. **Netflix DOM은 월 1-2회 변경됨**: MutationObserver + 회복력 있는 selector 필수. 깨졌을 때 빠르게 패치할 수 있는 구조로.
4. **JSON.parse hijack 타이밍**: `run_at: "document_start"` + `world: "MAIN"` 필수. 늦으면 Netflix 초기 fetch를 못 가로챔.
5. **Service Worker는 idle 시 종료**: 모든 상태는 IndexedDB로. 전역 변수에 저장 금지.
6. **`host_permissions`**: 절대 `<all_urls>` 안 됨. 정확히 `https://*.netflix.com/*`만. Web Store 자동 거절 사유.
7. **마이크 권한은 사이드 패널에서 요청**: 콘텐츠 스크립트에서 `getUserMedia` 호출하면 host(Netflix)에 권한이 묶임.
8. **`pnpm dev`는 unpacked로 자동 로드**: Chrome v134+는 Developer Mode가 켜져 있어야 작동.

## 멀티 OTT 확장 대비 (v0.3 준비)

플랫폼 의존 코드는 **반드시** `src/platforms/`의 `PlatformAdapter` 인터페이스 뒤에만 둔다. 핵심 로직(A-B 반복, 100LS 카운터, 받아쓰기, 녹음, 퀘스트)은 어댑터를 모르도록 작성. v0.3에서 `CoupangPlayAdapter`, `TVINGAdapter`, `DisneyPlusAdapter` 추가 시 핵심 로직 손대지 않는다.

## Chrome Web Store 공개 대비

- 데이터는 사용자 디바이스 IndexedDB에만. 외부 서버 전송 0.
- 이름에 "Netflix" 단어를 맨 앞 배치 금지 (상표권 분쟁 예방)
- 설명에 "DRM 우회", "다운로드" 같은 표현 절대 금지 (자동 거절)
- privacy_policy.md 필수, host_permissions 최소화

## 작업 절차 약속

- 새 기능 추가 전 `docs/mvp-plan.md`의 해당 Day 섹션 먼저 확인
- 플랫폼 의존 코드는 반드시 `src/platforms/` 내부에서만
- 새 라이브러리 추가 전 항상 2026 현행 권장인지 웹 검색으로 확인 (deprecated 제외)
- 자막 데이터 형식 변경 시 Dexie 마이그레이션 작성
- 추측 금지: 모르는 건 docs 확인 또는 웹 검색

## 참고 문서

전체 MVP 계획, 데이터 모델, Day-by-Day 일정, 법적 리스크 분석은 `docs/`에:
- `docs/mvp-plan.md` — Chrome Extension 14일 개발 계획 (Day 1~14, 데이터 모델, 아키텍처)
- `docs/research-report.md` — 100LS 학습법, 한국 저작권법 검토, 시장 분석 (있는 경우)
