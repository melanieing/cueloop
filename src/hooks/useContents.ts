import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Content } from '../db';
import { sortContentsByTitle } from '../lib/contentSort';
import { useDbVersion } from './useDbVersion';

export function useContents(): Content[] | undefined {
  const version = useDbVersion();
  return useLiveQuery(
    async () => sortContentsByTitle(await db.contents.toArray()),
    [version],
  );
}
