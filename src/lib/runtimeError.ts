// 확장 컨텍스트 무효화를 조용히 삼키지 않기 위한 헬퍼.
//
// 확장이 업데이트/리로드되면 이미 열려 있던 탭의 content script는 재주입되지 않고
// 런타임 연결만 끊긴 채 남는다("Extension context invalidated"). 이 상태에서
// sendMessage는 전부 reject되는데, `.catch(() => {})`로 삼키면 자막·단축키·자동
// 스크롤이 이유 없이 죽은 것처럼 보인다 (2026-09-23 실제 발생, troubleshooting #29).
//
// 정상 상황에서도 흔한 "수신측 없음"(사이드패널 닫힘 등)은 기존처럼 무시한다.

let invalidationWarned = false;

const INVALIDATED_RE = /extension context invalidated|extension context was invalidated/i;

export function noteSendFailure(err: unknown): void {
  const message = String((err as { message?: unknown })?.message ?? err ?? '');
  if (!INVALIDATED_RE.test(message)) return; // 수신측 없음 등은 정상 — 무시
  if (invalidationWarned) return;
  invalidationWarned = true;
  console.warn(
    '[Cueloop] 확장 컨텍스트가 무효화됐습니다 (확장 업데이트 또는 리로드).' +
      ' 이 탭의 Cueloop은 더 이상 동작하지 않습니다 — 페이지를 새로고침(F5)하세요.',
  );
}
