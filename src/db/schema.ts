// The Dexie database. One per profile; Phase 1 has a single profile.

import Dexie, { type EntityTable } from 'dexie';
import { MIGRATIONS, type Migration } from './migrations.ts';
import type { ImportRecord, Post, SettingsRow, Snapshot, Topic } from './types.ts';

export const DB_NAME = 'post-pulse';

export type PostPulseDb = Dexie & {
  posts: EntityTable<Post, 'postId'>;
  snapshots: Dexie.Table<Snapshot, [string, string]>;
  imports: EntityTable<ImportRecord, 'importId'>;
  topics: EntityTable<Topic, 'id'>;
  settings: EntityTable<SettingsRow, 'key'>;
};

export function createDb(
  name: string = DB_NAME,
  migrations: readonly Migration[] = MIGRATIONS,
): PostPulseDb {
  const db = new Dexie(name) as PostPulseDb;
  for (const m of migrations) {
    const version = db.version(m.version).stores(m.stores);
    if (m.upgrade) version.upgrade(m.upgrade);
  }
  return db;
}

export const DATA_TABLES = ['posts', 'snapshots', 'imports', 'topics', 'settings'] as const;
