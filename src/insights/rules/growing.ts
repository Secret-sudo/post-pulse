import type { InsightContext } from '../context.ts';
import { posts } from '../format.ts';
import type { Insight } from '../types.ts';

/** Only while growing posts are left out; with "include growing posts" on there's nothing to say. */
export function growingPosts(ctx: InsightContext): Insight | null {
  const n = ctx.immature.length;
  if (n === 0 || ctx.settings.includeImmature) return null;
  return {
    id: 'growing_posts',
    ruleId: 'growing_posts',
    severity: 'info',
    title: `${posts(n)} ${n === 1 ? 'is' : 'are'} still collecting impressions and ${n === 1 ? 'is' : 'are'} excluded from comparisons.`,
    evidence: `${posts(n)} from the last 7 days ${n === 1 ? 'is' : 'are'} left out until ${n === 1 ? "it's" : "they're"} a week old.`,
    suggestion: 'Check back in a few days, or turn on "Include growing posts" to see them now.',
    effectSize: n / 100,
    relatedFilter: { includeImmature: true },
  };
}
