// Cueloop 오버레이 전역 ON/OFF 상태.
// 오버레이는 content script라 확장 IndexedDB(extension origin)에 접근 못 함.
// content script가 직접 읽고 쓸 수 있는 건 chrome.storage.local 뿐 — 여기 저장.
// 기본값 true (켜짐). 끄면 persist되어 다시 켤 때까지 유지.

const KEY = 'overlayEnabled';

export async function getOverlayEnabled(): Promise<boolean> {
  try {
    const r = await browser.storage.local.get(KEY);
    return r[KEY] !== false; // 미설정 시 기본 켜짐
  } catch {
    return true;
  }
}

export async function setOverlayEnabled(v: boolean): Promise<void> {
  try {
    await browser.storage.local.set({ [KEY]: v });
  } catch {
    // ignore
  }
}

// storage.onChanged 구독 — 다른 컨텍스트(다른 탭/사이드패널 등)에서 토글해도 동기화.
export function onOverlayEnabledChange(cb: (v: boolean) => void): () => void {
  const handler = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ) => {
    if (area === 'local' && changes[KEY]) {
      cb(changes[KEY].newValue !== false);
    }
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}
