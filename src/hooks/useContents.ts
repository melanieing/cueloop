import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Content } from '../db';
import { useDbVersion } from './useDbVersion';

export function useContents(): Content[] | undefined {
  const version = useDbVersion();
  return useLiveQuery(
    () => db.contents.orderBy('createdAt').reverse().toArray(),
    [version],
  );
}
