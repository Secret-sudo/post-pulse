import { NO_BREAKOUTS_MIN_POSTS, NO_BREAKOUTS_PRIOR_MIN } from '../constants.ts';
import type { InsightContext } from '../context.ts';
import { int, posts } from '../format.ts';
import type { Insight } from '../types.ts';

export function noBreakouts(ctx: InsightContext): Insight | null {
  const cur = ctx.current?.metrics;
  const breakout = ctx.headline.thresholds.breakout;
  if (!cur || breakout === null || cur.posts < NO_BREAKOUTS_MIN_POSTS || cur.breakouts > 0)
    return null;
  const before = ctx.earlier.map((w) => w.metrics.breakouts);
  const most = Math.max(0, ...before);
  if (most < NO_BREAKOUTS_PRIOR_MIN) return null;
  const prior = ctx.prior?.metrics.breakouts ?? 0;
  return {
    id: 'no_breakouts',
    ruleId: 'no_breakouts',
    severity: 'warning',
    title:
      prior >= NO_BREAKOUTS_PRIOR_MIN
        ? `No breakout post in the last 30 days (${int(prior)} in the 30 before).`
        : 'No breakout post in the last 30 days.',
    evidence: `0 of ${posts(cur.posts)} reached ${int(breakout)}+ impressions (3× your median); earlier windows had ${before.map(int).join(' and ')}.`,
    suggestion: 'Look at your last breakout posts and try their topic or format again.',
    effectSize: 1,
    relatedFilter: { window: 0 },
  };
}
