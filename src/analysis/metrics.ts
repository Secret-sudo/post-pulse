// Headline metrics per window (SPEC §6.2).

import { engagementRate } from '../import/derive.ts';
import {
  STATUS_DOWN_SHARPLY_AT,
  STATUS_GROWING_AT,
  STATUS_SLIPPING_AT,
  WINDOW_DAYS,
  type WindowSize,
} from './constants.ts';
import { median, roundRatio, sum } from './stats.ts';
import type { AnalysisPost, AnalysisSettings, Dataset } from './types.ts';
import { addDays, eligiblePosts, groupByWindow, windowBounds, windowLabel } from './windows.ts';

export interface Thresholds {
  personalMedian: number | null;
  breakout: number | null;
  viral: number | null;
}

export interface WindowMetrics {
  posts: number;
  medianImpressions: number | null;
  medianReach: number | null;
  medianEngagementRate: number | null;
  medianOutOfNetworkPct: number | null;
  breakouts: number;
  viral: number;
  comments: number;
  saves: number;
  followersGained: number;
  profileViewers: number;
  impressions: number;
  impressionsWithoutViral: number;
  zeroCommentPosts: number;
  zeroCommentShare: number | null;
  top1Share: number | null;
  top5Share: number | null;
  bestPost: AnalysisPost | null;
}

export interface WindowSummary {
  k: number;
  label: string;
  start: string;
  end: string;
  metrics: WindowMetrics;
}

export interface Headline {
  latestExportDate: string;
  size: WindowSize;
  thresholds: Thresholds;
  /** Index 0 = most recent window (W3). */
  windows: WindowSummary[];
}

const nonNull = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);

/** Personal median over the full history and the breakout / viral thresholds (SPEC §6.2). */
export function thresholds(
  eligible: readonly AnalysisPost[],
  settings: AnalysisSettings,
): Thresholds {
  const personalMedian = median(eligible.map((p) => p.metrics.impressions));
  return {
    personalMedian,
    breakout: personalMedian === null ? null : settings.breakoutMultiplier * personalMedian,
    viral:
      settings.viralMode === 'impressions' && settings.viralImpressions !== undefined
        ? settings.viralImpressions
        : personalMedian === null
          ? null
          : settings.viralMultiplier * personalMedian,
  };
}

const isNumericId = (id: string) => /^\d+$/.test(id);

/** Best-post order: more impressions, then earlier date, then lower postId (SPEC §6.2). */
export function compareBest(a: AnalysisPost, b: AnalysisPost): number {
  if (a.metrics.impressions !== b.metrics.impressions)
    return b.metrics.impressions - a.metrics.impressions;
  if (a.publishDate !== b.publishDate) return a.publishDate < b.publishDate ? -1 : 1;
  if (isNumericId(a.postId) && isNumericId(b.postId) && a.postId.length !== b.postId.length) {
    return a.postId.length - b.postId.length;
  }
  return a.postId < b.postId ? -1 : a.postId > b.postId ? 1 : 0;
}

export function windowMetrics(posts: readonly AnalysisPost[], t: Thresholds): WindowMetrics {
  const imps = posts.map((p) => p.metrics.impressions);
  const total = sum(imps);
  const sorted = [...posts].sort(compareBest);
  const isViral = (p: AnalysisPost) => t.viral !== null && p.metrics.impressions >= t.viral;
  const zeroComment = posts.filter((p) => p.metrics.comments === 0).length;
  const share = (n: number) =>
    total === 0 ? null : sum(sorted.slice(0, n).map((p) => p.metrics.impressions)) / total;

  return {
    posts: posts.length,
    medianImpressions: median(imps),
    medianReach: median(nonNull(posts.map((p) => p.metrics.membersReached))),
    medianEngagementRate: median(posts.map((p) => engagementRate(p.metrics))),
    medianOutOfNetworkPct: median(nonNull(posts.map((p) => p.metrics.outOfNetworkPct))),
    breakouts:
      t.breakout === null
        ? 0
        : posts.filter((p) => p.metrics.impressions >= (t.breakout as number)).length,
    viral: posts.filter(isViral).length,
    comments: sum(posts.map((p) => p.metrics.comments)),
    saves: sum(posts.map((p) => p.metrics.saves)),
    followersGained: sum(posts.map((p) => p.metrics.followersGained ?? 0)),
    profileViewers: sum(posts.map((p) => p.metrics.profileViewers ?? 0)),
    impressions: total,
    impressionsWithoutViral: sum(
      posts.filter((p) => !isViral(p)).map((p) => p.metrics.impressions),
    ),
    zeroCommentPosts: zeroComment,
    zeroCommentShare: posts.length === 0 ? null : zeroComment / posts.length,
    top1Share: share(1),
    top5Share: share(5),
    bestPost: sorted[0] ?? null,
  };
}

