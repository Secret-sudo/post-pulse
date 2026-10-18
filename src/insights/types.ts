// Insight shape (SPEC §7).

import type { AnalysisSettings, Dataset } from '../analysis/types.ts';
import type { Filters } from '../analysis/filters.ts';
import type { InsightContext } from './context.ts';

export type Severity = 'critical' | 'warning' | 'positive' | 'info';

export interface Insight {
  /** Unique per insight, e.g. `weak_format:Repost`. */
  id: string;
  ruleId: RuleId;
  severity: Severity;
  title: string;
  /** The numbers that triggered it, always with sample sizes (SPEC §6.4). */
  evidence: string;
  /** One concrete action. */
  suggestion: string;
  /** For ordering within a severity; see SPEC §7 "Ordering". */
  effectSize: number;
  relatedFilter?: Partial<Filters>;
}

export type RuleId =
  | 'reach_decline'
  | 'resonance_holds'
  | 'no_breakouts'
  | 'oon_driver'
  | 'comment_drought'
  | 'over_posting'
  | 'weak_format'
  | 'strong_format'
  | 'concentration'
  | 'hashtag_opener'
  | 'growing_posts'
  | 'reach_growth'
  | 'engagement_shift'
  | 'oon_shift'
  | 'breakout_run'
  | 'same_day_split'
  | 'cadence_drop'
  | 'follower_drivers';

/** Related rules; the overview shows at most two of a family (SPEC §7 "Prioritising"). */
export type Family = 'reach' | 'engagement' | 'audience' | 'format' | 'rhythm' | 'note';

export type Rule = (ctx: InsightContext) => Insight | Insight[] | null;

export type { AnalysisSettings, Dataset };
