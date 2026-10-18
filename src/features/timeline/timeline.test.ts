import { DEFAULT_ANALYSIS_SETTINGS, makePost } from '../../../tests/builders/posts.ts';
import { headline } from '../../analysis/metrics.ts';
import { buildTimeline, metricValue, shortTitle, symbolSize } from './timeline.ts';

const E = '2026-10-14';
const posts = [
  makePost({ date: '2026-09-03', impressions: 300, comments: 4, oon: 40 }),
  makePost({ date: '2026-09-01', impressions: 100, comments: 0, oon: 10, reach: null }),
  makePost({ date: '2026-09-02', impressions: 900, comments: 1, oon: 80, type: 'Video' }),
  makePost({ date: '2026-08-01', impressions: 50, comments: 9, oon: 5 }),
];
const windows = headline({ posts, latestExportDate: E }, DEFAULT_ANALYSIS_SETTINGS).windows;

describe('timeline model (SPEC §9.2)', () => {
  it('orders points by date and labels the top 3', () => {
    const m = buildTimeline(posts, 'impressions', windows, 0, true);
    expect(m.points.map((p) => p.date)).toEqual([
      '2026-08-01',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
    expect(
      m.points
        .filter((p) => p.top)
        .map((p) => p.value)
        .sort((a, b) => b - a),
    ).toEqual([900, 300, 100]);
    expect(m.typesPresent.sort()).toEqual(['Image', 'Video']);
  });

  it('draws a trailing median line in date order', () => {
    expect(
      buildTimeline(posts, 'impressions', windows, 0, true).rolling.map((r) => r.value),
    ).toEqual([50, 75, 100, 200]);
  });

  it('uses a log axis for counts when every value is positive', () => {
    expect(buildTimeline(posts, 'impressions', windows, 0, true)).toMatchObject({
      log: true,
      logUnavailable: false,
    });
    expect(buildTimeline(posts, 'impressions', windows, 0, false).log).toBe(false);
    expect(buildTimeline(posts, 'engagementRate', windows, 0, true)).toMatchObject({
      log: false,
      logUnavailable: false,
    });
    const zero = [...posts, makePost({ date: '2026-09-05', impressions: 0 })];
    expect(buildTimeline(zero, 'impressions', windows, 0, true)).toMatchObject({
      log: false,
      logUnavailable: true,
    });
  });

  it('leaves out posts without a value for the metric', () => {
    expect(buildTimeline(posts, 'reach', windows, 0, true).points).toHaveLength(3);
    expect(metricValue(posts[0]!, 'engagements')).toBe(6);
    expect(metricValue(posts[0]!, 'outOfNetwork')).toBe(40);
  });

  it('shades every window and marks the selected one', () => {
    const bands = buildTimeline(posts, 'impressions', windows, 1, true).bands;
    expect(bands.map((b) => [b.label, b.start, b.end, b.selected])).toEqual([
      ['W3', '2026-09-15', '2026-10-14', false],
      ['W2', '2026-08-16', '2026-09-14', true],
      ['W1', '2026-07-17', '2026-08-15', false],
    ]);
  });

  it('sizes points by comments and shortens labels', () => {
    expect(symbolSize(0)).toBe(6);
    expect(symbolSize(4)).toBe(12);
    expect(symbolSize(10_000)).toBe(24);
    expect(shortTitle('short')).toBe('short');
    expect(Array.from(shortTitle('x'.repeat(60)))).toHaveLength(40);
  });
});
