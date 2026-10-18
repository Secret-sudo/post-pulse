// Breakdowns, posting rhythm, weekly series and correlations (SPEC §6.3).

import { engagementRate } from '../import/derive.ts';
import type { PostType } from '../import/types.ts';
import { MIN_GROUP_POSTS, OON_BUCKETS, ROLLING_MEDIAN_POSTS, WINDOW_DAYS } from './constants.ts';
import { median, rollingMedian, spearman, sum } from './stats.ts';
import type { AnalysisPost } from './types.ts';

export interface GroupStats {
  posts: number;
  medianImpressions: number | null;
  medianEngagementRate: number | null;
  medianOutOfNetworkPct: number | null;
  /** Fewer than MIN_GROUP_POSTS: shown greyed out, never used by insights. */
  tooFew: boolean;
}

export function groupStats(posts: readonly AnalysisPost[]): GroupStats {
  return {
    posts: posts.length,
    medianImpressions: median(posts.map((p) => p.metrics.impressions)),
    medianEngagementRate: median(posts.map((p) => engagementRate(p.metrics))),
    medianOutOfNetworkPct: median(
      posts.map((p) => p.metrics.outOfNetworkPct).filter((x): x is number => x !== null),
    ),
    tooFew: posts.length < MIN_GROUP_POSTS,
  };
}

