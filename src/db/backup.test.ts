// @vitest-environment node
import expected from '../../fixtures/synthetic/syn-merge.expected.json';
import { dbContents, freshDb, importFixture } from '../../tests/builders/db.ts';
import {
  backupFileName,
  createBackup,
  deleteAllData,
  parseBackup,
  restoreBackup,
  type BackupFile,
} from './backup.ts';
import { getSettings, saveSettings } from './repo.ts';
import type { PostPulseDb } from './schema.ts';
import { DEFAULT_SETTINGS } from './types.ts';

let db: PostPulseDb;
beforeEach(async () => {
  db = freshDb();
  await importFixture(db, expected.a.file);
  await importFixture(db, expected.b.file);
  await saveSettings(db, { theme: 'dark', breakoutMultiplier: 4 });
  await db.topics.add({
    id: 't1',
    name: 'AI',
    color: '#0a66c2',
    keywords: ['ai'],
    manualPostIds: [],
  });
});
afterEach(async () => {
  await db.delete();
});

const roundTrip = async (backup: BackupFile) => {
  const parsed = parseBackup(JSON.stringify(backup));
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.backup;
};

describe('backup, restore and delete (SPEC §5)', () => {
  it('names the backup file by date', () => {
    expect(backupFileName(new Date('2026-10-16T18:00:00Z'))).toBe(
      'postpulse-backup-2026-10-16.json',
    );
  });

  it('TC-D01 backup → delete all → restore (replace) gives back the same data', async () => {
    const before = await dbContents(db);
    const backup = await roundTrip(await createBackup(db, new Date('2026-10-16T00:00:00Z')));
    expect(backup).toMatchObject({
      app: 'post-pulse',
      backupVersion: 1,
      exportedAt: '2026-10-16T00:00:00.000Z',
    });
    await deleteAllData(db);
    expect(await db.posts.count()).toBe(0);
    await restoreBackup(db, backup, 'replace');
    expect(await dbContents(db)).toEqual(before);
  });

  it('TC-D02 restore (merge) applies the import merge rules', async () => {
    const backup = await roundTrip(await createBackup(db));
    const other = freshDb();
    await importFixture(other, expected.a.file);
    await saveSettings(other, { theme: 'light' });

    const summary = await restoreBackup(other, backup, 'merge');
    // 34 posts in the backup: 4 new, 10 changed, 15 identical + the 5 dropped ones identical too.
    expect(summary).toEqual({ postsNew: 4, postsUpdated: 10, postsUnchanged: 20 });
    expect(await other.posts.get(expected.aThenB.unchangedExample.postId)).toMatchObject({
      metricsAsOf: expected.aThenB.unchangedExample.metricsAsOf,
    });
    expect(await other.posts.count()).toBe(expected.aThenB.totalPosts);
    expect(await other.snapshots.count()).toBe(expected.aThenB.totalSnapshots);
    expect(await other.imports.count()).toBe(2);
    expect(
      (await other.posts.get(expected.aThenB.updatedExample.postId))?.metrics.impressions,
    ).toBe(expected.aThenB.updatedExample.impressions);
    expect((await getSettings(other)).theme).toBe('light');
    expect(await other.topics.count()).toBe(1);

    const again = await restoreBackup(other, backup, 'merge');
    expect(again).toEqual({
      postsNew: 0,
      postsUpdated: 0,
      postsUnchanged: expected.aThenB.totalPosts,
    });
    await other.delete();
  });

  it('TC-D03 rejects invalid, foreign, newer and incomplete backups without changing anything', async () => {
    const before = await dbContents(db);
    const good = await createBackup(db);
    const { posts: _posts, ...missingPosts } = good;
    const cases: [string, string][] = [
      ['not json', '{"app": "post-pulse",'],
      ['wrong app', JSON.stringify({ ...good, app: 'other-app' })],
      ['newer version', JSON.stringify({ ...good, backupVersion: 99 })],
      ['missing posts', JSON.stringify(missingPosts)],
      [
        'bad metric',
        JSON.stringify({ ...good, posts: [{ ...good.posts[0], metrics: { impressions: -1 } }] }),
      ],
      ['array', '[]'],
    ];
    for (const [label, text] of cases) {
      const r = parseBackup(text);
      expect(r.ok, label).toBe(false);
      expect(r.ok ? '' : r.message, label).not.toBe('');
    }
    expect(parseBackup(JSON.stringify({ ...good, backupVersion: 99 }))).toMatchObject({
      message: expect.stringContaining('newer version'),
    });
    expect(await dbContents(db)).toEqual(before);
  });

  it('TC-D04 delete all empties every table and resets settings', async () => {
    await deleteAllData(db);
    for (const table of [db.posts, db.snapshots, db.imports, db.topics, db.settings]) {
      expect(await table.count()).toBe(0);
    }
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });
});
