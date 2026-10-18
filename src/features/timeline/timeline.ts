// Timeline model (SPEC §9.2 screen 4): one point per post, a trailing 7-post
// median line, shaded windows and labels for the top 3. Pure.

import { rollingMedianSeries } from '../../analysis/breakdowns.ts';
import type { WindowSummary } from '../../analysis/metrics.ts';
import type { AnalysisPost } from '../../analysis/types.ts';
import { engagementRate, engagements } from '../../import/derive.ts';
import type { PostType } from '../../import/types.ts';

export const METRICS = [
  'impressions',
  'reach',
  'engagements',
  'engagementRate',
  'outOfNetwork',
] as const;
export type TimelineMetric = (typeof METRICS)[number];

/** Metrics that are counts and can use a log axis. */
export const COUNT_METRICS: ReadonlySet<TimelineMetric> = new Set([
  'impressions',
  'reach',
  'engagements',
]);

export function metricValue(p: AnalysisPost, metric: TimelineMetric): number | null {
  switch (metric) {
    case 'impressions':
      return p.metrics.impressions;
    case 'reach':
      return p.metrics.membersReached;
    case 'engagements':
      return engagements(p.metrics);
    case 'engagementRate':
      return engagementRate(p.metrics);
    case 'outOfNetwork':
      return p.metrics.outOfNetworkPct;
  }
}

export interface TimelinePoint {
  postId: string;
  date: string;
  value: number;
  type: PostType;
  title: string;
  url: string;
  comments: number;
  top: boolean;
  post: AnalysisPost;
}

export interface Band {
  label: string;
  start: string;
  end: string;
  selected: boolean;
}

export interface TimelineModel {
  metric: TimelineMetric;
  points: TimelinePoint[];
  rolling: { date: string; value: number }[];
  bands: Band[];
  /** Log axis requested and possible (all values > 0). */
  log: boolean;
  /** Log axis was requested but a value ≤ 0 forced a linear one. */
  logUnavailable: boolean;
  typesPresent: PostType[];
}

export const TOP_LABELS = 3;

export function buildTimeline(
  posts: readonly AnalysisPost[],
  metric: TimelineMetric,
  windows: readonly WindowSummary[],
  selectedWindow: number,
  wantLog: boolean,
): TimelineModel {
  const withValue = posts
    .map((p) => ({ p, v: metricValue(p, metric) }))
    .filter((x): x is { p: AnalysisPost; v: number } => x.v !== null)
    .sort((a, b) =>
      a.p.publishDate < b.p.publishDate ? -1 : a.p.publishDate > b.p.publishDate ? 1 : 0,
    );

  const topIds = new Set(
    [...withValue]
      .sort((a, b) => b.v - a.v || (a.p.publishDate < b.p.publishDate ? -1 : 1))
      .slice(0, TOP_LABELS)
      .map((x) => x.p.postId),
  );

  const points: TimelinePoint[] = withValue.map(({ p, v }) => ({
    postId: p.postId,
    date: p.publishDate,
    value: v,
    type: p.postType,
    title: p.title,
    url: p.url,
    comments: p.metrics.comments,
    top: topIds.has(p.postId),
    post: p,
  }));

  const logPossible = COUNT_METRICS.has(metric) && points.every((pt) => pt.value > 0);
  const rolling = rollingMedianSeries(
    withValue.map((x) => x.p),
    (p) => metricValue(p, metric) as number,
  ).map(({ publishDate, value }) => ({ date: publishDate, value }));

  return {
    metric,
    points,
    rolling,
    bands: windows.map((w) => ({
      label: w.label,
      start: w.start,
      end: w.end,
      selected: w.k === selectedWindow,
    })),
    log: wantLog && logPossible,
    logUnavailable: wantLog && COUNT_METRICS.has(metric) && !logPossible,
    typesPresent: [...new Set(points.map((pt) => pt.type))],
  };
}

/** Point size from comments: grows with the square root, capped (SPEC §9.2: size = comments). */
export function symbolSize(comments: number): number {
  return Math.min(24, 6 + 3 * Math.sqrt(comments));
}

export function shortTitle(title: string, max = 40): string {
  const chars = Array.from(title);
  return chars.length <= max ? title : `${chars.slice(0, max - 1).join('')}…`;
}
