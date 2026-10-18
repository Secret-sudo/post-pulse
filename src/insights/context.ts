// Everything the rules share, computed once per run.

import { headline, type Headline, type WindowSummary } from '../analysis/metrics.ts';
import type { AnalysisPost, AnalysisSettings, Dataset } from '../analysis/types.ts';
import { eligiblePosts, groupByWindow } from '../analysis/windows.ts';
import { isMature } from '../import/derive.ts';

export interface InsightContext {
  settings: AnalysisSettings;
  latestExportDate: string;
  /** Every post, growing or not. */
  all: readonly AnalysisPost[];
  /** Posts that count under `includeImmature`. */
  eligible: readonly AnalysisPost[];
  immature: readonly AnalysisPost[];
  headline: Headline;
  /** Selected window (default W3) and the one before it. */
  current: WindowSummary | undefined;
  prior: WindowSummary | undefined;
  /** The two windows before the selected one (W2 and W1 for W3). */
  earlier: WindowSummary[];
  /** Every post in the selected window, growing ones included (for rhythm). */
  currentAll: readonly AnalysisPost[];
}

export function buildContext(
  dataset: Dataset,
  settings: AnalysisSettings,
  currentWindow = 0,
): InsightContext {
  const h = headline(dataset, settings);
  const E = dataset.latestExportDate;
  return {
    settings,
    latestExportDate: E,
    all: dataset.posts,
    eligible: eligiblePosts(dataset.posts, E, settings.includeImmature),
    immature: dataset.posts.filter((p) => !isMature(p.publishDate, E)),
    headline: h,
    current: h.windows[currentWindow],
    prior: h.windows[currentWindow + 1],
    earlier: h.windows.slice(currentWindow + 1, currentWindow + 3),
    currentAll: groupByWindow(dataset.posts, E)[currentWindow] ?? [],
  };
}
