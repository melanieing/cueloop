import type { CueloopMessage } from '../messages';

/**
 * Cross-context 변경 알림.
 * 사이드패널이 IDB에 쓴 직후 호출 → background SW와 overlay 등 다른 context에 broadcast.
 * Chrome extension의 cross-context dexie observable이 SW↔page 사이에서 보장되지 않으므로
 * 명시적 broadcast 필수. ([troubleshooting #11], [#15] 관련)
 *
 * sender 자신은 broadcast를 받지 않음 (sidepanel은 자체 dexie liveQuery로 자동 동기화).
 */
export function broadcastContentUpdate(contentId: number): void {
  const msg: CueloopMessage = {
    type: 'CONTENTS_UPDATED',
    payload: { contentId },
  };
  console.log('[Cueloop broadcast] CONTENTS_UPDATED for content', contentId);
  browser.runtime
    .sendMessage(msg)
    .then((resp) =>
      console.log('[Cueloop broadcast] delivered, response:', resp),
    )
    .catch((err: unknown) =>
      console.warn('[Cueloop broadcast] no receiver or error:', err),
    );
}
