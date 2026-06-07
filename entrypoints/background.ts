import type { CueloopMessage } from '@/src/messages';
import { ingestNetflixTracks } from '@/src/platforms/netflix-subtitles';
import { db } from '@/src/db';
import {
  addAchievedSeconds,
  addAchievedListen,
  todayKey,
} from '@/src/lib/dailyGoal';

type Streak = {
  id: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate?: string;
};

// === Streak (background-local) ===
// WXT 0.20 prepare 단계 버그로 streak 로직을 lib 파일에 두고 cross-entrypoint
// import하면 빌드가 unhandled rejection으로 실패. background와 popup에 각각 inline.
const SETTING_STREAK_KEY = '__streak__';

function _yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadStreakState(): Promise<Streak> {
  const row = await db.settings.get(SETTING_STREAK_KEY);
  if (row) return row.value as Streak;
  const fresh: Streak = { id: 1, currentStreak: 0, longestStreak: 0 };
  await db.settings.put({ key: SETTING_STREAK_KEY, value: fresh });
  return fresh;
}

async function bumpStreakOnComplete(): Promise<Streak> {
  const today = todayKey();
  const yesterday = _yesterdayKey();
  const cur = await loadStreakState();
  if (cur.lastCompletedDate === today) return cur;
  const nextCurrent =
    cur.lastCompletedDate === yesterday ? cur.currentStreak + 1 : 1;
  const next: Streak = {
    id: 1,
    currentStreak: nextCurrent,
    longestStreak: Math.max(cur.longestStreak, nextCurrent),
    lastCompletedDate: today,
  };
  await db.settings.put({ key: SETTING_STREAK_KEY, value: next });
  return next;
}

async function maintainStreak(): Promise<Streak> {
  const today = todayKey();
  const yesterday = _yesterdayKey();
  const cur = await loadStreakState();
  if (
    cur.lastCompletedDate === today ||
    cur.lastCompletedDate === yesterday
  ) {
    return cur;
  }
  if (cur.currentStreak === 0) return cur;
  const next: Streak = { ...cur, currentStreak: 0 };
  await db.settings.put({ key: SETTING_STREAK_KEY, value: next });
  return next;
}

async function updateBadge(): Promise<void> {
  const s = await loadStreakState();
  const text = s.currentStreak > 0 ? String(s.currentStreak) : '';
  try {
    await browser.action.setBadgeText({ text });
    if (text) {
      await browser.action.setBadgeBackgroundColor({ color: '#10b981' });
    }
  } catch {
    // ignore
  }
}

async function notifyGoalCompleted(streakCount: number): Promise<void> {
  try {
    await browser.notifications.create({
      type: 'basic',
      iconUrl: 'icon/128.png',
      title: '🎉 오늘 목표 달성!',
      message: `학습 시간 + 100LS 카운트 모두 완료. 🔥 스트릭 ${streakCount}일 연속!`,
      priority: 1,
    });
  } catch {
    // notifications 권한 없거나 실패 — 무시
  }
}

async function onGoalCompletedTransition(): Promise<void> {
  const s = await bumpStreakOnComplete();
  await updateBadge();
  void notifyGoalCompleted(s.currentStreak);
}

// 다음 로컬 자정 timestamp (ms)
function nextMidnightTs(): number {
  const d = new Date();
  d.setHours(24, 0, 5, 0); // 다음 자정 + 5초 buffer
  return d.getTime();
}

function extractMovieIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/netflix\.com\/watch\/(\d+)/);
  return m ? m[1] : null;
}

async function findActiveNetflixContentId(): Promise<number | null> {
  // 활성 탭 우선. SW에는 자체 window가 없어 currentWindow가 불안정하므로
  // lastFocusedWindow 사용. 그래도 못 잡으면 열려있는 netflix watch 탭으로 폴백.
  let movieId: string | null = null;
  try {
    const active = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    movieId = extractMovieIdFromUrl(active[0]?.url);
  } catch {
    // ignore
  }
  if (!movieId) {
    const watchTabs = await browser.tabs.query({
      url: 'https://*.netflix.com/watch/*',
    });
    // 활성 watch 탭 우선, 없으면 (유일하거나 첫) watch 탭
    const pick = watchTabs.find((t) => t.active) ?? watchTabs[0];
    movieId = extractMovieIdFromUrl(pick?.url);
  }
  if (!movieId) return null;
  const content = await db.contents
    .where('[platform+contentId]')
    .equals(['netflix', movieId])
    .first();
  return content?.id ?? null;
}

async function broadcastActiveContent(): Promise<void> {
  const contentId = await findActiveNetflixContentId();
  const msg: CueloopMessage = {
    type: 'ACTIVE_CONTENT_CHANGED',
    payload: { contentId },
  };
  await browser.runtime.sendMessage(msg).catch(() => {});
}

