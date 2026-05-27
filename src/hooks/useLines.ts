import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Line } from '../db';
import { useDbVersion } from './useDbVersion';

export function useLines(contentId: number | undefined): Line[] | undefined {
  const version = useDbVersion();
  return useLiveQuery(async () => {
    if (contentId == null) return undefined;
    const rows = await db.lines.where('contentId').equals(contentId).toArray();
    rows.sort((a, b) => a.startMs - b.startMs);
    return rows;
  }, [contentId, version]);
}
