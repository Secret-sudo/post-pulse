// Small read/write helpers shared by import, backup and the UI.

import type { PostPulseDb } from './schema.ts';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from './types.ts';

export async function getSettings(db: PostPulseDb): Promise<Settings> {
  const row = await db.settings.get(SETTINGS_KEY);
  if (!row) return { ...DEFAULT_SETTINGS };
  const { key: _key, ...settings } = row;
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(db: PostPulseDb, patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings(db)), ...patch };
  await db.settings.put({ key: SETTINGS_KEY, ...next });
  return next;
}

/** "Latest export date" of the whole history: max `rangeEnd` over all imports (SPEC §4.5). */
export async function latestExportDate(db: PostPulseDb): Promise<string | null> {
  const imports = await db.imports.toArray();
  return imports.reduce<string | null>(
    (max, i) => (max === null || i.rangeEnd > max ? i.rangeEnd : max),
    null,
  );
}

/** Author slugs already in the history. */
export async function knownAuthors(db: PostPulseDb): Promise<Set<string>> {
  const keys = await db.posts.orderBy('authorSlug').uniqueKeys();
  return new Set(keys.map(String).filter((k) => k !== ''));
}

export async function clearAll(db: PostPulseDb): Promise<void> {
  await db.transaction(
    'rw',
    [db.posts, db.snapshots, db.imports, db.topics, db.settings],
    async () => {
      await Promise.all([
        db.posts.clear(),
        db.snapshots.clear(),
        db.imports.clear(),
        db.topics.clear(),
        db.settings.clear(),
      ]);
    },
  );
}
