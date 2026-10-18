// Live view of the stored history and settings (Dexie live queries, SPEC §10).
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/instance.ts';
import { getSettings } from '../db/repo.ts';
import type { ImportRecord, Post, Settings } from '../db/types.ts';
import { SAMPLE_FILE_HASH } from '../sample/sampleData.ts';

export interface History {
  posts: Post[];
  imports: ImportRecord[];
  latestExportDate: string | null;
  isSample: boolean;
  settings: Settings;
}

/** `undefined` while the first read is in flight. */
export function useHistory(): History | undefined {
  return useLiveQuery(async () => {
    const [posts, imports, settings] = await Promise.all([
      db.posts.toArray(),
      db.imports.toArray(),
      getSettings(db),
    ]);
    const latestExportDate = imports.reduce<string | null>(
      (max, i) => (max === null || i.rangeEnd > max ? i.rangeEnd : max),
      null,
    );
    return {
      posts,
      imports,
      latestExportDate,
      isSample: imports.some((i) => i.fileHash === SAMPLE_FILE_HASH),
      settings,
    };
  });
}
