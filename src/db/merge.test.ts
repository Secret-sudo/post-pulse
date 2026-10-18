// @vitest-environment node
import expected from '../../fixtures/synthetic/syn-merge.expected.json';
import { dbContents, freshDb, importFixture } from '../../tests/builders/db.ts';
import { formatWarning } from './merge.ts';
import { latestExportDate } from './repo.ts';
import type { PostPulseDb } from './schema.ts';

const A = expected.a.file;
const B = expected.b.file;
const OTHER = expected.otherAuthor.file;

let db: PostPulseDb;
beforeEach(() => {
  db = freshDb();
});
afterEach(async () => {
  await db.delete();
});

const totalImpressions = async () =>
  (await db.posts.toArray()).reduce((s, p) => s + p.metrics.impressions, 0);

describe('import merge rules (SPEC §5)', () => {
  it('imports a first export as all new posts', async () => {
    const r = await importFixture(db, A);
    expect(r.status).toBe('imported');
    if (r.status !== 'imported') return;
    expect(r.record).toMatchObject({
      fileName: A,
      format: 'F1',
      headerLanguage: 'en',
      rangeStart: expected.a.rangeStart,
      rangeEnd: expected.a.rangeEnd,
      postsNew: expected.a.posts,
      postsUpdated: 0,
      postsUnchanged: 0,
      warnings: [],
    });
    expect(r.record.fileHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await db.posts.count()).toBe(expected.a.posts);
    expect(await totalImpressions()).toBe(expected.a.totalImpressions);
    const post = await db.posts.get('7400000000000001000');
    expect(post).toMatchObject({
      metricsAsOf: expected.a.rangeEnd,
      topics: [],
      authorSlug: 'sample',
    });
  });

  it('TC-M01 re-importing the same file is a no-op', async () => {
    const first = await importFixture(db, A);
    const before = await dbContents(db);
    const second = await importFixture(db, A);
    expect(second.status).toBe('already-imported');
    if (first.status === 'imported' && second.status === 'already-imported') {
      expect(second.record.importId).toBe(first.record.importId);
    }
    expect(await dbContents(db)).toEqual(before);
    expect(await db.imports.count()).toBe(1);
  });

  it('TC-M02 an overlapping newer export updates, adds and keeps dropped posts', async () => {
    await importFixture(db, A);
    const r = await importFixture(db, B);
    expect(r.status === 'imported' && r.record).toMatchObject(expected.aThenB.importB);
    expect(await db.posts.count()).toBe(expected.aThenB.totalPosts);
    expect(await db.snapshots.count()).toBe(expected.aThenB.totalSnapshots);
    expect(await totalImpressions()).toBe(expected.aThenB.totalImpressions);

    const dropped = await db.posts.bulkGet(expected.aThenB.droppedPostIds);
    expect(dropped.map((p) => p?.metrics.impressions)).toEqual(expected.aThenB.droppedImpressions);
    expect(dropped.every((p) => p?.metricsAsOf === expected.a.rangeEnd)).toBe(true);

    const u = expected.aThenB.updatedExample;
    expect(await db.posts.get(u.postId)).toMatchObject({
      metricsAsOf: u.metricsAsOf,
      metrics: { impressions: u.impressions, comments: u.comments },
    });
    const same = expected.aThenB.unchangedExample;
    expect(await db.posts.get(same.postId)).toMatchObject({
      metricsAsOf: same.metricsAsOf,
      metrics: { impressions: same.impressions, comments: same.comments },
    });
    expect(await db.snapshots.where('postId').equals(u.postId).count()).toBe(2);
    expect(await latestExportDate(db)).toBe(expected.aThenB.latestExportDate);
  });

  it('TC-M03 an older export imported later adds history but keeps newer metrics', async () => {
    await importFixture(db, B);
    const r = await importFixture(db, A);
    expect(r.status === 'imported' && r.record).toMatchObject(expected.bThenA.importA);
    expect(await db.posts.count()).toBe(expected.bThenA.totalPosts);
    expect(await db.snapshots.count()).toBe(expected.bThenA.totalSnapshots);
    expect(await totalImpressions()).toBe(expected.bThenA.totalImpressions);
    const s = expected.bThenA.sharedExample;
    expect(await db.posts.get(s.postId)).toMatchObject({
      metricsAsOf: s.metricsAsOf,
      metrics: { impressions: s.impressions },
    });
    expect(await latestExportDate(db)).toBe(expected.b.rangeEnd);
  });

  it('TC-M04 with equal export dates the later import becomes current', async () => {
    const { toXlsx, f1Rows } = await import('../../tests/builders/f1.ts');
    const url = 'https://www.linkedin.com/posts/sample_same-day-ugcPost-7400000000000003000-AbCd';
    const name = 'PostPerformance_2026-09-01_2026-10-14.xlsx';
    const { importBytes } = await import('../../tests/builders/db.ts');
    await importBytes(db, toXlsx(f1Rows([{ 'Post URL': url, Impressions: '100' }])), name);
    const r = await importBytes(
      db,
      toXlsx(f1Rows([{ 'Post URL': url, Impressions: '120' }])),
      name,
    );
    expect(r.status === 'imported' && r.record).toMatchObject({ postsUpdated: 1 });
    expect((await db.posts.get('7400000000000003000'))?.metrics.impressions).toBe(120);
  });

  it('TC-M05 asks before importing another profile; cancel changes nothing', async () => {
    await importFixture(db, A);
    const before = await dbContents(db);
    const ask = vi.fn(() => false);
    const r = await importFixture(db, OTHER, { confirmOtherAuthor: ask });
    expect(ask).toHaveBeenCalledWith({ existing: ['sample'], incoming: ['someoneelse'] });
    expect(r).toEqual({ status: 'cancelled', reason: 'other-author' });
    expect(await dbContents(db)).toEqual(before);
  });

  it('TC-M05 without an answer the import is cancelled', async () => {
    await importFixture(db, A);
    expect((await importFixture(db, OTHER)).status).toBe('cancelled');
  });

  it('TC-M05 "Import anyway" merges the other profile', async () => {
    await importFixture(db, A);
    const r = await importFixture(db, OTHER, { confirmOtherAuthor: async () => true });
    expect(r.status === 'imported' && r.record.postsNew).toBe(expected.otherAuthor.posts);
    expect(await db.posts.count()).toBe(expected.a.posts + expected.otherAuthor.posts);
  });

  it('TC-M06 a failure half-way rolls the whole import back', async () => {
    await importFixture(db, A);
    const before = await dbContents(db);
    const spy = vi.spyOn(db.imports, 'add').mockRejectedValueOnce(new Error('disk full'));
    await expect(importFixture(db, B)).rejects.toThrow('disk full');
    spy.mockRestore();
    expect(await dbContents(db)).toEqual(before);
  });

  it('stores parse warnings as readable lines', () => {
    expect(
      formatWarning({
        code: 'x',
        message: 'Empty comments counted as 0.',
        row: 3,
        column: 'comments',
      }),
    ).toBe('Row 3, comments: Empty comments counted as 0.');
    expect(formatWarning({ code: 'x', message: 'Dates were switched.' })).toBe(
      'Dates were switched.',
    );
  });
});
