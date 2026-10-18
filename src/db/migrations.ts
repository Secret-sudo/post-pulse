// Versioned IndexedDB schema (SPEC §5). Never edit a released version: add a
// new one with an `upgrade` that moves existing data forward (TC-M07).

import type { Version } from 'dexie';

export interface Migration {
  version: number;
  stores: Record<string, string | null>;
  /** May return a promise; Dexie waits for it. */
  upgrade?: Parameters<Version['upgrade']>[0];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    stores: {
      posts: 'postId, publishDate, authorSlug, postType',
      snapshots: '[postId+importId], postId, importId, asOf',
      imports: 'importId, &fileHash, importedAt',
      topics: 'id',
      settings: 'key',
    },
  },
];
