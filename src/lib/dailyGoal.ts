import { db, type DailyGoal } from '../db';

export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


const SETTING_TARGET_MINUTES = 'dailyTargetMinutes';
const SETTING_TARGET_LISTENS = 'dailyTargetListens';
const DEFAULT_TARGET_MINUTES = 30;
const DEFAULT_TARGET_LISTENS = 50;

async function loadTargets(): Promise<{ targetMinutes: number; targetListens: number }> {
  const [m, l] = await Promise.all([
    db.settings.get(SETTING_TARGET_MINUTES),
    db.settings.get(SETTING_TARGET_LISTENS),
  ]);
  return {
    targetMinutes: (m?.value as number | undefined) ?? DEFAULT_TARGET_MINUTES,
    targetListens: (l?.value as number | undefined) ?? DEFAULT_TARGET_LISTENS,
  };
}

/**
 * 읽기 전용 — 오늘 목표를 조회만 한다 (DB 쓰기 없음).
 * useLiveQuery 안에서 쓰면 재실행 cascade로 render 폭주가 나므로,
 * 표시용(사이드패널 진도 모달)은 반드시 이 함수를 쓴다.
 * 실제 row 생성/갱신은 SESSION_TICK(background)·옵션 페이지·mount effect가 담당.
 */
export async function readTodayGoal(): Promise<DailyGoal> {
  const date = todayKey();
  const existing = await db.dailyGoals.get(date);
  if (existing) return existing;
  const { targetMinutes, targetListens } = await loadTargets();
  return {
    date,
    targetMinutes,
    targetListens,
    achievedMinutes: 0,
    achievedListens: 0,
    completed: 0,
  };
}

export async function getOrCreateTodayGoal(): Promise<DailyGoal> {
  const date = todayKey();
  const { targetMinutes, targetListens } = await loadTargets();
  const existing = await db.dailyGoals.get(date);
  if (existing) {
    // settings가 그 사이 바뀌었을 수 있어서 매번 target sync.
    // 과거 일자(어제 이전) row의 target은 보존 — getOrCreateTodayGoal이 오늘만 다루므로.
    if (
      existing.targetMinutes !== targetMinutes ||
      existing.targetListens !== targetListens
    ) {
      const updated: DailyGoal = {
        ...existing,
        targetMinutes,
        targetListens,
      };
      updated.completed = isCompleted(updated);
      await db.dailyGoals.put(updated);
      return updated;
    }
    return existing;
  }
  const fresh: DailyGoal = {
    date,
    targetMinutes,
    targetListens,
    achievedMinutes: 0,
    achievedListens: 0,
    completed: 0,
  };
  await db.dailyGoals.put(fresh);
  return fresh;
}

function isCompleted(g: DailyGoal): 0 | 1 {
  return g.achievedMinutes >= g.targetMinutes && g.achievedListens >= g.targetListens
    ? 1
    : 0;
}

/**
 * 측정된 active seconds를 오늘 목표에 누적.
 * 분 단위로 저장 (소수 허용 — 정밀도 유지).
 * Returns {completed: true} on transition 0→1 so callers can notify.
 */
export async function addAchievedSeconds(
  seconds: number,
): Promise<{ goal: DailyGoal; justCompleted: boolean }> {
  const cur = await getOrCreateTodayGoal();
  const before = cur.completed;
  const next: DailyGoal = {
    ...cur,
    achievedMinutes: cur.achievedMinutes + seconds / 60,
  };
  next.completed = isCompleted(next);
  await db.dailyGoals.put(next);
  return { goal: next, justCompleted: before === 0 && next.completed === 1 };
}

/**
 * listenCount +1 이벤트마다 호출. dailyGoals.achievedListens 누적.
 */
export async function addAchievedListen(): Promise<{
  goal: DailyGoal;
  justCompleted: boolean;
}> {
  const cur = await getOrCreateTodayGoal();
  const before = cur.completed;
  const next: DailyGoal = {
    ...cur,
    achievedListens: cur.achievedListens + 1,
  };
  next.completed = isCompleted(next);
  await db.dailyGoals.put(next);
  return { goal: next, justCompleted: before === 0 && next.completed === 1 };
}