/**
 * Chrome MV3 라우팅 규칙: runtime.sendMessage는 extension page→content script로 안 감.
 * content script에 메시지 보내려면 tabs.sendMessage 필수.
 * background가 경유 라우터 역할.
 */
async function forwardToWatchTabs(msg: CueloopMessage): Promise<void> {
  const tabs = await browser.tabs.query({ url: 'https://*.netflix.com/watch/*' });
  console.log(
    `[Cueloop] forwarding ${msg.type} to ${tabs.length} watch tab(s)`,
  );
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await browser.tabs.sendMessage(tab.id, msg);
      } catch {
        // content script 미주입 (페이지 새로고침 전 등) — 무시
      }
    }),
  );
}

async function handleJumpToLine(
  contentId: number,
  startMs: number,
): Promise<{ ok: boolean; error?: string }> {
  const content = await db.contents.get(contentId);
  if (!content) {
    console.log('[Cueloop] jump fail: content not found, contentId=', contentId);
    return { ok: false, error: 'content not found' };
  }
  const movieId = content.contentId;
  console.log(`[Cueloop] jump start: expectedMovieId=${movieId}, startMs=${startMs}`);

  const tabs = await browser.tabs.query({ url: 'https://*.netflix.com/watch/*' });
  console.log(`[Cueloop]   found ${tabs.length} netflix watch tabs`);

  if (tabs.length === 0) {
    return { ok: false, error: 'Netflix watch 탭이 열려있지 않음' };
  }

  for (const tab of tabs) {
    if (tab.id == null) continue;
    const tabMovieId = extractMovieIdFromUrl(tab.url);
    console.log(
      `[Cueloop]   trying tab ${tab.id}: movieId=${tabMovieId}, url=${tab.url}`,
    );
    try {
      const sendMsg: CueloopMessage = {
        type: 'JUMP_TO_LINE_IN_TAB',
        payload: { expectedMovieId: movieId, startMs },
      };
      const resp = (await browser.tabs.sendMessage(tab.id, sendMsg)) as
        | { ok?: boolean; error?: string }
        | undefined;
      console.log(`[Cueloop]   tab ${tab.id} response:`, resp);
      if (resp?.ok) return { ok: true };
    } catch (err) {
      console.log(`[Cueloop]   tab ${tab.id} sendMessage error:`, err);
    }
  }
  return {
    ok: false,
    error: `해당 영화(${movieId})를 재생 중인 Netflix 탭을 찾을 수 없음 (열린 watch 탭: ${tabs.length}개)`,
  };
}

