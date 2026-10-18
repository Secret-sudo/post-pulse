// @vitest-environment node
import { EN_HEADERS, f1Rows, sampleUrl } from '../../tests/builders/f1.ts';
import { detectF1 } from './detect.ts';
import { parseF1, rangeFromFileName } from './parseF1.ts';
import type { Cell, F1Result } from './types.ts';

const FILE = 'PostPerformance_2026-07-17_2026-10-14.xlsx';

async function parse(rows: Cell[][], fileName = FILE) {
  const header = rows[0];
  if (!header) throw new Error('no header row');
  return parseF1(rows, detectF1(header), fileName, 'POST PERFORMANCE');
}

async function parseOk(rows: Cell[][], fileName = FILE): Promise<F1Result> {
  const r = await parse(rows, fileName);
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}`);
  return r;
}

describe('F1 parser (SPEC §4.2)', () => {
  it('parses a typical row into canonical fields', async () => {
    const url =
      'https://www.linkedin.com/posts/sample_a-video-post-ugcPost-7400000000000000100-AbCd';
    const r = await parseOk(
      f1Rows([
        {
          'Post URL': url,
          'Post Publish Date': '9/9/2026',
          'Post type': 'Video',
          Impressions: '1,368',
          Views: '260',
          'Watch time': '1h 3m',
          'Avg watch time': '14s',
          'Visits to links': '',
        },
      ]),
    );
    expect(r).toMatchObject({
      format: 'F1',
      headerLanguage: 'en',
      rangeStart: '2026-07-17',
      rangeEnd: '2026-10-14',
    });
    expect(r.warnings).toEqual([]);
    expect(r.posts[0]).toMatchObject({
      postId: '7400000000000000100',
      authorSlug: 'sample',
      title: 'a video post',
      titleIsHashtags: false,
      publishDate: '2026-09-09',
      postType: 'Video',
      postTypeRaw: 'Video',
      metrics: {
        impressions: 1368,
        inNetworkPct: 70,
        outOfNetworkPct: 30,
        membersReached: 120,
        views: 260,
        watchTimeSec: 3780,
        avgWatchTimeSec: 14,
        reactions: 5,
        comments: 1,
        linkVisits: null,
      },
    });
    expect(r.posts[0]?.raw).toBeUndefined();
  });

  it('TC-P06 switches an EN file to day/month when only that order is valid', async () => {
    const r = await parseOk(
      f1Rows([{ 'Post Publish Date': '13/10/2026' }, { 'Post Publish Date': '1/10/2026' }]),
    );
    expect(r.posts.map((p) => p.publishDate)).toEqual(['2026-10-13', '2026-10-01']);
    expect(r.warnings.map((w) => w.code)).toContain('date-order-switched');
  });

  it('TC-P06 keeps month/day when some dates are invalid either way', async () => {
    const r = await parseOk(
      f1Rows([{ 'Post Publish Date': '10/1/2026' }, { 'Post Publish Date': '13/13/2026' }]),
    );
    expect(r.posts.map((p) => p.publishDate)).toEqual(['2026-10-01']);
    expect(r.warnings.map((w) => w.code)).toEqual(['bad-value', 'row-skipped']);
    expect(r.warnings[1]).toMatchObject({ row: 3, column: 'publishDate' });
  });

  it('TC-P11 maps unknown and empty post types to Other and keeps the raw label', async () => {
    const r = await parseOk(f1Rows([{ 'Post type': 'Carousel' }, { 'Post type': '' }]));
    expect(r.posts.map((p) => [p.postType, p.postTypeRaw])).toEqual([
      ['Other', 'Carousel'],
      ['Other', ''],
    ]);
    expect(r.warnings).toEqual([expect.objectContaining({ row: 3, column: 'postType' })]);
  });

  it('TC-P14 keeps extra columns in raw', async () => {
    const rows: Cell[][] = [
      [...EN_HEADERS, 'Hashtags'],
      [...(f1Rows([{}])[1] ?? []), '#ai #banking'],
    ];
    const r = await parseOk(rows);
    expect(r.posts[0]?.raw).toEqual({ Hashtags: '#ai #banking' });
    expect(r.warnings).toEqual([]);
  });

  it('TC-P15 reads the export range from the file name', async () => {
    expect(rangeFromFileName(FILE)).toEqual({ start: '2026-07-17', end: '2026-10-14' });
    expect(rangeFromFileName('export.xlsx')).toBeNull();
    expect(rangeFromFileName('PostPerformance_2026-13-40_2026-10-14.xlsx')).toBeNull();
  });

  it('TC-P15 falls back to the latest post date without a range in the name', async () => {
    const r = await parseOk(
      f1Rows([{ 'Post Publish Date': '10/1/2026' }, { 'Post Publish Date': '10/9/2026' }]),
      'export.xlsx',
    );
    expect(r.rangeEnd).toBe('2026-10-09');
    expect(r.rangeStart).toBeUndefined();
  });

  it('TC-P18 warns when in-network and out-of-network do not add up to 100 %', async () => {
    const r = await parseOk(
      f1Rows([
        { 'Impressions (in-network)': '60%', 'Impressions (out-of-network)': '30%' },
        { 'Impressions (in-network)': '82%', 'Impressions (out-of-network)': '19%' },
      ]),
    );
    expect(r.posts).toHaveLength(2);
    expect(r.warnings).toEqual([expect.objectContaining({ code: 'network-sum', row: 2 })]);
  });

  it('TC-P02 counts empty required counts as 0 with a warning', async () => {
    const r = await parseOk(f1Rows([{ Comments: '', Reactions: '-' }]));
    expect(r.posts[0]?.metrics).toMatchObject({ comments: 0, reactions: 0 });
    expect(r.warnings.map((w) => [w.code, w.column])).toEqual([
      ['defaulted-to-zero', 'reactions'],
      ['defaulted-to-zero', 'comments'],
    ]);
  });

  it('skips rows without URL, duplicate posts and fully empty rows', async () => {
    const dup = sampleUrl('dup');
    const rows = f1Rows([{ 'Post URL': dup }, { 'Post URL': '' }, { 'Post URL': dup }]);
    rows.push(EN_HEADERS.map(() => ''));
    const r = await parseOk(rows);
    expect(r.posts).toHaveLength(1);
    expect(r.warnings.map((w) => [w.code, w.row])).toEqual([
      ['row-skipped', 3],
      ['duplicate-post', 4],
    ]);
  });

  it('warns about posts dated outside the file-name range', async () => {
    const r = await parseOk(
      f1Rows([
        { 'Post Publish Date': '7/16/2026' },
        { 'Post Publish Date': '7/15/2026' },
        { 'Post Publish Date': '10/16/2026' },
      ]),
    );
    expect(r.warnings.map((w) => w.message)).toEqual([
      expect.stringContaining('2026-07-15'),
      expect.stringContaining('2026-10-16'),
    ]);
  });

  it('TC-P16 reports an export with only a header row as empty', async () => {
    const r = await parse([[...EN_HEADERS]]);
    expect(r).toEqual({ ok: false, error: expect.objectContaining({ code: 'empty' }) });
  });

  it('reports an export whose rows are all unreadable as empty', async () => {
    const r = await parse(f1Rows([{ 'Post URL': '' }]));
    expect(r).toEqual({ ok: false, error: expect.objectContaining({ code: 'empty' }) });
  });
});
