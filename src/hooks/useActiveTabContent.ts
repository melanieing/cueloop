import { useEffect, useState } from 'react';
import type { CueloopMessage } from '../messages';

/**
 * 현재 active Netflix watch 탭의 contentId를 추적.
 * background SW가 tab change/update 시 ACTIVE_CONTENT_CHANGED broadcast.
 * 사이드패널 마운트 시 한 번 query.
 */
export function useActiveTabContent(): number | null {
  const [activeContentId, setActiveContentId] = useState<number | null>(null);

  useEffect(() => {
    // 초기 query
    const queryMsg: CueloopMessage = { type: 'QUERY_ACTIVE_CONTENT' };
    browser.runtime
      .sendMessage(queryMsg)
      .then((resp) => {
        const r = resp as { contentId?: number | null } | undefined;
        setActiveContentId(r?.contentId ?? null);
      })
      .catch(() => {});

    // broadcast 수신
    const handler = (msg: unknown) => {
      const m = msg as CueloopMessage;
      if (m?.type === 'ACTIVE_CONTENT_CHANGED') {
        setActiveContentId(m.payload.contentId);
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);

  return activeContentId;
}
