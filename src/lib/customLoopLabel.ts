import { db } from '../db';

// ⚠ 이 모듈은 Dexie를 쓰므로 extension origin에서만 import할 것
// (background SW, popup/sidepanel/options). content script 금지 — IndexedDB가
// 페이지 origin에 따로 생긴다. CLAUDE.md "IDB origin 단일 진입" 참조.

const MAX_LABEL_LEN = 60;

/** 라벨용으로 자막 텍스트를 한 줄로 펴고 길면 자른다. */
export function toLabelText(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_LABEL_LEN ? `${flat.slice(0, MAX_LABEL_LEN - 1)}…` : flat;
}

/**
 * 구간 라벨 기본값 — 그 구간에 걸치는 **첫 번째 영어 자막**.
 *
 * 구간이 라인 중간에서 시작할 수도 있으므로 "포함"이 아니라 "겹침"으로 찾는다
 * (그 순간 들리고 있는 라인이 곧 그 구간의 첫 대사다).
 * 숨긴 라인(노래 가사 등 학습 대상 아님)은 제외.
 *
 * 영어 자막이 없는 구간(무자막 발음 구간 등)은 `undefined` → 호출측에서 "(라벨 없음)" 처리.
 */
export async function deriveLoopLabel(
  contentId: number,
  startMs: number,
  endMs: number,
): Promise<string | undefined> {
  const lines = await db.lines.where('contentId').equals(contentId).toArray();
  let best: { startMs: number; textEn: string } | undefined;
  for (const l of lines) {
    if (l.isHidden) continue;
    if (!l.textEn.trim()) continue;
    if (l.startMs > endMs || l.endMs < startMs) continue; // 겹치지 않음
    if (!best || l.startMs < best.startMs) best = l;
  }
  return best ? toLabelText(best.textEn) : undefined;
}
