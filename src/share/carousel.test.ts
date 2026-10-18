// TC-SC01–SC05 (SPEC §11.3): share carousel content. Expected values are worked
// out by hand from the posts below (export date 14 Oct 2026, 30-day windows).
import { DEFAULT_ANALYSIS_SETTINGS, makePost } from '../../tests/builders/posts.ts';
import type { AnalysisPost } from '../analysis/types.ts';
import { generateInsights } from '../insights/engine.ts';
import { buildCarousel, shareTitle, type Slide } from './carousel.ts';

const E = '2026-10-14';
const S = DEFAULT_ANALYSIS_SETTINGS;
const days = (
  from: string,
  n: number,
  spec: Parameters<typeof makePost>[0] extends infer P ? Omit<P & object, 'date'> : never,
) =>
  Array.from({ length: n }, (_, i) =>
    makePost({
      ...spec,
      date: `${from.slice(0, 8)}${String(Number(from.slice(8)) + i).padStart(2, '0')}`,
    }),
  );

function carousel(posts: AnalysisPost[], absolute = true, sample = false) {
  const dataset = { posts, latestExportDate: E };
  return buildCarousel(dataset, S, generateInsights(dataset, S), { absolute, sample });
}
const slide = <K extends Slide['kind']>(c: ReturnType<typeof carousel>, kind: K) =>
  c.slides.find((s): s is Extract<Slide, { kind: K }> => s.kind === kind);

