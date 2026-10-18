// Breakdowns model (SPEC §6.3, §9.2 screen 5): format tier list,
// outside-network buckets and posting rhythm. Pure.
import {
  byOutOfNetwork,
  byPostType,
  periodSeries,
  type GroupStats,
  type Period,
  type PeriodPoint,
} from '../../analysis/breakdowns.ts';
import { OON_BUCKETS } from '../../analysis/constants.ts';
import { median } from '../../analysis/stats.ts';
import type { AnalysisPost } from '../../analysis/types.ts';
import type { PostType } from '../../import/types.ts';

export interface TierRow extends GroupStats {
  type: PostType;
  /** Median impressions relative to all posts, e.g. 1.3 = 30 % more. */
  ratio: number | null;
}

export interface Tiers {
  overallMedian: number | null;
  rows: TierRow[];
}

/** Types ranked by median impressions; groups too small to judge go last (SPEC §6.3). */
export function formatTiers(posts: readonly AnalysisPost[]): Tiers {
  const overallMedian = median(posts.map((p) => p.metrics.impressions));
  const rows = [...byPostType(posts)].map(([type, g]) => ({
    type,
    ...g,
    ratio:
      overallMedian && g.medianImpressions !== null ? g.medianImpressions / overallMedian : null,
  }));
  rows.sort(
    (a, b) =>
      Number(a.tooFew) - Number(b.tooFew) ||
      (b.medianImpressions ?? -1) - (a.medianImpressions ?? -1) ||
      b.posts - a.posts,
  );
  return { overallMedian, rows };
}

export interface BucketRow extends GroupStats {
  id: string;
  label: string;
}

export function outOfNetworkBuckets(posts: readonly AnalysisPost[]): BucketRow[] {
  const groups = byOutOfNetwork(posts);
  return OON_BUCKETS.map((b) => ({
    id: b.id,
    label: b.label,
    ...(groups.get(b.id) as GroupStats),
  }));
}

export interface Rhythm {
  period: Period;
  points: PeriodPoint[];
  totalPosts: number;
  viralImpressions: number;
}

export function postingRhythm(
  posts: readonly AnalysisPost[],
  viralThreshold: number | null,
  period: Period = 'week',
): Rhythm {
  const points = periodSeries(posts, viralThreshold, period);
  return {
    period,
    points,
    totalPosts: points.reduce((s, w) => s + w.posts, 0),
    viralImpressions: points.reduce((s, w) => s + w.impressionsViral, 0),
  };
}
