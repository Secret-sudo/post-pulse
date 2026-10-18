import { byPostsPerDay, rhythm } from '../../analysis/breakdowns.ts';
import { roundRatio } from '../../analysis/stats.ts';
import {
  OVER_POSTING_MIN_POSTS,
  OVER_POSTING_MULTI_DAYS,
  OVER_POSTING_PER_WEEK,
  GROUP_MIN_POSTS,
  SAME_DAY_BELOW,
} from '../constants.ts';
import type { InsightContext } from '../context.ts';
import { int, oneDecimal, pct, posts } from '../format.ts';
import type { Insight } from '../types.ts';

/** Uses every post in the window, growing ones too: rhythm doesn't depend on age (SPEC §7). */
export function overPosting(ctx: InsightContext): Insight | null {
  const r = rhythm(ctx.currentAll);
  if (r.posts < OVER_POSTING_MIN_POSTS) return null;
  const tooMany = r.postsPerWeek > OVER_POSTING_PER_WEEK;
  const stacked = r.daysWithMultiplePosts >= OVER_POSTING_MULTI_DAYS;
  if (!tooMany && !stacked) return null;
  return {
    id: 'over_posting',
    ruleId: 'over_posting',
    severity: 'info',
    title: 'You often post several times a day; your posts may compete with each other.',
    evidence: `${posts(r.posts)} in the last 30 days (${oneDecimal(r.postsPerWeek)} per week), ${int(r.daysWithMultiplePosts)} ${r.daysWithMultiplePosts === 1 ? 'day' : 'days'} with 2 or more posts.`,
    suggestion: 'Spread your posts out: one a day at most, so a strong post has room to travel.',
    effectSize: Math.max(
      r.postsPerWeek / OVER_POSTING_PER_WEEK - 1,
      r.daysWithMultiplePosts / 10,
      0,
    ),
  };
}

/** Full history: posts that share their day with another post vs posts alone on their day. */
export function sameDaySplit(ctx: InsightContext): Insight | null {
  const groups = byPostsPerDay(ctx.eligible);
  const single = groups.get('single');
  const multiple = groups.get('multiple');
  if (
    !single ||
    !multiple ||
    single.posts < GROUP_MIN_POSTS ||
    multiple.posts < GROUP_MIN_POSTS ||
    single.medianImpressions === null ||
    multiple.medianImpressions === null ||
    single.medianImpressions === 0
  )
    return null;
  const ratio = roundRatio(multiple.medianImpressions / single.medianImpressions);
  if (ratio >= SAME_DAY_BELOW) return null;
  return {
    id: 'same_day_split',
    ruleId: 'same_day_split',
    severity: 'warning',
    title: `Posts that share a day with another post reach ${pct(1 - ratio)} fewer people.`,
    evidence: `Median impressions: ${int(multiple.medianImpressions)} for ${posts(multiple.posts)} on days with 2 or more posts vs ${int(single.medianImpressions)} for ${posts(single.posts)} alone on their day.`,
    suggestion: 'Give each post its own day, so one doesn’t take attention from the other.',
    effectSize: roundRatio(1 - ratio),
  };
}
