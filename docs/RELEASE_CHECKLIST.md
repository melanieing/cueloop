# 게시 전 체크리스트

> 짧게 유지한다. 길면 건너뛰게 되고, 건너뛰면 없는 것과 같다.
> 자동으로 막을 수 있는 건 전부 `pnpm build`/`pnpm zip`에 들어가 있으므로, 여기엔
> **사람만 확인할 수 있는 것**만 남긴다.

## 자동 (손댈 것 없음)

`pnpm build` / `pnpm build:win` / `pnpm zip`이 자동으로 돌린다. 실패하면 빌드가 멈춘다.

- `scripts/check-main-world.mjs` — `world: 'MAIN'` 엔트리포인트의 확장 API 사용 차단 ([#31](./troubleshooting.md))
- `scripts/verify-build.mjs` — MAIN world 번들에 `cueloop/jump`·`cueloop/timedtext` 리스너가 실제로 들어갔는지, 확장 API 흔적이 없는지 검사

> `pnpm verify`로 따로 돌릴 수도 있다.

## 수동 — 넷플릭스에서 4가지만

확장 새로고침 → **넷플릭스 탭 닫았다 새로 열기**(F5로는 부족한 경우가 있다) 후:

1. **자막이 뜨는가** — 한 번도 안 본 콘텐츠를 열어 영/한 자막이 화면에 표시되는지 (자막 수집 경로)
2. **라인 클릭 이동이 되는가** — 사이드패널에서 라인 클릭 → 그 시점으로 이동 (seek 경로. v0.2.7이 여기서 죽은 채 게시됐다)
3. **구간 반복이 도는가** — 내 구간 ▶ 재생 → 되감기며 카운트가 오르는지. **일시정지 상태에서도** 한 번
4. **단축키가 먹는가** — `H` 또는 `E`로 자막 토글 (오버레이 컴포넌트 생존 확인)

2·3·4는 전부 같은 곳에서 죽는다 — `<Overlay>`와 MAIN world 스크립트. 하나라도 안 되면 나머지도 의심할 것.

## 제출

1. `pnpm zip` → `.output/cueloop-<version>-chrome.zip`
2. Windows로 복사 (`cp .output/cueloop-*-chrome.zip /mnt/c/Users/melan/`)
3. [devconsole](https://chrome.google.com/webstore/devconsole) → Cueloop → 패키지 → 새 패키지 업로드 → 검토용 제출
4. 권한/매니페스트가 바뀌었다면 `docs/WEB_STORE_LISTING.md`의 정당화 문구도 갱신

## 버전

- `package.json`의 `version`을 **먼저** 올린다. 스토어판과 로컬이 같은 번호면 어느 빌드가 도는지 구분할 수 없다 (실제로 두 번 헤맸다).
- 페이지 콘솔의 `[Cueloop] JSON.parse hijacked (MAIN world) — v<버전>`로 **그 탭에서 도는 버전**을 확인한다. `chrome://extensions`의 숫자는 *설치된* 버전일 뿐 탭에서 도는 버전이 아니다.
