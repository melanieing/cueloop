import { useEffect, useState } from 'react';

/**
 * Cross-context DB invalidation hook.
 * background SW가 IDB에 쓰고 CONTENTS_UPDATED 브로드캐스트하면 version 증가.
 * useLiveQuery dependency에 넣어서 refetch 트리거.
 * (Dexie liveQuery의 cross-context auto-sync가 Chrome extension SW↔page에서 보장 안 됨)
 */
export function useDbVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const handler = (msg: unknown) => {
      const m = msg as { type?: string };
      if (m?.type === 'CONTENTS_UPDATED') {
        setVersion((v) => v + 1);
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);
  return version;
}