function groupBy<K extends string>(posts: readonly AnalysisPost[], key: (p: AnalysisPost) => K) {
  const groups = new Map<K, AnalysisPost[]>();
  for (const p of posts) {
    const k = key(p);
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return groups;
}

const statsOf = <K extends string>(groups: Map<K, AnalysisPost[]>) =>
  new Map([...groups].map(([k, ps]) => [k, groupStats(ps)] as const));

export function byPostType(posts: readonly AnalysisPost[]): Map<PostType, GroupStats> {
  return statsOf(groupBy(posts, (p) => p.postType));
}

export type OonBucketId = (typeof OON_BUCKETS)[number]['id'];

export function oonBucket(outOfNetworkPct: number): OonBucketId {
  // Shares are clamped to 0–100 on import, so anything above the last bound is a data error.
  return OON_BUCKETS.find((b) => outOfNetworkPct <= b.max)?.id ?? '81-100';
}

/** Buckets in display order; posts without an outside-network share are left out. */
export function byOutOfNetwork(posts: readonly AnalysisPost[]): Map<OonBucketId, GroupStats> {
  const known = posts.filter((p) => p.metrics.outOfNetworkPct !== null);
  const groups = groupBy(known, (p) => oonBucket(p.metrics.outOfNetworkPct as number));
  return new Map(OON_BUCKETS.map((b) => [b.id, groupStats(groups.get(b.id) ?? [])]));
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export function weekday(isoDate: string): Weekday {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return WEEKDAYS[(day + 6) % 7] as Weekday;
}

/** Monday first, every weekday present. */
export function byWeekday(posts: readonly AnalysisPost[]): Map<Weekday, GroupStats> {
  const groups = groupBy(posts, (p) => weekday(p.publishDate));
  return new Map(WEEKDAYS.map((d) => [d, groupStats(groups.get(d) ?? [])]));
}

/** Posts on days with one post vs days with two or more. */
export function byPostsPerDay(
  posts: readonly AnalysisPost[],
): Map<'single' | 'multiple', GroupStats> {
  const perDay = new Map<string, number>();
  for (const p of posts) perDay.set(p.publishDate, (perDay.get(p.publishDate) ?? 0) + 1);
  const groups = groupBy(posts, (p) =>
    (perDay.get(p.publishDate) ?? 0) >= 2 ? 'multiple' : 'single',
  );
  return new Map([
    ['single', groupStats(groups.get('single') ?? [])],
    ['multiple', groupStats(groups.get('multiple') ?? [])],
  ]);
}

export function byHashtagOpener(posts: readonly AnalysisPost[]) {
  return {
    hashtag: groupStats(posts.filter((p) => p.titleIsHashtags)),
    other: groupStats(posts.filter((p) => !p.titleIsHashtags)),
  };
}

/** Posting rhythm in a window: posts per week and days with 2+ posts. */
export function rhythm(posts: readonly AnalysisPost[], windowDays = WINDOW_DAYS) {
  const perDay = new Map<string, number>();
  for (const p of posts) perDay.set(p.publishDate, (perDay.get(p.publishDate) ?? 0) + 1);
  return {
    posts: posts.length,
    postsPerWeek: (posts.length / windowDays) * 7,
    daysWithMultiplePosts: [...perDay.values()].filter((n) => n >= 2).length,
  };
}

/** Monday of the ISO week containing the date. */
export function isoWeekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export interface WeekPoint {
  weekStart: string;
  posts: number;
  impressionsRegular: number;
  impressionsViral: number;
}

export type Period = 'day' | 'week' | 'month';
export const PERIODS: readonly Period[] = ['day', 'week', 'month'];

export interface PeriodPoint {
  /** First day of the day, ISO week (Monday) or calendar month. */
  start: string;
  posts: number;
  impressionsRegular: number;
  impressionsViral: number;
}

const periodStart: Record<Period, (iso: string) => string> = {
  day: (iso) => iso,
  week: isoWeekStart,
  month: (iso) => `${iso.slice(0, 7)}-01`,
};

function nextPeriod(start: string, period: Period): string {
  const d = new Date(`${start}T00:00:00Z`);
  if (period === 'month') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCDate(d.getUTCDate() + (period === 'week' ? 7 : 1));
  return d.toISOString().slice(0, 10);
}

/** Posts and impressions per day, ISO week or month, gaps filled with zeros (SPEC §6.3). */
export function periodSeries(
  posts: readonly AnalysisPost[],
  viralThreshold: number | null,
  period: Period,
): PeriodPoint[] {
  if (posts.length === 0) return [];
  const points = new Map<string, PeriodPoint>();
  const starts = posts.map((p) => periodStart[period](p.publishDate)).sort();
  const last = starts[starts.length - 1] as string;
  for (let s = starts[0] as string; s <= last; s = nextPeriod(s, period)) {
    points.set(s, { start: s, posts: 0, impressionsRegular: 0, impressionsViral: 0 });
  }
  for (const p of posts) {
    const point = points.get(periodStart[period](p.publishDate)) as PeriodPoint;
    point.posts += 1;
    if (viralThreshold !== null && p.metrics.impressions >= viralThreshold) {
      point.impressionsViral += p.metrics.impressions;
    } else {
      point.impressionsRegular += p.metrics.impressions;
    }
  }
  return [...points.values()];
}

/** Posts and impressions per ISO week, gaps filled with zeros (SPEC §6.3). */
export function weeklySeries(
  posts: readonly AnalysisPost[],
  viralThreshold: number | null,
): WeekPoint[] {
  return periodSeries(posts, viralThreshold, 'week').map(({ start, ...rest }) => ({
    weekStart: start,
    ...rest,
  }));
}

/** Timeline line: trailing median of a metric in publish-date order (SPEC §6.3). */
export function rollingMedianSeries(
  posts: readonly AnalysisPost[],
  metric: (p: AnalysisPost) => number = (p) => p.metrics.impressions,
): { postId: string; publishDate: string; value: number }[] {
  const ordered = [...posts].sort((a, b) =>
    a.publishDate === b.publishDate ? 0 : a.publishDate < b.publishDate ? -1 : 1,
  );
  const values = rollingMedian(ordered.map(metric), ROLLING_MEDIAN_POSTS);
  return ordered.map((p, i) => ({
    postId: p.postId,
    publishDate: p.publishDate,
    value: values[i] as number,
  }));
}

/** Spearman of outside-network share vs impressions, posts with a share only. */
export function outOfNetworkCorrelation(posts: readonly AnalysisPost[]) {
  const known = posts.filter((p) => p.metrics.outOfNetworkPct !== null);
  return {
    n: known.length,
    rho: spearman(
      known.map((p) => p.metrics.outOfNetworkPct as number),
      known.map((p) => p.metrics.impressions),
    ),
  };
}

export function videoStats(posts: readonly AnalysisPost[]) {
  const videos = posts.filter((p) => p.postType === 'Video');
  const withViews = videos.filter((v) => v.metrics.views !== null && v.metrics.impressions > 0);
  return {
    videos: videos.length,
    totalViews: sum(videos.map((v) => v.metrics.views ?? 0)),
    medianViewRate: median(
      withViews.map((v) => (v.metrics.views as number) / v.metrics.impressions),
    ),
    medianAvgWatchTimeSec: median(
      videos.map((v) => v.metrics.avgWatchTimeSec).filter((x): x is number => x !== null),
    ),
    maxWatchTimeSec: videos.reduce((m, v) => Math.max(m, v.metrics.watchTimeSec ?? 0), 0),
  };
}
