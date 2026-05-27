import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CustomLoop } from '../db';
import { useDbVersion } from './useDbVersion';

export function useCustomLoops(contentId: number | undefined): CustomLoop[] | undefined {
  const version = useDbVersion();
  return useLiveQuery(async () => {
    if (contentId == null) return undefined;
    const rows = await db.customLoops
      .where('contentId')
      .equals(contentId)
      .toArray();
    rows.sort((a, b) => a.startMs - b.startMs);
    return rows;
  }, [contentId, version]);
}
