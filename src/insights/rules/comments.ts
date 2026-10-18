import { roundRatio } from '../../analysis/stats.ts';
import { COMMENT_DROUGHT_AT, COMMENT_DROUGHT_MIN_POSTS } from '../constants.ts';
import type { InsightContext } from '../context.ts';
import { int, pct, posts } from '../format.ts';
import type { Insight } from '../types.ts';

export function commentDrought(ctx: InsightContext): Insight | null {
  const cur = ctx.current?.metrics;
  if (!cur || cur.posts < COMMENT_DROUGHT_MIN_POSTS || cur.zeroCommentShare === null) return null;
  if (roundRatio(cur.zeroCommentShare) < COMMENT_DROUGHT_AT) return null;
  return {
    id: 'comment_drought',
    ruleId: 'comment_drought',
    severity: 'warning',
    title: `${pct(cur.zeroCommentShare)} of recent posts got no comments.`,
    evidence: `${int(cur.zeroCommentPosts)} of ${posts(cur.posts)} in the last 30 days had no comments.`,
    suggestion: 'End with one specific question your readers can answer in a sentence.',
    effectSize: roundRatio(cur.zeroCommentShare),
    relatedFilter: { window: 0 },
  };
}
