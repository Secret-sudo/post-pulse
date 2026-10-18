// KPI strip model (SPEC §9.2 Overview): six tiles for the selected window,
// change vs the window before, a sparkline inside the window and a status chip.

import {
  change,
  statusFor,
  type Headline,
  type SparkPoint,
  type Status,
  type WindowMetrics,
} from '../../analysis/metrics.ts';

export type KpiId =
  | 'medianImpressions'
  | 'medianReach'
  | 'breakouts'
  | 'comments'
  | 'followersGained'
  | 'engagementRate';

export interface Kpi {
  id: KpiId;
  value: number | null;
  prior: number | null;
  change: number | null;
  status: Status | null;
  /** Days or weeks of the selected window, oldest first; null where there were no posts. */
  series: { start: string; end: string; value: number | null; posts: number }[];
  format: 'number' | 'int' | 'rate';
  posts: number;
  priorPosts: number | null;
}

const PICK: Record<KpiId, { pick: (m: WindowMetrics) => number | null; format: Kpi['format'] }> = {
  medianImpressions: { pick: (m) => m.medianImpressions, format: 'number' },
  medianReach: { pick: (m) => m.medianReach, format: 'number' },
  breakouts: { pick: (m) => m.breakouts, format: 'int' },
  comments: { pick: (m) => m.comments, format: 'int' },
  followersGained: { pick: (m) => m.followersGained, format: 'int' },
  engagementRate: { pick: (m) => m.medianEngagementRate, format: 'rate' },
};

export const KPI_IDS = Object.keys(PICK) as KpiId[];

export function buildKpis(headline: Headline, windowIndex: number, spark: SparkPoint[]): Kpi[] {
  const selected = headline.windows[windowIndex];
  const prior = headline.windows[windowIndex + 1];
  return KPI_IDS.map((id) => {
    const { pick, format } = PICK[id];
    const value = selected ? pick(selected.metrics) : null;
    const priorValue = prior ? pick(prior.metrics) : null;
    const c = change(value, priorValue);
    return {
      id,
      value,
      prior: priorValue,
      change: c,
      status: statusFor(c),
      series: spark.map((s) => ({
        start: s.start,
        end: s.end,
        value: s.metrics.posts === 0 ? null : pick(s.metrics),
        posts: s.metrics.posts,
      })),
      format,
      posts: selected?.metrics.posts ?? 0,
      priorPosts: prior ? prior.metrics.posts : null,
    };
  });
}