describe('share carousel (SPEC §9.2 screen 8)', () => {
  // W2 (16 Aug – 14 Sep): 5 posts at 100. W3: 5 posts at 130. Reach +30 %.
  const growing = () => [
    ...days('2026-08-20', 5, { impressions: 100 }),
    ...days('2026-09-20', 5, { impressions: 130 }),
  ];

  const ALL = ['cover', 'lesson', 'momentum', 'recap', 'closing'];

  it('TC-SC01 growing reach: positive cover, momentum up, every slide present', () => {
    const c = carousel(growing());
    expect(c.slides.map((s) => s.kind)).toEqual(ALL);
    // One format only, at the typical post's median (115): no difference to point at.
    expect(slide(c, 'lesson')).toMatchObject({
      headline: 'My formats reached about as many people as my typical post.',
      tone: 'neutral',
      bars: [{ label: 'Image', posts: 10, value: 115, display: '115', highlight: false }],
    });
    expect(slide(c, 'cover')).toMatchObject({
      kicker: 'My LinkedIn · Aug 20 – Oct 14, 2026',
      headline: 'My typical post reached 30 % more people than the month before.',
      sub: 'Across 10 posts. Here is what else my own numbers say.',
      sample: false,
    });
    // Median 115 over all 10 posts, so breakouts start at 345: none.
    expect(slide(c, 'momentum')).toMatchObject({
      trend: 'up',
      change: '+30 %',
      summary: 'More people saw my typical post than the month before.',
      note: null,
      detail: 'from 100 to 130 impressions (median)',
      stats: [
        { big: '0 vs 0', small: 'breakout posts (3× my median)' },
        { big: '30 %', small: 'of impressions from outside my network (+0 points)' },
      ],
    });
    // 13 weeks back from 14 Oct: 20–24 Aug fall in 20–26 Aug (100); 20–23 Sep in
    // 17–23 Sep and 24 Sep in 24–30 Sep (130 each).
    const series = slide(c, 'momentum')?.series ?? [];
    expect(series).toHaveLength(13);
    expect(series.filter((v) => v !== null)).toEqual([100, 130, 130]);
    // 20 Aug – 14 Oct is 56 days: 8 weeks.
    expect(slide(c, 'recap')).toMatchObject({
      kicker: 'Aug 20 – Oct 14, 2026',
      headline: 'My last 8 weeks on LinkedIn',
      stats: [
        { big: '10', small: 'posts' },
        { big: '1,150', small: 'impressions' },
        { big: '10', small: 'comments' },
        { big: '0', small: 'new followers' },
      ],
      topDetail: '130 impressions · 30 % outside my network',
    });
  });

  // W2: 5 Image posts at 300 and 3 Reposts at 50. W3: 5 Image posts at 200.
  const falling = () => [
    ...days('2026-08-20', 5, { impressions: 300 }),
    ...days('2026-08-26', 3, { impressions: 50, type: 'Repost' }),
    ...days('2026-09-20', 5, { impressions: 200 }),
  ];

  it('TC-SC02 falling reach is shown too, in plain words; the lesson shows the format finding', () => {
    const c = carousel(falling());
    expect(c.slides.map((s) => s.kind)).toEqual(ALL);
    // 300 (8 posts in W2) → 200 (5 in W3). Median of all 13 = 200, breakouts from 600: none.
    expect(slide(c, 'momentum')).toMatchObject({
      trend: 'down',
      change: '−33 %',
      summary: 'Fewer people saw my typical post than the month before.',
      detail: 'from 300 to 200 impressions (median)',
      note: null,
      stats: [
        { big: '0 vs 0', small: 'breakout posts (3× my median)' },
        { big: '30 %', small: 'of impressions from outside my network (+0 points)' },
      ],
    });
    // Typical post: median of 13 = 200. Reposts 50 = 0.25×; Image posts 250 = 1.25× (not strong).
    expect(slide(c, 'lesson')).toMatchObject({
      headline: 'Reposts reached 75 % fewer people than my typical post.',
      tone: 'negative',
      caption: 'Median impressions per post, by format',
      bars: [
        { label: 'Image', posts: 10, value: 250, display: '250', highlight: false },
        { label: 'Repost', posts: 3, value: 50, display: '50', highlight: true },
      ],
      typical: { value: 200, label: 'typical post · 200' },
    });
    // Engagement rate (3 engagements per post): W2 median 1 % (300s) vs W3 1.5 % (200s),
    // +50 %, so engagement_shift is the positive finding on the cover.
    expect(slide(c, 'cover')?.headline).toBe(
      'People engaged 50\u00a0% more with my posts than the month before.',
    );
  });

  it('TC-SC03 without absolute numbers only shares and changes show', () => {
    const c = carousel(falling(), false);
    expect(slide(c, 'lesson')).toMatchObject({
      caption: 'Compared with my typical post',
      typical: { label: 'typical post' },
    });
    expect(slide(c, 'lesson')?.bars.map((b) => b.display)).toEqual(['+25 %', '−75 %']);
    expect(slide(c, 'recap')).toMatchObject({
      stats: [
        { big: '13', small: 'posts' },
        { big: '100 %', small: 'of posts got comments' },
        { big: '30 %', small: 'typical share outside my network' },
        { big: 'Image', small: 'best format, +25 %' },
      ],
      topDetail: '11 % of all my impressions · 30 % outside my network',
    });
    const growingRelative = carousel(growing(), false);
    expect(slide(growingRelative, 'momentum')).toMatchObject({ detail: null });
    // 3 engagements per post: 3 % at 100 impressions, 2.3 % at 130, so −23 %.
    expect(slide(growingRelative, 'momentum')?.stats[0]).toEqual({
      big: '\u221223\u00a0%',
      small: 'engagement rate',
    });
  });

  it('TC-SC04 cover falls back to one post’s share when it is at least 25 %', () => {
    // 4 posts at 100 and one at 1,000: 1,000 / 1,400 = 71 %.
    const c = carousel([
      ...days('2026-09-01', 4, { impressions: 100 }),
      makePost({ date: '2026-09-10', impressions: 1000 }),
    ]);
    expect(slide(c, 'cover')?.headline).toBe('1 post brought 71 % of all my impressions.');
    // All five posts fall in W2 (16 Aug – 14 Sep), none in W3: nothing to compare.
    expect(slide(c, 'momentum')).toMatchObject({
      trend: 'none',
      change: '–',
      summary: 'Not enough posts in the last 60 days to compare yet.',
      detail: null,
      note: null,
      stats: [],
    });
    // Ten equal posts in one window: no finding, no standout post (10 %).
    const flat = carousel(days('2026-09-15', 10, { impressions: 100 }));
    expect(slide(flat, 'cover')?.headline).toBe('What 10 posts taught me about LinkedIn.');
  });

  it('TC-SC05 sample data is marked on the cover; titles come from the link', () => {
    expect(slide(carousel(growing(), true, true), 'cover')?.sample).toBe(true);
    expect(shareTitle({ title: 'what i learned from shipping', publishDate: E })).toBe(
      'What i learned from shipping…',
    );
    expect(shareTitle({ title: '', publishDate: '2026-10-01' })).toBe('My post of Oct 1, 2026');
    const closing = carousel(growing()).slides.at(-1);
    expect(closing).toEqual({
      kind: 'closing',
      headline: 'Made with Post Pulse',
      url: 'lipulse.netlify.app',
      privacy: 'Analysed in my browser from my LinkedIn export. My data never left my device.',
      disclaimer: 'Not affiliated with LinkedIn Corporation.',
    });
  });

  it('TC-SC09 small samples get a caveat; formats without enough posts say so', () => {
    // W2: Image, Video, Text at 100. W3: Image, Video at 150. No format has 3 posts.
    const c = carousel([
      makePost({ date: '2026-08-20', impressions: 100, type: 'Image' }),
      makePost({ date: '2026-08-21', impressions: 100, type: 'Video' }),
      makePost({ date: '2026-08-22', impressions: 100, type: 'Text' }),
      makePost({ date: '2026-09-20', impressions: 150, type: 'Image' }),
      makePost({ date: '2026-09-21', impressions: 150, type: 'Video' }),
    ]);
    expect(slide(c, 'momentum')).toMatchObject({
      trend: 'up',
      change: '+50 %',
      note: 'Based on only 2 and 3 posts.',
    });
    expect(slide(c, 'lesson')).toMatchObject({
      headline: 'Not enough posts per format yet to compare formats.',
      tone: 'neutral',
      bars: [],
      note: 'A format needs at least 3 posts to count.',
    });
  });

  it('TC-SC09 without a format insight the lesson names the format that differs most (≥ 10 %)', () => {
    // 10 Image posts at 100 and 3 Videos at 120: typical 100, Videos 1.2× (below the 1.3× insight).
    const c = carousel([
      ...days('2026-09-01', 10, { impressions: 100 }),
      ...days('2026-09-20', 3, { impressions: 120, type: 'Video' }),
    ]);
    expect(slide(c, 'lesson')).toMatchObject({
      headline: 'Videos reached 20 % more people than my typical post.',
      tone: 'positive',
    });
    expect(slide(c, 'lesson')?.bars.find((b) => b.highlight)?.label).toBe('Video');
  });
});
