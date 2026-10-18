// Rule-based insights engine (SPEC §7). No AI: every insight is a pure rule.

import type { AnalysisSettings, Dataset } from '../analysis/types.ts';
import { OVERVIEW_INSIGHTS, OVERVIEW_PER_FAMILY } from './constants.ts';
import { buildContext } from './context.ts';
import { concentration, followerDrivers, oonDriver } from './rules/audience.ts';
import { noBreakouts } from './rules/breakouts.ts';
import { commentDrought } from './rules/comments.ts';
import { hashtagOpener, strongFormat, weakFormat } from './rules/formats.ts';
import { growingPosts } from './rules/growing.ts';
import { reachDecline, resonanceHolds } from './rules/reach.ts';
import { overPosting, sameDaySplit } from './rules/rhythm.ts';
import {
  breakoutRun,
  cadenceDrop,
  engagementShift,
  oonShift,
  reachGrowth,
} from './rules/trends.ts';
import type { Family, Insight, Rule, RuleId, Severity } from './types.ts';

export const RULES: readonly Rule[] = [
  reachDecline,
  resonanceHolds,
  noBreakouts,
  oonDriver,
  commentDrought,
  overPosting,
  weakFormat,
  strongFormat,
  concentration,
  hashtagOpener,
  growingPosts,
  reachGrowth,
  engagementShift,
  oonShift,
  breakoutRun,
  sameDaySplit,
  cadenceDrop,
  followerDrivers,
];

export const FAMILY: Record<RuleId, Family> = {
  reach_decline: 'reach',
  reach_growth: 'reach',
  no_breakouts: 'reach',
  breakout_run: 'reach',
  engagement_shift: 'engagement',
  comment_drought: 'engagement',
  oon_driver: 'audience',
  oon_shift: 'audience',
  concentration: 'audience',
  follower_drivers: 'audience',
  weak_format: 'format',
  strong_format: 'format',
  hashtag_opener: 'format',
  over_posting: 'rhythm',
  same_day_split: 'rhythm',
  cadence_drop: 'rhythm',
  // Context for other findings, not findings of their own.
  resonance_holds: 'note',
  growing_posts: 'note',
};

const isNote = (i: Insight) => FAMILY[i.ruleId] === 'note';

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, positive: 2, info: 3 };

/** Findings before notes, then severity, then effect size (largest first), then id. */
export function compareInsights(a: Insight, b: Insight): number {
  return (
    Number(isNote(a)) - Number(isNote(b)) ||
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    b.effectSize - a.effectSize ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export function generateInsights(
  dataset: Dataset,
  settings: AnalysisSettings,
  currentWindow = 0,
): Insight[] {
  const ctx = buildContext(dataset, settings, currentWindow);
  return RULES.flatMap((rule) => rule(ctx) ?? []).sort(compareInsights);
}

/**
 * The five points the overview shows (SPEC §7 "Prioritising"), from a list
 * already in `compareInsights` order:
 * 1. at most two findings of the same family, so one theme can't crowd out the rest;
 * 2. if a positive finding exists, the best one always makes it in. It replaces the
 *    lowest pick of its own family when that family is full, otherwise the last pick;
 * 3. capped findings, then notes, fill slots that are still free.
 * The result keeps the overall order.
 */
export function overviewInsights(insights: readonly Insight[]): Insight[] {
  const count = (picked: Insight[], f: Family) =>
    picked.filter((i) => FAMILY[i.ruleId] === f).length;
  const picked: Insight[] = [];
  for (const i of insights) {
    if (picked.length === OVERVIEW_INSIGHTS) break;
    if (isNote(i) || count(picked, FAMILY[i.ruleId]) >= OVERVIEW_PER_FAMILY) continue;
    picked.push(i);
  }
  const positive = insights.find((i) => i.severity === 'positive' && !isNote(i));
  if (positive && !picked.includes(positive)) {
    const family = FAMILY[positive.ruleId];
    const sameFamily = picked.filter((i) => FAMILY[i.ruleId] === family);
    const drop =
      sameFamily.length >= OVERVIEW_PER_FAMILY
        ? sameFamily[sameFamily.length - 1]
        : picked.length === OVERVIEW_INSIGHTS
          ? picked[picked.length - 1]
          : undefined;
    if (drop) picked.splice(picked.indexOf(drop), 1);
    picked.push(positive);
  }
  for (const i of insights) {
    if (picked.length >= OVERVIEW_INSIGHTS) break;
    if (!picked.includes(i)) picked.push(i);
  }
  return insights.filter((i) => picked.includes(i));
}
