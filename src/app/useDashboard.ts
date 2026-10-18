// Everything the dashboard views show, derived from history + URL filters.
// The views only render this; they never compute metrics (SPEC §6).
import { useMemo } from 'react';
import { applyFilters, type Filters } from '../analysis/filters.ts';
import { sparkBucketDays } from '../analysis/constants.ts';
import { headline, sparkSeries, type Headline, type SparkPoint } from '../analysis/metrics.ts';
import type { AnalysisSettings } from '../analysis/types.ts';
import type { Post } from '../db/types.ts';
import { generateInsights } from '../insights/engine.ts';
import type { Insight } from '../insights/types.ts';
import type { History } from './useHistory.ts';

export interface Dashboard {
  settings: AnalysisSettings;
  latestExportDate: string;
  filtered: Post[];
  headline: Headline;
  /** Selected window, clamped to the windows that exist. */
  windowIndex: number;
  /** The selected window in days or weeks, for the KPI sparklines. */
  spark: SparkPoint[];
  insights: Insight[];
}

export function useDashboard(history: History, filters: Filters): Dashboard | null {
  return useMemo(() => {
    const E = history.latestExportDate;
    if (!E) return null;
    const settings: AnalysisSettings = {
      breakoutMultiplier: history.settings.breakoutMultiplier,
      viralMultiplier: history.settings.viralMultiplier,
      viralMode: history.settings.viralMode,
      viralImpressions: history.settings.viralImpressions,
      includeImmature: filters.includeImmature ?? history.settings.includeImmature,
    };
    const filtered = applyFilters(history.posts, filters);
    const dataset = { posts: filtered, latestExportDate: E };
    const h = headline(dataset, settings, filters.size);
    const windowIndex = Math.min(filters.window, h.windows.length - 1);
    return {
      settings,
      latestExportDate: E,
      filtered,
      headline: h,
      windowIndex,
      spark: sparkSeries(dataset, settings, h, windowIndex, sparkBucketDays(filters.size)),
      // Insights describe the whole profile, not the filtered slice.
      insights: generateInsights({ posts: history.posts, latestExportDate: E }, settings),
    };
  }, [history, filters]);
}
