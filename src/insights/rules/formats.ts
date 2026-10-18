import { byHashtagOpener, byPostType } from '../../analysis/breakdowns.ts';
import { median, roundRatio } from '../../analysis/stats.ts';
import {
  GROUP_MIN_POSTS,
  HASHTAG_OPENER_BELOW,
  STRONG_FORMAT_ABOVE,
  WEAK_FORMAT_BELOW,
} from '../constants.ts';
import type { InsightContext } from '../context.ts';
import { int, pct, posts, typePlural } from '../format.ts';
import type { Insight } from '../types.ts';

/** Format comparisons against the median of all eligible posts (SPEC §7). */
function formatInsights(ctx: InsightContext, kind: 'weak' | 'strong'): Insight[] {
  const overall = median(ctx.eligible.map((p) => p.metrics.impressions));
  if (overall === null || overall === 0) return [];
  const out: Insight[] = [];
  for (const [type, g] of byPostType(ctx.eligible)) {
    if (g.posts < GROUP_MIN_POSTS || g.medianImpressions === null) continue;
    const ratio = roundRatio(g.medianImpressions / overall);
    const fires = kind === 'weak' ? ratio < WEAK_FORMAT_BELOW : ratio > STRONG_FORMAT_ABOVE;
    if (!fires) continue;
    const ruleId = kind === 'weak' ? 'weak_format' : 'strong_format';
    out.push({
      id: `${ruleId}:${type}`,
      ruleId,
      severity: kind === 'weak' ? 'warning' : 'positive',
      title: `${typePlural(type)} reach ${pct(ratio - 1)} ${kind === 'weak' ? 'fewer' : 'more'} people than your typical post.`,
      evidence: `Median impressions: ${int(g.medianImpressions)} for ${type} (${posts(g.posts)}) vs ${int(overall)} for all ${posts(ctx.eligible.length)}.`,
      suggestion:
        kind === 'weak'
          ? `Post fewer ${typePlural(type).toLowerCase()}, or rework how you use them.`
          : `Use this format more often for your strongest ideas.`,
      effectSize: Math.abs(ratio - 1),
      relatedFilter: { postTypes: [type] },
    });
  }
  return out;
}

export const weakFormat = (ctx: InsightContext) => formatInsights(ctx, 'weak');
export const strongFormat = (ctx: InsightContext) => formatInsights(ctx, 'strong');

export function hashtagOpener(ctx: InsightContext): Insight | null {
  const { hashtag, other } = byHashtagOpener(ctx.eligible);
  if (hashtag.posts < GROUP_MIN_POSTS || other.posts < GROUP_MIN_POSTS) return null;
  const overall = median(ctx.eligible.map((p) => p.metrics.impressions));
  if (overall === null || overall === 0 || hashtag.medianImpressions === null) return null;
  const ratio = roundRatio(hashtag.medianImpressions / overall);
  if (ratio >= HASHTAG_OPENER_BELOW) return null;
  return {
    id: 'hashtag_opener',
    ruleId: 'hashtag_opener',
    severity: 'warning',
    title: 'Posts that open with hashtags underperform. Start with a scene or a number.',
    evidence: `Median impressions: ${int(hashtag.medianImpressions)} for ${posts(hashtag.posts)} opening with hashtags vs ${int(overall)} for all ${posts(ctx.eligible.length)}.`,
    suggestion: 'Move hashtags to the end and open with a concrete scene, a number or a question.',
    effectSize: Math.abs(ratio - 1),
    relatedFilter: { hashtagOpeners: true },
  };
}
