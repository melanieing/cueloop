// 자막 표시 순서 — 위에 어떤 언어를 둘지.
// 'en-top'(기본): 영어 위 / 한국어 아래. 'ko-top': 한국어 위 / 영어 아래.
// 위에 오는 자막이 주(主) 스타일(크고 흰색), 아래가 보조(작고 amber).
// overlayEnabled와 같은 이유로 chrome.storage.local에 저장 (content script 접근 가능).

export type SubtitleOrder = 'en-top' | 'ko-top';

const KEY = 'subtitleOrder';

export async function getSubtitleOrder(): Promise<SubtitleOrder> {
  try {
    const r = await browser.storage.local.get(KEY);
    return r[KEY] === 'ko-top' ? 'ko-top' : 'en-top';
  } catch {
    return 'en-top';
  }
}

export async function setSubtitleOrder(v: SubtitleOrder): Promise<void> {
  try {
    await browser.storage.local.set({ [KEY]: v });
  } catch {
    // ignore
  }
}

export function onSubtitleOrderChange(cb: (v: SubtitleOrder) => void): () => void {
  const handler = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ) => {
    if (area === 'local' && changes[KEY]) {
      cb(changes[KEY].newValue === 'ko-top' ? 'ko-top' : 'en-top');
    }
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}
