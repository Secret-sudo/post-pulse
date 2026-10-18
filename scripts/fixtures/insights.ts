// Synthetic insight fixtures (SPEC §11.2). Export date 2026-10-14; posts on or
// before 2026-10-07 are mature. Reactions = round(impressions / 50) − comments:
// 2 % engagement (exact when impressions are a multiple of 50), and a median
// engagement rate of 2 % in every window, so engagement never changes.
//
// syn-insights-en: a profile whose reach fell. Each Phase 1 rule except the
// topic rules fires; the hand-derived results are in syn-insights.expected.json.
// syn-quiet-en: a steady profile; only the "growing posts" note may appear.

import { EN_HEADERS, f1Row } from '../../tests/builders/f1.ts';
import type { Cell, PostType } from '../../src/import/types.ts';

const usDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${y}`;
};

interface Spec {
  date: string;
  type: PostType;
  impressions: number;
  comments: number;
  oon: number;
  hashtags?: boolean;
}

function row(i: number, s: Spec, idBase: bigint): Cell[] {
  const id = idBase + BigInt(i);
  const slug = s.hashtags ? 'aiagents-enterpriseai-leadership' : 'a-synthetic-post-about-work';
  return f1Row({
    'Post URL': `https://www.linkedin.com/posts/sample_${slug}-ugcPost-${id}-Syn2`,
    'Post Publish Date': usDate(s.date),
    'Post type': s.type,
    Impressions: String(s.impressions),
    'Impressions (in-network)': `${100 - s.oon}%`,
    'Impressions (out-of-network)': `${s.oon}%`,
    'Members reached': String(Math.round(s.impressions * 0.6)),
    // Whole numbers only: LinkedIn never exports fractional counts.
    Reactions: String(Math.round(s.impressions / 50) - s.comments),
    Comments: String(s.comments),
  });
}

// Outside-network share rises with impressions on every post (Spearman = 1).
const OON: Record<number, number> = {
  100: 10,
  150: 15,
  200: 20,
  300: 30,
  600: 50,
  1000: 55,
  1200: 60,
  20000: 90,
};
const p = (
  date: string,
  type: PostType,
  impressions: number,
  comments: number,
  hashtags = false,
): Spec => ({
  date,
  type,
  impressions,
  comments,
  oon: OON[impressions] ?? 30,
  hashtags,
});

export const INSIGHT_POSTS: Spec[] = [
  // W1 (2026-07-17 – 08-15)
  p('2026-07-20', 'Image', 300, 1),
  p('2026-07-23', 'Image', 300, 1),
  p('2026-07-26', 'Video', 600, 1),
  p('2026-07-29', 'Image', 20000, 2),
  p('2026-08-01', 'Repost', 100, 1),
  p('2026-08-04', 'Image', 100, 1, true),
  p('2026-08-07', 'Video', 1200, 1),
  p('2026-08-10', 'Image', 300, 1),
  // W2 (08-16 – 09-14)
  p('2026-08-18', 'Image', 300, 1),
  p('2026-08-21', 'Video', 1200, 1),
  p('2026-08-24', 'Image', 1000, 1),
  p('2026-08-27', 'Repost', 100, 1),
  p('2026-08-30', 'Image', 100, 1, true),
  p('2026-09-02', 'Image', 300, 1),
  p('2026-09-05', 'Video', 1200, 1),
  p('2026-09-08', 'Image', 300, 1),
  // W3 (09-15 – 10-14), mature
  p('2026-09-16', 'Image', 200, 0),
  p('2026-09-20', 'Image', 200, 0),
  p('2026-09-20', 'Repost', 100, 0),
  p('2026-09-25', 'Image', 100, 0, true),
  p('2026-09-25', 'Image', 200, 1),
  p('2026-09-30', 'Video', 600, 1),
  p('2026-10-03', 'Image', 200, 0),
  p('2026-10-03', 'Image', 200, 1),
  // W3, still growing
  p('2026-10-09', 'Image', 150, 0),
  p('2026-10-13', 'Image', 150, 0),
];

const QUIET_IMPRESSIONS = [250, 280, 300, 320, 350, 300, 290, 310];
const QUIET_TYPES: PostType[] = [
  'Image',
  'Text',
  'Video',
  'Image',
  'Text',
  'Video',
  'Image',
  'Text',
];
const quietWindow = (dates: string[]) =>
  dates.map((date, i): Spec => ({
    date,
    type: QUIET_TYPES[i] ?? 'Image',
    impressions: QUIET_IMPRESSIONS[i] ?? 300,
    comments: 1,
    oon: 30,
  }));

export const QUIET_POSTS: Spec[] = [
  ...quietWindow([
    '2026-07-18',
    '2026-07-22',
    '2026-07-26',
    '2026-07-30',
    '2026-08-03',
    '2026-08-07',
    '2026-08-11',
    '2026-08-15',
  ]),
  ...quietWindow([
    '2026-08-17',
    '2026-08-21',
    '2026-08-25',
    '2026-08-29',
    '2026-09-02',
    '2026-09-06',
    '2026-09-10',
    '2026-09-14',
  ]),
  ...quietWindow([
    '2026-09-16',
    '2026-09-20',
    '2026-09-24',
    '2026-09-28',
    '2026-10-02',
    '2026-10-06',
    '2026-10-07',
    '2026-10-11',
  ]),
];

const sheet = (specs: Spec[], idBase: bigint): Cell[][] => [
  [...EN_HEADERS],
  ...specs.map((s, i) => row(i, s, idBase)),
];

export const INSIGHT_FIXTURES = {
  'syn-insights-en_2026-07-17_2026-10-14.xlsx': () => sheet(INSIGHT_POSTS, 7400000000000005000n),
  'syn-quiet-en_2026-07-17_2026-10-14.xlsx': () => sheet(QUIET_POSTS, 7400000000000006000n),
} as const;
