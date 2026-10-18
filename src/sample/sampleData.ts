// Bundled sample data (SPEC §9.2 "Try with sample data"). Synthetic and
// deterministic: a made-up creator whose reach slipped in the last 30 days,
// so the dashboard and several insights have something to show.

import { deleteAllData } from '../db/backup.ts';
import { mergeImport } from '../db/merge.ts';
import type { PostPulseDb } from '../db/schema.ts';
import { isHashtagTitle } from '../import/derive.ts';
import type { F1Result, ParsedPost, PostType } from '../import/types.ts';

export const SAMPLE_FILE_NAME = 'Sample data';
/** Fixed pseudo-hash that marks the sample import. */
export const SAMPLE_FILE_HASH = '5a3e'.padStart(64, '0');
export const SAMPLE_AUTHOR = 'sample-creator';
export const SAMPLE_RANGE = { start: '2026-07-17', end: '2026-10-14' } as const;

const TITLES = [
  'what i learned from shipping a product in six weeks',
  'three questions to ask before you automate a process',
  'the meeting that changed how our team works',
  'a simple checklist for better project kickoffs',
  'why small experiments beat big plans',
  'how we cut our reporting time in half',
  'leadership digitaltransformation futureofwork',
  'the most useful feedback i ever got',
  'a chart that explains our customer churn',
  'my notes from this week’s industry conference',
  'what nobody tells you about hiring your first analyst',
  'one habit that made my writing clearer',
];

const TYPES: PostType[] = [
  'Image',
  'Image',
  'Image',
  'Text',
  'Video',
  'Repost',
  'Image',
  'Document',
  'Article',
  'Poll',
];

/** Small seeded PRNG (mulberry32) so the sample is identical on every device. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function samplePosts(): ParsedPost[] {
  const random = rng(20261014);
  const posts: ParsedPost[] = [];
  for (let day = 0; day < 90; day += 1) {
    if (random() > 0.5) continue; // about 3–4 posts a week
    const date = addDays(SAMPLE_RANGE.start, day);
    const i = posts.length;
    const type = TYPES[Math.floor(random() * TYPES.length)] ?? 'Image';
    const late = day >= 60; // the last 30 days
    // 360 vs 320 looks backwards, but with this seed the random draws in the last
    // window run low: the result is a believable −23 % median (checked in tests).
    const base = (late ? 380 : 320) * Math.exp((random() - 0.5) * 1.2);
    const boost = i === 9 ? 18 : i === 17 || i === 23 ? 4 : 1; // one viral post, two breakouts
    const impressions = Math.round(
      base * boost * (type === 'Video' ? 1.3 : type === 'Repost' ? 0.6 : 1),
    );
    const oon = Math.min(95, Math.round(15 + 70 * Math.min(1, impressions / 3000) + random() * 10));
    const comments = late && random() < 0.45 ? 0 : Math.floor(random() * 5);
    const reactions = Math.max(1, Math.round(impressions * (0.015 + random() * 0.01)));
    const id = String(7400000000000100000n + BigInt(i));
    const title = TITLES[i % TITLES.length] ?? 'a sample post';
    posts.push({
      postId: id,
      url: `https://www.linkedin.com/posts/${SAMPLE_AUTHOR}_${title.replace(/\s+/g, '-')}-ugcPost-${id}-Smpl`,
      authorSlug: SAMPLE_AUTHOR,
      title,
      titleIsHashtags: isHashtagTitle(title),
      publishDate: date,
      postType: type,
      postTypeRaw: type,
      metrics: {
        impressions,
        inNetworkPct: 100 - oon,
        outOfNetworkPct: oon,
        membersReached: Math.round(impressions * 0.62),
        views: type === 'Video' ? Math.round(impressions * 0.3) : null,
        watchTimeSec: type === 'Video' ? Math.round(impressions * 4) : null,
        avgWatchTimeSec: type === 'Video' ? 14 : null,
        followersGained: Math.floor(impressions / 400),
        profileViewers: Math.floor(impressions / 150),
        reactions,
        comments,
        reposts: random() < 0.15 ? 1 : 0,
        saves: Math.floor(random() * 3),
        sends: random() < 0.2 ? 1 : 0,
        customButton: 0,
        linkVisits: null,
      },
    });
  }
  return posts;
}

export function sampleExport(): F1Result {
  return {
    ok: true,
    format: 'F1',
    headerLanguage: 'en',
    sheetName: SAMPLE_FILE_NAME,
    rangeStart: SAMPLE_RANGE.start,
    rangeEnd: SAMPLE_RANGE.end,
    posts: samplePosts(),
    warnings: [],
  };
}

export async function isSampleLoaded(db: PostPulseDb): Promise<boolean> {
  return (await db.imports.where('fileHash').equals(SAMPLE_FILE_HASH).count()) > 0;
}

/** Replace whatever is stored with the sample. Only offered on an empty history. */
export async function loadSample(db: PostPulseDb): Promise<void> {
  await deleteAllData(db);
  await mergeImport(db, sampleExport(), { fileName: SAMPLE_FILE_NAME, fileHash: SAMPLE_FILE_HASH });
}

export async function removeSample(db: PostPulseDb): Promise<void> {
  await deleteAllData(db);
}
