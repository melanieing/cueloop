import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Streak } from '@/src/db';
import { todayKey, getOrCreateTodayGoal } from '@/src/lib/dailyGoal';

// streak: inline (WXT 0.20 prepare 버그 우회 — background.ts에도 동일 정의)
const SETTING_STREAK_KEY = '__streak__';

function popupYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getStreak(): Promise<Streak> {
  const row = await db.settings.get(SETTING_STREAK_KEY);
  if (row) return row.value as Streak;
  const fresh: Streak = { id: 1, currentStreak: 0, longestStreak: 0 };
  await db.settings.put({ key: SETTING_STREAK_KEY, value: fresh });
  return fresh;
}

async function maintainStreak(): Promise<Streak> {
  const today = todayKey();
  const yesterday = popupYesterdayKey();
  const cur = await getStreak();

  // safety bump: 오늘 dailyGoal이 이미 완료됐는데 streak이 오늘 처리 안 된 경우
  // (transition 시점에 streak 핸들러가 못 돈 케이스를 복구) → 지금 bump.
  if (cur.lastCompletedDate !== today) {
    const todayGoal = await db.dailyGoals.get(today);
    if (todayGoal?.completed === 1) {
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
  }

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

function ProgressBar({
  achieved,
  target,
  unit,
  label,
}: {
  achieved: number;
  target: number;
  unit: string;
  label: string;
}) {
  const pct = target > 0 ? Math.min(100, (achieved / target) * 100) : 0;
  const complete = achieved >= target;
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-zinc-300 font-medium">{label}</span>
        <span
          className={`text-xs font-mono ${complete ? 'text-emerald-400' : 'text-zinc-400'}`}
        >
          {Math.floor(achieved)} / {target} {unit}
          {complete && ' ✓'}
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            complete ? 'bg-emerald-500' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function App() {
  // 첫 mount 시 끊긴 streak 정리 + 오늘 완료된 streak safety bump
  useEffect(() => {
    void maintainStreak();
  }, []);

  const goal = useLiveQuery(async () => getOrCreateTodayGoal());
  const streak = useLiveQuery(async () => getStreak());

  // streak 변화 시 toolbar 아이콘 배지 즉시 갱신 (background SW가 idle이어도 동작)
  useEffect(() => {
    if (!streak) return;
    const text = streak.currentStreak > 0 ? String(streak.currentStreak) : '';
    browser.action.setBadgeText({ text }).catch(() => {});
    if (text) {
      browser.action
        .setBadgeBackgroundColor({ color: '#10b981' })
        .catch(() => {});
    }
  }, [streak?.currentStreak]);

  if (!goal || !streak) {
    return (
      <div className="min-h-[200px] w-[280px] bg-zinc-950 text-zinc-100 p-4">
        <p className="text-sm text-zinc-400">로딩 중...</p>
      </div>
    );
  }

  const date = todayKey();
  const openOptions = () => {
    void browser.runtime.openOptionsPage();
  };

  return (
    <div className="w-[280px] bg-zinc-950 text-zinc-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-base font-bold">Cueloop</h1>
        <button
          type="button"
          onClick={openOptions}
          className="text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
          title="설정"
        >
          ⚙ 설정
        </button>
      </div>

      <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-800">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl">🔥</span>
          <span className="text-2xl font-bold text-amber-400">
            {streak.currentStreak}
          </span>
          <span className="text-xs text-zinc-400">일 연속</span>
        </div>
        {streak.longestStreak > streak.currentStreak && (
          <span
            className="text-[10px] text-zinc-500"
            title="최장 연속 기록"
          >
            최장 {streak.longestStreak}일
          </span>
        )}
      </div>

      <p className="text-[10px] text-zinc-500 mb-2">{date} 오늘 진도</p>

      <ProgressBar
        label="학습 시간"
        achieved={goal.achievedMinutes}
        target={goal.targetMinutes}
        unit="분"
      />
      <ProgressBar
        label="100LS 카운트"
        achieved={goal.achievedListens}
        target={goal.targetListens}
        unit="회"
      />

      {goal.completed === 1 ? (
        <div className="mt-3 text-center text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900 rounded py-1.5">
          🎉 오늘 목표 달성!
        </div>
      ) : (
        <div className="mt-3 text-center text-[10px] text-zinc-500">
          두 항목 모두 100%면 스트릭 +1
        </div>
      )}
    </div>
  );
}
