// Window-over-window trends beyond reach decline (SPEC §7, rules added 17 Oct 2026).
import { change } from '../../analysis/metrics.ts';
import { roundRatio } from '../../analysis/stats.ts';
import { groupByWindow } from '../../analysis/windows.ts';
import {
  BREAKOUT_RUN_MIN,
  CADENCE_DROP_AT,
  CADENCE_PRIOR_MIN,
  ENGAGEMENT_SHIFT_AT,
  OON_SHIFT_POINTS,
  REACH_GROWTH_AT,
  TREND_MIN_POSTS,
} from '../constants.ts';
import type { InsightContext } from '../context.ts';
import { int, posts, rate, signedPct } from '../format.ts';
import type { Insight } from '../types.ts';

/** Both windows exist and have enough posts. */
function pair(ctx: InsightContext) {
  const cur = ctx.current?.metrics;
  const pri = ctx.prior?.metrics;
  if (!cur || !pri || cur.posts < TREND_MIN_POSTS || pri.posts < TREND_MIN_POSTS) return null;
  return { cur, pri };
}

export function reachGrowth(ctx: InsightContext): Insight | null {
  const p = pair(ctx);
  if (!p || p.cur.medianImpressions === null || p.pri.medianImpressions === null) return null;
  const c = change(p.cur.medianImpressions, p.pri.medianImpressions);
  if (c === null || roundRatio(c) < REACH_GROWTH_AT) return null;
  return {
    id: 'reach_growth',
    ruleId: 'reach_growth',
    severity: 'positive',
    title: `Your typical post reaches more people: ${int(p.pri.medianImpressions)} → ${int(p.cur.medianImpressions)} (${signedPct(c)}).`,
    evidence: `Median impressions per post: ${int(p.cur.medianImpressions)} across ${posts(p.cur.posts)} in the last 30 days vs ${int(p.pri.medianImpressions)} across ${posts(p.pri.posts)} in the 30 days before.`,
    suggestion: 'Note what your recent posts have in common and keep doing it.',
    effectSize: Math.abs(roundRatio(c)),
    relatedFilter: { size: 30, window: 0 },
  };
}

export function engagementShift(ctx: InsightContext): Insight | null {
  const p = pair(ctx);
  if (!p || p.cur.medianEngagementRate === null || p.pri.medianEngagementRate === null) return null;
  const c = change(p.cur.medianEngagementRate, p.pri.medianEngagementRate);
  if (c === null || Math.abs(roundRatio(c)) < ENGAGEMENT_SHIFT_AT) return null;
  const up = c > 0;
  return {
    id: 'engagement_shift',
    ruleId: 'engagement_shift',
    severity: up ? 'positive' : 'warning',
    title: up
      ? `People engage more with your posts: ${rate(p.pri.medianEngagementRate)} → ${rate(p.cur.medianEngagementRate)} (${signedPct(c)}).`
      : `Fewer people react to what they see: ${rate(p.pri.medianEngagementRate)} → ${rate(p.cur.medianEngagementRate)} (${signedPct(c)}).`,
    evidence: `Median engagement rate ${rate(p.cur.medianEngagementRate)} across ${posts(p.cur.posts)} in the last 30 days vs ${rate(p.pri.medianEngagementRate)} across ${posts(p.pri.posts)} in the 30 days before.`,
    suggestion: up
      ? 'Your recent posts get people talking. Reply to comments early so the conversation keeps going.'
      : 'End your next posts with one concrete question, and reply to the first comments quickly.',
    effectSize: Math.abs(roundRatio(c)),
    relatedFilter: { size: 30, window: 0 },
  };
}

export function oonShift(ctx: InsightContext): Insight | null {
  const p = pair(ctx);
  const cur = p?.cur.medianOutOfNetworkPct ?? null;
  const pri = p?.pri.medianOutOfNetworkPct ?? null;
  if (!p || cur === null || pri === null) return null;
  const points = Math.round((cur - pri) * 100) / 100;
  if (Math.abs(points) < OON_SHIFT_POINTS) return null;
  const up = points > 0;
  return {
    id: 'oon_shift',
    ruleId: 'oon_shift',
    severity: up ? 'positive' : 'warning',
    title: up
      ? `More of your impressions come from outside your network: ${int(pri)} % → ${int(cur)} %.`
      : `Fewer of your impressions come from outside your network: ${int(pri)} % → ${int(cur)} %.`,
    evidence: `Median share of impressions outside your network: ${int(cur)} % across ${posts(p.cur.posts)} in the last 30 days vs ${int(pri)} % across ${posts(p.pri.posts)} in the 30 days before.`,
    suggestion: up
      ? 'Your posts are travelling beyond your network. Keep the first line clear for people who don’t know you.'
      : 'Write for people who don’t know you yet: a clear first line and no insider references.',
    effectSize: Math.abs(points) / 100,
    relatedFilter: { size: 30, window: 0 },
  };
}

export function breakoutRun(ctx: InsightContext): Insight | null {
  const cur = ctx.current?.metrics;
  const breakout = ctx.headline.thresholds.breakout;
  if (!cur || breakout === null || cur.posts < TREND_MIN_POSTS) return null;
  const prior = ctx.prior?.metrics.breakouts ?? 0;
  if (cur.breakouts < BREAKOUT_RUN_MIN || cur.breakouts <= prior) return null;
  return {
    id: 'breakout_run',
    ruleId: 'breakout_run',
    severity: 'positive',
    title: `${int(cur.breakouts)} breakout posts in the last 30 days (${int(prior)} in the 30 before).`,
    evidence: `${int(cur.breakouts)} of ${posts(cur.posts)} reached ${int(Math.ceil(breakout))}+ impressions (${int(ctx.settings.breakoutMultiplier)}× your median).`,
    suggestion: 'Open your breakout posts side by side and write the next one in the same way.',
    effectSize: (cur.breakouts - prior) / cur.breakouts,
    relatedFilter: { size: 30, window: 0 },
  };
}

/** Counts every post, growing ones too: how often you post doesn't depend on age. */
export function cadenceDrop(ctx: InsightContext): Insight | null {
  const windows = groupByWindow(ctx.all, ctx.latestExportDate);
  const cur = windows[0]?.length ?? 0;
  const pri = windows[1]?.length ?? 0;
  if (pri < CADENCE_PRIOR_MIN || roundRatio(cur / pri) > CADENCE_DROP_AT) return null;
  return {
    id: 'cadence_drop',
    ruleId: 'cadence_drop',
    severity: 'info',
    title: `You posted less: ${posts(cur)} in the last 30 days vs ${int(pri)} in the 30 before.`,
    evidence: `${posts(cur)} published in the last 30 days, ${posts(pri)} in the 30 days before (${signedPct(cur / pri - 1)}).`,
    suggestion:
      'Fewer posts means fewer chances for one to travel. Pick a rhythm you can keep, for example two posts a week.',
    effectSize: roundRatio(1 - cur / pri),
  };
}
