import { DEFAULT_ANALYSIS_SETTINGS, makePost } from '../../tests/builders/posts.ts';
import { change, compareBest, headline, statusFor, thresholds, windowMetrics } from './metrics.ts';

const E = '2026-10-14';

describe('headline metrics (SPEC §6.2)', () => {
  it('TC-A04 change and status chips at their boundaries', () => {
    const c = change(210, 267);
    expect(c).toBeCloseTo(-0.21348, 5);
    expect(statusFor(c)).toBe('slipping');
    // 90 / 100 − 1 is −0.09999999999999998 in floating point: still Slipping after rounding.
    expect(change(90, 100)).not.toBe(-0.1);
    expect(
      [change(110, 100), change(109, 100), change(90, 100), change(70, 100)].map((x) =>
        x?.toFixed(4),
      ),
    ).toEqual(['0.1000', '0.0900', '-0.1000', '-0.3000']);
    expect(statusFor(change(110, 100))).toBe('growing');
    expect(statusFor(change(109, 100))).toBe('flat');
    expect(statusFor(change(90, 100))).toBe('slipping');
    expect(statusFor(change(70, 100))).toBe('down-sharply');
    expect(change(5, 0)).toBeNull();
    expect(change(null, 5)).toBeNull();
    expect(statusFor(null)).toBeNull();
  });

  it('TC-A04 inverts the status for zero-comment share', () => {
    expect(statusFor(change(0.6, 0.4), true)).toBe('down-sharply');
    expect(statusFor(change(0.3, 0.4), true)).toBe('growing');
  });

  it('TC-A09 best post: most impressions, then earlier date, then lower postId', () => {
    const a = makePost({ date: '2026-10-02', impressions: 500, id: '7400000000000000010' });
    const b = makePost({ date: '2026-10-01', impressions: 500, id: '7400000000000000020' });
    const c = makePost({ date: '2026-10-01', impressions: 500, id: '7400000000000000009' });
    const d = makePost({ date: '2026-10-01', impressions: 500, id: '999' });
    expect([a, b, c].sort(compareBest).map((p) => p.postId)).toEqual([
      '7400000000000000009',
      '7400000000000000020',
      '7400000000000000010',
    ]);
    expect([c, d].sort(compareBest)[0]?.postId).toBe('999');
    expect(compareBest(c, c)).toBe(0);
    const h1 = makePost({ date: '2026-10-01', impressions: 500, id: 'h:bb' });
    const h2 = makePost({ date: '2026-10-01', impressions: 500, id: 'h:aa' });
    expect([h1, h2].sort(compareBest)[0]?.postId).toBe('h:aa');
  });

  it('computes every window metric by definition', () => {
    const posts = [
      makePost({ date: '2026-10-01', impressions: 100, comments: 0, reach: 60, oon: 20 }),
      makePost({ date: '2026-10-02', impressions: 300, comments: 2, reach: 200, oon: 40 }),
      makePost({ date: '2026-10-03', impressions: 1000, comments: 1, reach: null, oon: null }),
    ];
    const t = thresholds(posts, DEFAULT_ANALYSIS_SETTINGS);
    expect(t).toEqual({ personalMedian: 300, breakout: 900, viral: 3000 });
    const m = windowMetrics(posts, t);
    expect(m).toMatchObject({
      posts: 3,
      medianImpressions: 300,
      medianReach: 130,
      medianOutOfNetworkPct: 30,
      breakouts: 1,
      viral: 0,
      comments: 3,
      impressions: 1400,
      impressionsWithoutViral: 1400,
      zeroCommentPosts: 1,
    });
    expect(m.zeroCommentShare).toBeCloseTo(1 / 3, 10);
    expect(m.top1Share).toBeCloseTo(1000 / 1400, 10);
    expect(m.top5Share).toBe(1);
    expect(m.bestPost?.metrics.impressions).toBe(1000);
    // ER = (reactions 2 + comments) / impressions → medians of 0.02, 0.0133…, 0.003
    expect(m.medianEngagementRate).toBeCloseTo(4 / 300, 10);
  });

  it('handles empty windows without dividing by zero', () => {
    const m = windowMetrics([], thresholds([], DEFAULT_ANALYSIS_SETTINGS));
    expect(m).toMatchObject({
      posts: 0,
      medianImpressions: null,
      breakouts: 0,
      zeroCommentShare: null,
      top1Share: null,
      bestPost: null,
    });
  });

  it('TC-A10 includeImmature switches the personal median and window metrics', () => {
    const posts = [
      makePost({ date: '2026-09-20', impressions: 100 }),
      makePost({ date: '2026-09-25', impressions: 200 }),
      makePost({ date: '2026-10-13', impressions: 10 }),
    ];
    const without = headline({ posts, latestExportDate: E }, DEFAULT_ANALYSIS_SETTINGS);
    const withAll = headline(
      { posts, latestExportDate: E },
      { ...DEFAULT_ANALYSIS_SETTINGS, includeImmature: true },
    );
    expect(without.thresholds.personalMedian).toBe(150);
    expect(withAll.thresholds.personalMedian).toBe(100);
    expect(without.windows[0]?.metrics.posts).toBe(2);
    expect(withAll.windows[0]?.metrics.posts).toBe(3);
    expect(withAll.windows.reduce((s, w) => s + w.metrics.posts, 0)).toBe(3);
  });

  it('viral can be a fixed number of impressions instead of a multiple (SPEC §6.2)', () => {
    const ps = [100, 100, 200, 15000, 14999].map((impressions, i) =>
      makePost({ date: `2026-09-2${i}`, impressions }),
    );
    const fixed = {
      ...DEFAULT_ANALYSIS_SETTINGS,
      viralMode: 'impressions' as const,
      viralImpressions: 15000,
    };
    const h = headline({ posts: ps, latestExportDate: '2026-10-14' }, fixed);
    // Median 200: breakout stays 3× = 600; viral is the fixed 15,000.
    expect(h.thresholds).toEqual({ personalMedian: 200, breakout: 600, viral: 15000 });
    expect(h.windows[0]?.metrics.viral).toBe(1);
    expect(
      headline({ posts: ps, latestExportDate: '2026-10-14' }, DEFAULT_ANALYSIS_SETTINGS).thresholds
        .viral,
    ).toBe(2000);
  });

  it('labels windows with their dates', () => {
    const h = headline(
      { posts: [makePost({ date: '2026-08-01' })], latestExportDate: E },
      DEFAULT_ANALYSIS_SETTINGS,
    );
    expect(h.windows.map((w) => [w.label, w.start, w.end])).toEqual([
      ['W3', '2026-09-15', '2026-10-14'],
      ['W2', '2026-08-16', '2026-09-14'],
      ['W1', '2026-07-17', '2026-08-15'],
    ]);
  });
});
