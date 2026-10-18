import { outOfNetworkCorrelation } from '../../analysis/breakdowns.ts';
import { compareBest, thresholds, windowMetrics } from '../../analysis/metrics.ts';
import { roundRatio, sum } from '../../analysis/stats.ts';
import {
  CONCENTRATION_ABOVE,
  CONCENTRATION_MIN_POSTS,
  FOLLOWER_MIN_POSTS,
  FOLLOWER_MIN_TOTAL,
  FOLLOWER_SHARE_AT,
  FOLLOWER_TOP,
  OON_DRIVER_MIN_POSTS,
  OON_DRIVER_MIN_RHO,
} from '../constants.ts';
import type { InsightContext } from '../context.ts';
import { int, pct, posts, twoDecimals } from '../format.ts';
import type { Insight } from '../types.ts';

export function oonDriver(ctx: InsightContext): Insight | null {
  const { n, rho } = outOfNetworkCorrelation(ctx.eligible);
  if (n < OON_DRIVER_MIN_POSTS || rho === null || roundRatio(rho) < OON_DRIVER_MIN_RHO) return null;
  return {
    id: 'oon_driver',
    ruleId: 'oon_driver',
    severity: 'info',
    title: 'Your big posts are the ones LinkedIn shows outside your network.',
    evidence: `Across ${posts(n)}, a higher share of impressions outside your network went with more impressions (rank correlation ${twoDecimals(rho)}).`,
    suggestion:
      "Write for people who don't know you yet: a clear first line and no insider references.",
    effectSize: Math.abs(roundRatio(rho)),
  };
}

export function concentration(ctx: InsightContext): Insight | null {
  if (ctx.all.length < CONCENTRATION_MIN_POSTS) return null;
  const m = windowMetrics(ctx.all, thresholds(ctx.all, ctx.settings));
  if (m.top1Share === null || roundRatio(m.top1Share) <= CONCENTRATION_ABOVE || !m.bestPost)
    return null;
  return {
    id: 'concentration',
    ruleId: 'concentration',
    severity: 'info',
    title: `One post produced ${pct(m.top1Share)} of all impressions.`,
    evidence: `${int(m.bestPost.metrics.impressions)} of ${int(m.impressions)} impressions across ${posts(m.posts)} came from a single post.`,
    suggestion:
      'Judge your progress by the median post, not the total: one outlier hides the trend.',
    effectSize: roundRatio(m.top1Share),
  };
}

/** Full history, all posts: a few posts bring most of the followers your posts gained. */
export function followerDrivers(ctx: InsightContext): Insight | null {
  if (ctx.all.length < FOLLOWER_MIN_POSTS) return null;
  const gained = (p: (typeof ctx.all)[number]) => p.metrics.followersGained ?? 0;
  const total = sum(ctx.all.map(gained));
  if (total < FOLLOWER_MIN_TOTAL) return null;
  const leaders = [...ctx.all]
    .sort((a, b) => gained(b) - gained(a) || compareBest(a, b))
    .slice(0, FOLLOWER_TOP);
  const top = sum(leaders.map(gained));
  const share = roundRatio(top / total);
  if (share < FOLLOWER_SHARE_AT) return null;
  return {
    id: 'follower_drivers',
    ruleId: 'follower_drivers',
    severity: 'info',
    title: `${int(FOLLOWER_TOP)} posts brought ${pct(share)} of the followers your posts gained.`,
    evidence: `${int(top)} of ${int(total)} followers gained across ${posts(ctx.all.length)} came with ${leaders.map((p) => `“${p.title || p.postId}”`).join(', ')}.`,
    suggestion:
      'Open these posts and look for what they share: topic, format, first line. Then try it again.',
    effectSize: share,
  };
}