export default defineBackground(() => {
  console.log('[Cueloop] background service worker started', {
    id: browser.runtime.id,
    time: new Date().toISOString(),
  });

  // 자정 alarm 등록 + 끊긴 streak 정리 + 배지 갱신
  void (async () => {
    await browser.alarms.create('cueloop-midnight', {
      when: nextMidnightTs(),
      periodInMinutes: 24 * 60,
    });
    await maintainStreak();
    await updateBadge();
  })();

  // 첫 설치 시 옵션 페이지(사용법 onboarding) 자동 열기
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      void browser.runtime.openOptionsPage().catch(() => {});
    }
  });

  // 확장 아이콘 클릭 시 사이드패널 자동 열림 (popup 대신).
  // popup도 manifest에 정의되어 있지만 이 설정이 우선.
  void browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cueloop-midnight') {
      await maintainStreak();
      await updateBadge();
    }
  });

  browser.tabs.onActivated.addListener(() => {
    void broadcastActiveContent();
  });
  browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      void broadcastActiveContent();
    }
  });

  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const message = msg as CueloopMessage;

    // sidepanel/popup이 보낸 CONTENTS_UPDATED → 모든 watch 탭의 content script에 forward
    // (runtime.sendMessage는 extension page → content script로 안 가므로 background 경유 필수)
    if (message?.type === 'CONTENTS_UPDATED') {
      void forwardToWatchTabs(message);
      return false;
    }

    if (message?.type === 'NETFLIX_TIMEDTEXT_CAPTURED') {
      const { movieId, rawTracks, pageTitle } = message.payload;
      console.log(
        `[Cueloop] processing timedtext for ${movieId}, ${rawTracks.length} tracks, title="${pageTitle ?? '(none)'}", fromTab=${sender.tab?.id}`,
      );
      void (async () => {
        try {
          await ingestNetflixTracks(movieId, rawTracks, pageTitle);
          const content = await db.contents
            .where('[platform+contentId]')
            .equals(['netflix', movieId])
            .first();
          if (content?.id != null) {
            const notify: CueloopMessage = {
              type: 'CONTENTS_UPDATED',
              payload: { contentId: content.id },
            };
            // sidepanel/popup/options에 broadcast
            await browser.runtime.sendMessage(notify).catch(() => {});
            // content script(overlay 등)에 직접 forward
            await forwardToWatchTabs(notify);
          }
          await broadcastActiveContent();
          console.log(`[Cueloop] ingest completed for ${movieId}`);
          sendResponse({ ok: true });
        } catch (err) {
          console.error('[Cueloop] background ingest failed:', err);
          sendResponse({ ok: false, error: String(err) });
        }
      })();
      return true;
    }

    if (message?.type === 'JUMP_TO_LINE') {
      const { contentId, startMs } = message.payload;
      void handleJumpToLine(contentId, startMs).then((result) => {
        console.log(`[Cueloop] jump result:`, result);
        sendResponse(result);
      });
      return true;
    }

    if (message?.type === 'QUERY_ACTIVE_CONTENT') {
      void findActiveNetflixContentId().then((contentId) => {
        sendResponse({ contentId });
      });
      return true;
    }

    if (message?.type === 'ADD_CUSTOM_LOOP') {
      const { movieId, startMs, endMs } = message.payload;
      void (async () => {
        const content = await db.contents
          .where('[platform+contentId]')
          .equals(['netflix', movieId])
          .first();
        if (!content?.id) {
          sendResponse({ ok: false, error: 'content not found' });
          return;
        }
        const id = await db.customLoops.add({
          contentId: content.id,
          startMs,
          endMs,
          listenCount: 0,
          isMemorized: 0,
          createdAt: Date.now(),
        });
        const notify: CueloopMessage = {
          type: 'CONTENTS_UPDATED',
          payload: { contentId: content.id },
        };
        await browser.runtime.sendMessage(notify).catch(() => {});
        await forwardToWatchTabs(notify);
        sendResponse({ ok: true, loopId: id });
      })();
      return true;
    }

    if (message?.type === 'UPDATE_CUSTOM_LOOP_LABEL') {
      const { loopId, label } = message.payload;
      void (async () => {
        await db.customLoops.update(loopId, { label: label || undefined });
        const loop = await db.customLoops.get(loopId);
        if (loop?.contentId != null) {
          const notify: CueloopMessage = {
            type: 'CONTENTS_UPDATED',
            payload: { contentId: loop.contentId },
          };
          await browser.runtime.sendMessage(notify).catch(() => {});
          await forwardToWatchTabs(notify);
        }
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (message?.type === 'PLAY_CUSTOM_LOOP') {
      const { loopId } = message.payload;
      void (async () => {
        const loop = await db.customLoops.get(loopId);
        if (!loop?.id) {
          sendResponse({ ok: false, error: 'loop not found' });
          return;
        }
        const content = await db.contents.get(loop.contentId);
        if (!content?.contentId) {
          sendResponse({ ok: false, error: 'content not found' });
          return;
        }
        const movieId = content.contentId;
        const tabs = await browser.tabs.query({ url: 'https://*.netflix.com/watch/*' });
        for (const tab of tabs) {
          if (tab.id == null) continue;
          const tabMovieId = extractMovieIdFromUrl(tab.url);
          if (tabMovieId !== movieId) continue;
          try {
            const fwd: CueloopMessage = {
              type: 'PLAY_CUSTOM_LOOP_IN_TAB',
              payload: {
                loopId: loop.id,
                startMs: loop.startMs,
                endMs: loop.endMs,
                label: loop.label,
                expectedMovieId: movieId,
              },
            };
            await browser.tabs.sendMessage(tab.id, fwd);
            sendResponse({ ok: true });
            return;
          } catch {
            // try next
          }
        }
        sendResponse({
          ok: false,
          error: `영화(${movieId}) 재생 중인 Netflix 탭을 찾을 수 없음`,
        });
      })();
      return true;
    }

    if (message?.type === 'STOP_REPEAT') {
      const fwd: CueloopMessage = { type: 'STOP_REPEAT_IN_TAB' };
      void forwardToWatchTabs(fwd);
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === 'GET_CURRENT_VIDEO_TIME') {
      const { contentId } = message.payload;
      void (async () => {
        const content = await db.contents.get(contentId);
        if (!content?.contentId) {
          sendResponse({ ok: false, error: 'content not found' });
          return;
        }
        const movieId = content.contentId;
        const tabs = await browser.tabs.query({ url: 'https://*.netflix.com/watch/*' });
        for (const tab of tabs) {
          if (tab.id == null) continue;
          const tabMovieId = extractMovieIdFromUrl(tab.url);
          if (tabMovieId !== movieId) continue;
          try {
            const fwd: CueloopMessage = { type: 'GET_CURRENT_VIDEO_TIME_IN_TAB' };
            const resp = (await browser.tabs.sendMessage(tab.id, fwd)) as
              | { ok?: boolean; timeMs?: number; error?: string }
              | undefined;
            sendResponse(resp ?? { ok: false, error: 'no response' });
            return;
          } catch {
            // try next
          }
        }
        sendResponse({
          ok: false,
          error: `영화(${movieId}) 재생 중인 Netflix 탭을 찾을 수 없음`,
        });
      })();
      return true;
    }

    if (message?.type === 'OVERLAY_SHORTCUT') {
      const fwd: CueloopMessage = {
        type: 'OVERLAY_SHORTCUT_IN_TAB',
        payload: { key: message.payload.key },
      };
      void forwardToWatchTabs(fwd);
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === 'PLAY_LINE_LOOP') {
      const { lineId } = message.payload;
      void (async () => {
        const line = await db.lines.get(lineId);
        if (!line?.id) {
          sendResponse({ ok: false, error: 'line not found' });
          return;
        }
        const content = await db.contents.get(line.contentId);
        if (!content?.contentId) {
          sendResponse({ ok: false, error: 'content not found' });
          return;
        }
        const movieId = content.contentId;
        const tabs = await browser.tabs.query({ url: 'https://*.netflix.com/watch/*' });
        for (const tab of tabs) {
          if (tab.id == null) continue;
          const tabMovieId = extractMovieIdFromUrl(tab.url);
          if (tabMovieId !== movieId) continue;
          try {
            const fwd: CueloopMessage = {
              type: 'PLAY_LINE_LOOP_IN_TAB',
              payload: {
                lineId: line.id,
                startMs: line.startMs,
                endMs: line.endMs,
                expectedMovieId: movieId,
              },
            };
            await browser.tabs.sendMessage(tab.id, fwd);
            sendResponse({ ok: true });
            return;
          } catch {
            // try next
          }
        }
        sendResponse({
          ok: false,
          error: `영화(${movieId}) 재생 중인 Netflix 탭을 찾을 수 없음`,
        });
      })();
      return true;
    }

    if (message?.type === 'DELETE_CUSTOM_LOOP') {
      const { loopId } = message.payload;
      void (async () => {
        const loop = await db.customLoops.get(loopId);
        if (loop?.contentId != null) {
          await db.customLoops.delete(loopId);
          const notify: CueloopMessage = {
            type: 'CONTENTS_UPDATED',
            payload: { contentId: loop.contentId },
          };
          await browser.runtime.sendMessage(notify).catch(() => {});
          await forwardToWatchTabs(notify);
        }
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (message?.type === 'INCREMENT_CUSTOM_LOOP_LISTEN') {
      const { loopId } = message.payload;
      void (async () => {
        const existing = await db.customLoops.get(loopId);
        if (existing) {
          await db.customLoops.update(loopId, {
            listenCount: existing.listenCount + 1,
            lastListenedAt: Date.now(),
          });
        }
        const { justCompleted } = await addAchievedListen();
        if (justCompleted) void onGoalCompletedTransition();
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (message?.type === 'INCREMENT_LINE_LISTEN') {
      const { lineId } = message.payload;
      void (async () => {
        const existing = await db.lineProgress.get(lineId);
        if (existing) {
          await db.lineProgress.update(lineId, {
            listenCount: existing.listenCount + 1,
            lastListenedAt: Date.now(),
          });
        } else {
          await db.lineProgress.put({
            lineId,
            listenCount: 1,
            dictationAttempts: 0,
            dictationCorrect: 0,
            shadowCount: 0,
            isMemorized: 0,
            lastListenedAt: Date.now(),
          });
        }
        const { justCompleted } = await addAchievedListen();
        if (justCompleted) void onGoalCompletedTransition();
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (message?.type === 'SESSION_TICK') {
      const { seconds } = message.payload;
      void (async () => {
        const { justCompleted } = await addAchievedSeconds(seconds);
        if (justCompleted) void onGoalCompletedTransition();
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (message?.type === 'GET_LINES_FOR_MOVIE') {
      const { movieId } = message.payload;
      void (async () => {
        const content = await db.contents
          .where('[platform+contentId]')
          .equals(['netflix', movieId])
          .first();
        if (!content?.id) {
          sendResponse({ ok: true, contentId: null, lines: [] });
          return;
        }
        const lines = await db.lines.where('contentId').equals(content.id).toArray();
        lines.sort((a, b) => a.startMs - b.startMs);
        sendResponse({ ok: true, contentId: content.id, lines });
      })();
      return true;
    }

    return false;
  });

  console.log('[Cueloop] background onMessage listener registered');
});