const earliestDate = (posts: readonly AnalysisPost[], fallback: string) =>
  posts.reduce((min, p) => (p.publishDate < min ? p.publishDate : min), fallback);

/**
 * Every window from the most recent back to the oldest post, with its metrics.
 * Size 'all' gives one window over the whole history, with nothing before it.
 */
export function headline(
  dataset: Dataset,
  settings: AnalysisSettings,
  size: WindowSize = WINDOW_DAYS,
): Headline {
  const E = dataset.latestExportDate;
  const eligible = eligiblePosts(dataset.posts, E, settings.includeImmature);
  const t = thresholds(eligible, settings);
  const windows =
    size === 'all'
      ? [
          {
            k: 0,
            label: 'All',
            start: earliestDate(eligible, E),
            end: E,
            metrics: windowMetrics(eligible, t),
          },
        ]
      : groupByWindow(eligible, E, size).map((posts, k) => ({
          k,
          label: windowLabel(k),
          ...windowBounds(k, E, size),
          metrics: windowMetrics(posts, t),
        }));
  return { latestExportDate: E, size, thresholds: t, windows };
}

export interface SparkPoint {
  start: string;
  end: string;
  metrics: WindowMetrics;
}

/**
 * The selected window cut into buckets of `bucketDays`, counted back from its
 * last day like the windows themselves; the oldest bucket may be shorter.
 * Oldest first. Thresholds are the full-history ones from the headline.
 */
export function sparkSeries(
  dataset: Dataset,
  settings: AnalysisSettings,
  h: Headline,
  k: number,
  bucketDays: number,
): SparkPoint[] {
  const w = h.windows[k];
  if (!w) return [];
  const eligible = eligiblePosts(dataset.posts, dataset.latestExportDate, settings.includeImmature);
  // Posts dated after the export date belong to the latest window (SPEC §6.1).
  const inWindow = eligible.filter(
    (p) => p.publishDate >= w.start && (p.publishDate <= w.end || k === 0),
  );
  const points: SparkPoint[] = [];
  for (let end = w.end; end >= w.start; end = addDays(end, -bucketDays)) {
    const first = addDays(end, -(bucketDays - 1));
    const start = first < w.start ? w.start : first;
    const posts = inWindow.filter(
      (p) => p.publishDate >= start && (p.publishDate <= end || (k === 0 && end === w.end)),
    );
    points.push({ start, end, metrics: windowMetrics(posts, h.thresholds) });
  }
  return points.reverse();
}

/** `selected / prior − 1`; null when there's no prior value (SPEC §6.2). Unrounded, for display. */
export function change(selected: number | null, prior: number | null): number | null {
  if (selected === null || prior === null || prior === 0) return null;
  return selected / prior - 1;
}

export type Status = 'growing' | 'flat' | 'slipping' | 'down-sharply';

/** KPI status chip from a change; `inverted` for metrics where lower is better. */
export function statusFor(changeValue: number | null, inverted = false): Status | null {
  if (changeValue === null) return null;
  // Compare on the rounded ratio so floating-point noise never flips a chip (SPEC §6.2).
  const c = roundRatio(inverted ? -changeValue : changeValue);
  if (c >= STATUS_GROWING_AT) return 'growing';
  if (c <= STATUS_DOWN_SHARPLY_AT) return 'down-sharply';
  if (c <= STATUS_SLIPPING_AT) return 'slipping';
  return 'flat';
}
