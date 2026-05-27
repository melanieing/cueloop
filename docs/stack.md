# Cueloop 기술 스택 인벤토리

> 설치된 모든 패키지의 버전·deprecated 여부·핀 사유를 누적. 새 패키지 추가 또는 버전 변경 시 반드시 갱신.

**마지막 검증**: 2026-05-26

## 검증 절차

새 패키지 추가 또는 분기 점검 시:
```bash
pnpm view <pkg> dist-tags time.modified deprecated peerDependencies
pnpm outdated
```
- `deprecated`가 비어있으면 안전
- `latest` tag가 우리가 쓰는 버전과 일치하는지 확인
- 메이저 업그레이드는 의식적 결정 (자동 X)

## Runtime Dependencies

| 패키지 | 설치 버전 | 최신 stable | Deprecated | 핀 사유 |
|---|---|---|---|---|
| react | 19.2.6 | 19.2.6 | × | CLAUDE.md 규약 React 19 |
| react-dom | 19.2.6 | 19.2.6 | × | react와 동기 |
| dexie | 4.4.2 | 4.4.2 | × | IndexedDB 래퍼, `chrome.storage` 5MB 제한 회피 |
| zustand | 5.0.13 | 5.0.13 | × | 경량 상태관리, Redux 금지(CLAUDE.md) |
| subtitle | 4.2.2 | 4.2.2 | × | 자막 파싱(dfxp/TTML/SRT/VTT) — 실제론 직접 정규식 파서 씀(`src/lib/dfxp.ts`), 이 패키지는 미사용. v0.3에서 제거 검토 |
| diff | 9.0.0 | 9.0.0 | × | 받아쓰기 단어 단위 비교 (Day 8). v9가 자체 TS 타입 내장 |
| @tanstack/react-virtual | 3.13.25 | 3.13.26 | × | Day 4 사이드패널 라인 리스트 가상 스크롤. 1779+ 행 성능. peer React 19 호환 |
| dexie-react-hooks | 4.4.0 | 4.4.0 | × | Day 4 useLiveQuery 훅. DB 변경 시 자동 re-render. peer dexie ≥4.2.0 |

## Dev Dependencies

| 패키지 | 설치 버전 | 최신 stable | Deprecated | 핀 사유 |
|---|---|---|---|---|
| wxt | 0.20.26 | 0.20.26 | × | 2026 컨센서스 빌드 도구 (CLAUDE.md). Vite 8 끌어옴 |
| @wxt-dev/module-react | 1.2.2 | 1.2.2 | × | WXT의 React 모듈 |
| @types/react | 19.2.15 | 19.2.15 | × | react 19와 동기 |
| @types/react-dom | 19.2.3 | 19.2.3 | × | react-dom 19와 동기 |
| tailwindcss | 4.3.0 | 4.3.0 | × | v4. `@import "tailwindcss"` 한 줄 방식 (CLAUDE.md 함정 #2) |
| @tailwindcss/vite | 4.3.0 | 4.3.0 | × | Tailwind v4의 Vite 통합 플러그인. peer `vite ^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8` |
| typescript | 5.9.3 | **6.0.3** | × | ⚠️ TS 6.0 메이저 릴리즈됨. WXT 스캐폴드가 5.9 기준, React 19 타입과의 호환 검증 비용 큼. 학습 도구라 TS 6 신기능 불필요 → **5.9.3 의도적 유지**. 후속 업그레이드는 v0.3 진입 시점에 재검토 |

## 의존성 트리에서 가져온 주요 transitive

| 패키지 | 버전 | 출처 | 비고 |
|---|---|---|---|
| vite | 8.0.14 | wxt → @wxt-dev/module-react | Tailwind v4 vite 플러그인 peer (`^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8`) 통과 |
| esbuild | 0.27.7 | vite | postinstall 승인됨 ([troubleshooting #2](./troubleshooting.md)) |

## Build 승인 (pnpm-workspace.yaml)

| 패키지 | allowBuilds | 사유 |
|---|---|---|
| esbuild | **true** | Vite 핵심, 플랫폼별 native binary 필요 |
| spawn-sync | false | fx-runner → web-ext-run(Firefox 전용). Chrome만 쓰는 우리는 불필요 |

## 추가 검토 중인 패키지 (아직 미설치)

| 패키지 | 용도 | 검토 상태 |
|---|---|---|
| dexie-export-import | Day 14 백업 export/import | Day 14 진입 시 검증 |

## 의도적으로 제외한 패키지

| 패키지 | 제외 사유 |
|---|---|
| @types/diff | diff v9가 자체 TS 타입 내장 → 중복 ([troubleshooting #3](./troubleshooting.md)) |
| @types/subtitle | subtitle 4.x가 자체 TS 타입 내장 |
