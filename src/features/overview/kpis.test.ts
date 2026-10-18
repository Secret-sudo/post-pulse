import { DEFAULT_ANALYSIS_SETTINGS, makePost } from '../../../tests/builders/posts.ts';
import { headline, sparkSeries } from '../../analysis/metrics.ts';
import { buildKpis } from './kpis.ts';

const E = '2026-10-14';
const posts = [
  ...[300, 300, 300, 300, 300].map((impressions, i) =>
    makePost({ date: `2026-08-${20 + i}`, impressions, comments: 2 }),
  ),
  ...[200, 200, 200, 200, 200].map((impressions, i) =>
    makePost({ date: `2026-09-${20 + i}`, impressions, comments: 1 }),
  ),
];

const S = DEFAULT_ANALYSIS_SETTINGS;
const kpisFor = (ps: typeof posts, k: number, size: 7 | 30 | 90 | 'all' = 30, bucket = 7) => {
  const dataset = { posts: ps, latestExportDate: E };
  const h = headline(dataset, S, size);
  return buildKpis(h, k, sparkSeries(dataset, S, h, k, bucket));
};

describe('KPI tiles', () => {
  it('compares the selected window with the one before it', () => {
    const kpis = kpisFor(posts, 0);
    const imp = kpis.find((k) => k.id === 'medianImpressions');
    expect(imp).toMatchObject({
      value: 200,
      prior: 300,
      status: 'down-sharply',
      posts: 5,
      priorPosts: 5,
    });
    expect(imp?.change).toBeCloseTo(-1 / 3, 10);
    expect(kpis.find((k) => k.id === 'comments')).toMatchObject({
      value: 5,
      prior: 10,
      status: 'down-sharply',
    });
    expect(kpis.map((k) => k.id)).toEqual([
      'medianImpressions',
      'medianReach',
      'breakouts',
      'comments',
      'followersGained',
      'engagementRate',
    ]);
  });

  it('has no change or chip for the oldest window', () => {
    const kpis = kpisFor(posts, 1);
    expect(kpis[0]).toMatchObject({
      value: 300,
      prior: null,
      change: null,
      status: null,
      priorPosts: null,
    });
  });

  it('sparkline: weeks of the selected window counted back from its last day, gaps as null', () => {
    // W3 = 15 Sep – 14 Oct. Weeks back from 14 Oct: 8–14 Oct, 1–7 Oct, 24–30 Sep,
    // 17–23 Sep and the 2-day rest 15–16 Sep. Posts on 20–24 Sep (200 each).
    const series = kpisFor(posts, 0)[0]?.series;
    expect(series).toEqual([
      { start: '2026-09-15', end: '2026-09-16', value: null, posts: 0 },
      { start: '2026-09-17', end: '2026-09-23', value: 200, posts: 4 },
      { start: '2026-09-24', end: '2026-09-30', value: 200, posts: 1 },
      { start: '2026-10-01', end: '2026-10-07', value: null, posts: 0 },
      { start: '2026-10-08', end: '2026-10-14', value: null, posts: 0 },
    ]);
  });

  it('a 7-day window has one point per day', () => {
    const recent = [makePost({ date: '2026-10-02', impressions: 120 })];
    const series = kpisFor(recent, 0, 7, 1)[0]?.series;
    expect(series).toHaveLength(7);
    expect(series?.[0]).toMatchObject({ start: '2026-10-08', end: '2026-10-08' });
    expect(kpisFor(recent, 1, 7, 1)[0]?.series.find((p) => p.posts > 0)).toEqual({
      start: '2026-10-02',
      end: '2026-10-02',
      value: 120,
      posts: 1,
    });
  });

  it('All time is one window over the whole history, with nothing to compare', () => {
    const imp = kpisFor(posts, 0, 'all')[0];
    // 300 ×5 and 200 ×5: median 250.
    expect(imp).toMatchObject({ value: 250, prior: null, change: null, status: null, posts: 10 });
    // 20 Aug – 14 Oct is exactly 8 weeks back from 14 Oct; the oldest is 20–26 Aug.
    expect(imp?.series).toHaveLength(8);
    expect(imp?.series[0]).toMatchObject({
      start: '2026-08-20',
      end: '2026-08-26',
      value: 300,
      posts: 5,
    });
  });
});
