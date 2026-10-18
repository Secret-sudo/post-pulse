// @vitest-environment node
import basic from '../../../fixtures/synthetic/syn-basic.expected.json';
import merge from '../../../fixtures/synthetic/syn-merge.expected.json';
import { freshDb, readFixture } from '../../../tests/builders/db.ts';
import type { PostPulseDb } from '../../db/schema.ts';
import { importFile } from '../../import/importFile.ts';
import { isSampleLoaded, loadSample } from '../../sample/sampleData.ts';
import { errorReport } from './ImportErrorView.tsx';
import { runImport, type ImportDeps } from './runImport.ts';

let db: PostPulseDb;
beforeEach(() => {
  db = freshDb();
});
afterEach(async () => {
  await db.delete();
});

const input = (name: string, bytes = readFixture(name)) => ({
  name,
  size: bytes.byteLength,
  read: async () => bytes,
});
const deps = (over: Partial<ImportDeps> = {}): ImportDeps => ({
  db,
  parse: importFile,
  confirmOtherAuthor: async () => false,
  ...over,
});

describe('import pipeline (SPEC §9.2)', () => {
  it('imports a file and reports the summary, going through every stage', async () => {
    const stages: string[] = [];
    const r = await runImport(input(basic.file), deps({ onStage: (s) => stages.push(s) }));
    expect(r.kind === 'imported' && r.record).toMatchObject(basic.summary);
    expect(stages).toEqual(['reading', 'parsing', 'saving']);
    expect(await db.posts.count()).toBe(basic.posts);
  });

  it('reports a re-import as already imported', async () => {
    await runImport(input(basic.file), deps());
    expect((await runImport(input(basic.file), deps())).kind).toBe('already-imported');
  });

  it('rejects bad files before reading them', async () => {
    const read = vi.fn();
    const r = await runImport({ name: 'export.csv', size: 10, read }, deps());
    expect(r).toEqual({
      kind: 'error',
      error: expect.objectContaining({ code: 'csv-not-supported' }),
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('passes parse errors through', async () => {
    const r = await runImport(input('syn-unknown-headers.xlsx'), deps());
    expect(r).toEqual({
      kind: 'error',
      error: expect.objectContaining({
        code: 'unknown-headers',
        headersFound: ['Date', 'Clicks', 'Likes'],
      }),
    });
    expect((await runImport(input('syn-empty.xlsx'), deps())).kind).toBe('error');
  });

  it('asks about another profile and honours the answer', async () => {
    await runImport(input(merge.a.file), deps());
    const ask = vi.fn(async () => false);
    expect(
      (await runImport(input(merge.otherAuthor.file), deps({ confirmOtherAuthor: ask }))).kind,
    ).toBe('cancelled');
    expect(ask).toHaveBeenCalledOnce();
  });

  it('replaces sample data with the first real import', async () => {
    await loadSample(db);
    expect(await isSampleLoaded(db)).toBe(true);
    const r = await runImport(input(basic.file), deps());
    expect(r.kind === 'imported' && r.replacedSample).toBe(true);
    expect(await isSampleLoaded(db)).toBe(false);
    expect(await db.posts.count()).toBe(basic.posts);
  });

  it('copies only the error and column names, never post data', () => {
    const text = errorReport(
      { code: 'unknown-headers', message: 'x', headersFound: ['Date', 'Clicks'] },
      'f.xlsx',
    );
    expect(text).toBe(
      'Post Pulse import report\nFile name: f.xlsx\nError: unknown-headers\nColumns found: Date | Clicks',
    );
  });
});
