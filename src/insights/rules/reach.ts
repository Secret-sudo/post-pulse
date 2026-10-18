import { change, type WindowMetrics } from '../../analysis/metrics.ts';
import { roundRatio } from '../../analysis/stats.ts';
import {
  REACH_DECLINE_AT,
  REACH_DECLINE_CRITICAL_AT,
  REACH_DECLINE_MIN_POSTS,
  RESONANCE_BAND,
} from '../constants.ts';
import type { InsightContext } from '../context.ts';
import { int, posts, rate, signedPct } from '../format.ts';
import type { Insight } from '../types.ts';

interface Decline {
  change: number;
  cur: WindowMetrics & { medianImpressions: number };
  pri: WindowMetrics & { medianImpressions: number };
}

/** The reach decline of the selected window vs the prior one, when both are big enough. */
export function findDecline(ctx: InsightContext): Decline | null {
  const cur = ctx.current?.metrics;
  const pri = ctx.prior?.metrics;
  if (!cur || !pri || cur.posts < REACH_DECLINE_MIN_POSTS || pri.posts < REACH_DECLINE_MIN_POSTS) {
    return null;
  }
  const c = change(cur.medianImpressions, pri.medianImpressions);
  if (c === null || cur.medianImpressions === null || pri.medianImpressions === null) return null;
  if (roundRatio(c) > REACH_DECLINE_AT) return null;
  return {
    change: c,
    cur: { ...cur, medianImpressions: cur.medianImpressions },
    pri: { ...pri, medianImpressions: pri.medianImpressions },
  };
}

export function reachDecline(ctx: InsightContext): Insight | null {
  const d = findDecline(ctx);
  if (!d) return null;
  return {
    id: 'reach_decline',
    ruleId: 'reach_decline',
    severity: roundRatio(d.change) <= REACH_DECLINE_CRITICAL_AT ? 'critical' : 'warning',
    title: `Your typical post reaches fewer people: ${int(d.pri.medianImpressions)} → ${int(d.cur.medianImpressions)} (${signedPct(d.change)}).`,
    evidence: `Median impressions per post: ${int(d.cur.medianImpressions)} across ${posts(d.cur.posts)} in the last 30 days vs ${int(d.pri.medianImpressions)} across ${posts(d.pri.posts)} in the 30 days before.`,
    suggestion:
      'Compare your recent posts with the best ones from the 30 days before and reuse what those had in common.',
    effectSize: Math.abs(roundRatio(d.change)),
    relatedFilter: { window: 0 },
  };
}

export function resonanceHolds(ctx: InsightContext): Insight | null {
  const d = findDecline(ctx);
  if (!d || d.cur.medianEngagementRate === null || d.pri.medianEngagementRate === null) return null;
  const er = change(d.cur.medianEngagementRate, d.pri.medianEngagementRate);
  if (er === null || Math.abs(roundRatio(er)) > RESONANCE_BAND) return null;
  return {
    id: 'resonance_holds',
    ruleId: 'resonance_holds',
    severity: 'info',
    title: 'People still engage at the same rate. The issue is distribution, not quality.',
    evidence: `Median engagement rate ${rate(d.cur.medianEngagementRate)} across ${posts(d.cur.posts)} vs ${rate(d.pri.medianEngagementRate)} across ${posts(d.pri.posts)} (${signedPct(er)}), while median impressions changed ${signedPct(d.change)}.`,
    suggestion:
      'Keep what makes people react and work on reach: posts that travelled outside your network tended to be your biggest.',
    // Ordered next to the decline it explains.
    effectSize: Math.abs(roundRatio(d.change)),
  };
}
