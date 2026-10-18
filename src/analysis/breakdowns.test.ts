import { makePost } from '../../tests/builders/posts.ts';
import {
  byHashtagOpener,
  byOutOfNetwork,
  byPostType,
  byPostsPerDay,
  byWeekday,
  groupStats,
  isoWeekStart,
  oonBucket,
  outOfNetworkCorrelation,
  rhythm,
  rollingMedianSeries,
  videoStats,
  weekday,
  weeklySeries,
} from './breakdowns.ts';

describe('breakdowns (SPEC §6.3)', () => {
  it('TC-A05 outside-network bucket boundaries', () => {
    const cases: [number, string][] = [
      [0, '0-40'],
      [40, '0-40'],
      [40.5, '41-60'],
      [41, '41-60'],
      [60, '41-60'],
      [61, '61-80'],
      [80, '61-80'],
      [81, '81-100'],
      [100, '81-100'],
    ];
    for (const [pct, bucket] of cases) expect(oonBucket(pct), String(pct)).toBe(bucket);
  });

  it('TC-A07 ISO weeks start on Monday', () => {
    expect(isoWeekStart('2026-10-11')).toBe('2026-10-05');
    expect(isoWeekStart('2026-10-12')).toBe('2026-10-12');
    expect(weekday('2026-10-11')).toBe('Sun');
    expect(weekday('2026-10-12')).toBe('Mon');
  });

  it('TC-A08 groups with fewer than 3 posts are flagged too few', () => {
    const two = [makePost({ date: '2026-10-01' }), makePost({ date: '2026-10-02' })];
    expect(groupStats(two).tooFew).toBe(true);
    expect(groupStats([...two, makePost({ date: '2026-10-03' })]).tooFew).toBe(false);
  });

  it('breaks down by type, outside-network bucket, weekday and posts per day', () => {
    const posts = [
      makePost({ date: '2026-10-12', type: 'Video', impressions: 300, oon: 70 }),
      makePost({ date: '2026-10-12', type: 'Image', impressions: 100, oon: 10 }),
      makePost({ date: '2026-10-13', type: 'Image', impressions: 200, oon: null }),
    ];
    const types = byPostType(posts);
    expect(types.get('Image')).toMatchObject({ posts: 2, medianImpressions: 150, tooFew: true });
    expect(types.get('Video')?.posts).toBe(1);

    const oon = byOutOfNetwork(posts);
    expect([...oon.keys()]).toEqual(['0-40', '41-60', '61-80', '81-100']);
    expect([...oon.values()].map((g) => g.posts)).toEqual([1, 0, 1, 0]);

    const days = byWeekday(posts);
    expect([...days.keys()][0]).toBe('Mon');
    expect(days.get('Mon')?.posts).toBe(2);
    expect(days.get('Tue')?.posts).toBe(1);
    expect(days.get('Sun')?.medianImpressions).toBeNull();

    const perDay = byPostsPerDay(posts);
    expect(perDay.get('multiple')?.posts).toBe(2);
    expect(perDay.get('single')?.posts).toBe(1);
  });

  it('splits hashtag openers from other posts', () => {
    const r = byHashtagOpener([
      makePost({ date: '2026-10-01', hashtags: true, impressions: 50 }),
      makePost({ date: '2026-10-02', impressions: 150 }),
    ]);
    expect([r.hashtag.medianImpressions, r.other.medianImpressions]).toEqual([50, 150]);
  });

  it('measures posting rhythm', () => {
    const posts = [
      '2026-10-01',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-03',
      '2026-10-03',
    ].map((date) => makePost({ date }));
    const r = rhythm(posts);
    expect(r.posts).toBe(6);
    expect(r.postsPerWeek).toBeCloseTo(1.4, 10);
    expect(r.daysWithMultiplePosts).toBe(2);
  });

  it('builds a gap-free weekly series with a viral split', () => {
    const series = weeklySeries(
      [
        makePost({ date: '2026-09-29', impressions: 100 }),
        makePost({ date: '2026-10-01', impressions: 5000 }),
        makePost({ date: '2026-10-14', impressions: 200 }),
      ],
      3000,
    );
    expect(series).toEqual([
      { weekStart: '2026-09-28', posts: 2, impressionsRegular: 100, impressionsViral: 5000 },
      { weekStart: '2026-10-05', posts: 0, impressionsRegular: 0, impressionsViral: 0 },
      { weekStart: '2026-10-12', posts: 1, impressionsRegular: 200, impressionsViral: 0 },
    ]);
    expect(weeklySeries([], 10)).toEqual([]);
    expect(
      weeklySeries([makePost({ date: '2026-10-01', impressions: 9 })], null)[0]?.impressionsRegular,
    ).toBe(9);
  });

  it('TC-A06 rolling median series follows publish date order', () => {
    const posts = [30, 10, 20].map((impressions, i) =>
      makePost({ date: `2026-10-0${3 - i}`, impressions }),
    );
    expect(rollingMedianSeries(posts).map((p) => p.value)).toEqual([20, 15, 20]);
  });

  it('correlates outside-network share with impressions, skipping unknown shares', () => {
    const posts = [
      makePost({ date: '2026-10-01', oon: 10, impressions: 100 }),
      makePost({ date: '2026-10-02', oon: 50, impressions: 300 }),
      makePost({ date: '2026-10-03', oon: 90, impressions: 900 }),
      makePost({ date: '2026-10-04', oon: null, impressions: 1 }),
    ];
    expect(outOfNetworkCorrelation(posts)).toEqual({ n: 3, rho: expect.closeTo(1, 10) });
  });

  it('summarises videos', () => {
    const v = videoStats([
      makePost({
        date: '2026-10-01',
        type: 'Video',
        impressions: 1000,
        metrics: { views: 100, avgWatchTimeSec: 10, watchTimeSec: 1000 },
      }),
      makePost({
        date: '2026-10-02',
        type: 'Video',
        impressions: 500,
        metrics: { views: 100, avgWatchTimeSec: 20, watchTimeSec: 133200 },
      }),
      makePost({ date: '2026-10-03', type: 'Image' }),
    ]);
    expect(v).toEqual({
      videos: 2,
      totalViews: 200,
      medianViewRate: expect.closeTo(0.15, 10),
      medianAvgWatchTimeSec: 15,
      maxWatchTimeSec: 133200,
    });
  });
});
