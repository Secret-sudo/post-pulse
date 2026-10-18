import { makePost } from '../../../tests/builders/posts.ts';
import { formatTiers, outOfNetworkBuckets, postingRhythm } from './model.ts';

const posts = [
  ...[100, 120, 140].map((impressions, i) =>
    makePost({ date: `2026-09-0${i + 1}`, impressions, type: 'Image', oon: 20 }),
  ),
  ...[400, 500, 600].map((impressions, i) =>
    makePost({ date: `2026-09-1${i + 1}`, impressions, type: 'Video', oon: 70 }),
  ),
  makePost({ date: '2026-09-20', impressions: 5000, type: 'Poll', oon: 95 }),
];

describe('breakdowns model (SPEC §6.3)', () => {
  it('ranks formats by median and puts too-small groups last', () => {
    const t = formatTiers(posts);
    expect(t.overallMedian).toBe(400);
    expect(t.rows.map((r) => [r.type, r.medianImpressions, r.tooFew])).toEqual([
      ['Video', 500, false],
      ['Image', 120, false],
      ['Poll', 5000, true],
    ]);
    expect(t.rows[0]?.ratio).toBeCloseTo(1.25, 10);
    expect(formatTiers([]).overallMedian).toBeNull();
  });

  it('fills all four outside-network buckets in order', () => {
    expect(outOfNetworkBuckets(posts).map((b) => [b.label, b.posts, b.medianImpressions])).toEqual([
      ['0–40 %', 3, 120],
      ['41–60 %', 0, null],
      ['61–80 %', 3, 500],
      ['81–100 %', 1, 5000],
    ]);
  });

  it('splits weekly impressions into regular and viral', () => {
    const r = postingRhythm(posts, 3000);
    expect(r.totalPosts).toBe(7);
    expect(r.viralImpressions).toBe(5000);
    // Weeks start on Monday: 31 Aug (1–3 Sep), 7 Sep (11–13 Sep), 14 Sep (20 Sep).
    expect(
      r.points.map((p) => [p.start, p.posts, p.impressionsRegular, p.impressionsViral]),
    ).toEqual([
      ['2026-08-31', 3, 360, 0],
      ['2026-09-07', 3, 1500, 0],
      ['2026-09-14', 1, 0, 5000],
    ]);
  });

  it('groups the rhythm by day or month too, filling gaps with zeros', () => {
    const days = postingRhythm(posts, 3000, 'day').points;
    expect(days).toHaveLength(20);
    expect(days[3]).toEqual({
      start: '2026-09-04',
      posts: 0,
      impressionsRegular: 0,
      impressionsViral: 0,
    });
    expect(postingRhythm(posts, 3000, 'month').points).toEqual([
      { start: '2026-09-01', posts: 7, impressionsRegular: 1860, impressionsViral: 5000 },
    ]);
    const spread = [makePost({ date: '2026-08-31' }), makePost({ date: '2026-10-02' })];
    expect(postingRhythm(spread, null, 'month').points.map((p) => [p.start, p.posts])).toEqual([
      ['2026-08-01', 1],
      ['2026-09-01', 0],
      ['2026-10-01', 1],
    ]);
  });
});
