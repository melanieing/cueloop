import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LineProgress } from '../db';
import { useDbVersion } from './useDbVersion';

/**
 * Map<lineId, LineProgress> — 진도 히트맵용.
 * 한 콘텐츠의 모든 lineProgress 한 번에 bulkGet.
 */
export function useLineProgressMap(
  contentId: number | undefined,
): Map<number, LineProgress> {
  const version = useDbVersion();
  const result = useLiveQuery(async () => {
    if (contentId == null) return new Map<number, LineProgress>();
    const lines = await db.lines.where('contentId').equals(contentId).toArray();
    const lineIds = lines
      .map((l) => l.id)
      .filter((x): x is number => x != null);
    if (lineIds.length === 0) return new Map<number, LineProgress>();
    const progressList = await db.lineProgress.bulkGet(lineIds);
    const map = new Map<number, LineProgress>();
    for (const p of progressList) {
      if (p?.lineId != null) map.set(p.lineId, p);
    }
    return map;
  }, [contentId, version]);
  return result ?? new Map();
}
