// Share carousel (SPEC §9.2 screen 8, Alpha): what goes on each slide. Pure:
// the canvas renderer only draws these strings and numbers. Slides are always
// in English and speak in the first person ("my posts"), because the user posts them.

import { byPostType } from '../analysis/breakdowns.ts';
import { MIN_GROUP_POSTS } from '../analysis/constants.ts';
import { compareBest, headline } from '../analysis/metrics.ts';
import { median, roundRatio, sum } from '../analysis/stats.ts';
import type { AnalysisPost, AnalysisSettings, Dataset } from '../analysis/types.ts';
import { addDays, eligiblePosts } from '../analysis/windows.ts';
import { fmtDate, fmtDay, fmtInt } from '../app/format.ts';
import { daysBetween } from '../import/normalise.ts';
import type { PostType } from '../import/types.ts';
import { TREND_MIN_POSTS } from '../insights/constants.ts';
import { typePlural } from '../insights/format.ts';
import type { Insight } from '../insights/types.ts';

export const APP_URL = 'lipulse.netlify.app';
/** The recap covers the last 90 days up to the latest export (SPEC §9.2 screen 8). */
export const RECAP_DAYS = 90;
/** Weeks in the momentum slide's trend line. */
export const MOMENTUM_WEEKS = 13;
/** The cover's fallback fact needs one post with at least this share of all impressions. */
export const COVER_CONCENTRATION_AT = 0.25;
/** Without a format insight, formats within ± this of the typical post count as "about the same". */
export const LESSON_SAME_BELOW = 0.1;

export interface CarouselOptions {
  /** Show absolute numbers (impressions, comments …) or only relative changes. */
  absolute: boolean;
  /** Sample data: the cover says so in large letters. */
  sample: boolean;
}

export interface Stat {
  big: string;
  small: string;
}

export type Slide =
  | { kind: 'cover'; kicker: string; headline: string; sub: string; sample: boolean }
  | {
      kind: 'lesson';
      headline: string;
      /** Whether the highlighted format did better or worse than the typical post. */
      tone: 'positive' | 'negative' | 'neutral';
      caption: string;
      bars: { label: string; posts: number; value: number; display: string; highlight: boolean }[];
      typical: { value: number; label: string };
      note: string;
    }
  | {
      kind: 'momentum';
      kicker: string;
      label: string;
      /** Colours the change: green up, red down, neutral otherwise. */
      trend: 'up' | 'down' | 'flat' | 'none';
      change: string;
      summary: string;
      detail: string | null;
      /** Small samples are shown, but with a caveat. */
      note: string | null;
      series: (number | null)[];
      seriesLabel: string;
      stats: Stat[];
    }
  | {
      kind: 'recap';
      kicker: string;
      headline: string;
      stats: Stat[];
      topLabel: string;
      topTitle: string;
      topDetail: string;
      thanks: string;
    }
  | { kind: 'closing'; headline: string; url: string; privacy: string; disclaimer: string };

export type SlideKind = Slide['kind'];

/** Every slide, always: bad news included. The user picks which pages to post (SPEC §9.2 screen 8). */
export interface Carousel {
  slides: Slide[];
}

const NBSP = ' ';
const MINUS = '−';
const pct = (ratio: number) => `${fmtInt(Math.round(Math.abs(ratio) * 100))}${NBSP}%`;
const signedPct = (ratio: number) => `${ratio < 0 ? MINUS : '+'}${pct(ratio)}`;
const share = (value: number) => `${fmtInt(Math.round(value))}${NBSP}%`;
const signedPoints = (points: number) =>
  `${points < 0 ? MINUS : '+'}${fmtInt(Math.abs(Math.round(points)))}`;
const postsText = (n: number) => `${fmtInt(n)} ${n === 1 ? 'post' : 'posts'}`;

/** Title from the post link: LinkedIn cuts it, so it always ends with "…". */
export function shareTitle(p: Pick<AnalysisPost, 'title' | 'publishDate'>): string {
  const t = p.title.trim();
  if (!t) return `My post of ${fmtDate(p.publishDate)}`;
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}…`;
}

const typeFromId = (id: string) => id.split(':')[1] as PostType;

function weeklyMedians(eligible: readonly AnalysisPost[], E: string): (number | null)[] {
  const out: (number | null)[] = [];
  for (let j = MOMENTUM_WEEKS - 1; j >= 0; j -= 1) {
    const end = addDays(E, -7 * j);
    const start = addDays(end, -6);
    out.push(
      median(
        eligible
          .filter((p) => p.publishDate >= start && (p.publishDate <= end || j === 0))
          .map((p) => p.metrics.impressions),
      ),
    );
  }
  return out;
}

function recapHeadline(days: number): string {
  if (days >= 85) return 'My last 3 months on LinkedIn';
  if (days >= 14) return `My last ${fmtInt(Math.round(days / 7))} weeks on LinkedIn`;
  return `My last ${fmtInt(days)} ${days === 1 ? 'day' : 'days'} on LinkedIn`;
}

/**
 * The slides for a profile. `insights` is the overview's list (SPEC §7), so the
 * carousel tells the same story as "What stands out".
 */
export function buildCarousel(
  dataset: Dataset,
  settings: AnalysisSettings,
  insights: readonly Insight[],
  opts: CarouselOptions,
): Carousel {
  const E = dataset.latestExportDate;
  const all = dataset.posts;
  const earliest = all.reduce((min, p) => (p.publishDate < min ? p.publishDate : min), E);
  const recapStart = [addDays(E, -(RECAP_DAYS - 1)), earliest].sort().at(-1) ?? E;
  const recentAll = all.filter((p) => p.publishDate >= recapStart);
  const recentEligible = eligiblePosts(recentAll, E, settings.includeImmature);
  const eligible = eligiblePosts(all, E, settings.includeImmature);
  const range = `${fmtDay(recapStart)} – ${fmtDate(E)}`;
  const slides: Slide[] = [];

  // The strongest format finding, good or bad (also used for the lesson slide).
  const formatFinding = [...insights]
    .filter((i) => i.ruleId === 'weak_format' || i.ruleId === 'strong_format')
    .sort((a, b) => b.effectSize - a.effectSize || (a.id < b.id ? -1 : 1))[0];

  // Cover: the best positive finding that isn't already the lesson, else the biggest fact.
  const h30 = headline(dataset, settings, 30);
  const cur = h30.windows[0]?.metrics;
  const pri = h30.windows[1]?.metrics;
  const coverFrom = (i: Insight): string | null => {
    switch (i.ruleId) {
      case 'reach_growth':
        return `My typical post reached ${pct(i.effectSize)} more people than the month before.`;
      case 'breakout_run':
        return cur && pri
          ? `${fmtInt(cur.breakouts)} breakout posts in the last 30 days, after ${fmtInt(pri.breakouts)} the month before.`
          : null;
      case 'engagement_shift':
        return `People engaged ${pct(i.effectSize)} more with my posts than the month before.`;
      case 'oon_shift':
        return cur?.medianOutOfNetworkPct !== null && cur?.medianOutOfNetworkPct !== undefined
          ? `${share(cur.medianOutOfNetworkPct)} of my impressions now come from outside my network.`
          : null;
      case 'strong_format':
        return `My ${typePlural(typeFromId(i.id)).toLowerCase()} reached ${pct(i.effectSize)} more people than my typical post.`;
      default:
        return null;
    }
  };
  let cover: string | null = null;
  for (const i of insights) {
    if (i.severity !== 'positive' || i === formatFinding) continue;
    cover = coverFrom(i);
    if (cover) break;
  }
  const recentTotal = sum(recentAll.map((p) => p.metrics.impressions));
  const top = [...recentAll].sort(compareBest)[0];
  const topShare = top && recentTotal > 0 ? top.metrics.impressions / recentTotal : 0;
  if (!cover && roundRatio(topShare) >= COVER_CONCENTRATION_AT) {
    cover = `1 post brought ${pct(topShare)} of all my impressions.`;
  }
  slides.push({
    kind: 'cover',
    kicker: `My LinkedIn · ${range}`,
    headline: cover ?? `What ${postsText(recentAll.length)} taught me about LinkedIn.`,
    sub: `Across ${postsText(recentAll.length)}. Here is what else my own numbers say.`,
    sample: opts.sample,
  });

  // Lesson: the strongest format finding; without one, the format that differs most.
  const overall = median(eligible.map((p) => p.metrics.impressions)) ?? 0;
  const groups = [...byPostType(eligible)]
    .filter(([, g]) => g.posts >= MIN_GROUP_POSTS && g.medianImpressions !== null)
    .map(([t, g]) => ({ t, n: g.posts, m: g.medianImpressions as number }))
    .sort((a, b) => b.m - a.m || (a.t < b.t ? -1 : 1));
  const ratioOf = (m: number) => (overall > 0 ? roundRatio(m / overall) : 1);
  const widest = [...groups].sort(
    (a, b) => Math.abs(ratioOf(b.m) - 1) - Math.abs(ratioOf(a.m) - 1) || (a.t < b.t ? -1 : 1),
  )[0];
  const focus: { type: PostType; diff: number } | null = formatFinding
    ? {
        type: typeFromId(formatFinding.id),
        diff:
          formatFinding.ruleId === 'weak_format'
            ? -formatFinding.effectSize
            : formatFinding.effectSize,
      }
    : widest && Math.round(Math.abs(ratioOf(widest.m) - 1) * 100) >= LESSON_SAME_BELOW * 100
      ? { type: widest.t, diff: ratioOf(widest.m) - 1 }
      : null;
  slides.push({
    kind: 'lesson',
    tone: !focus ? 'neutral' : focus.diff < 0 ? 'negative' : 'positive',
    headline:
      groups.length === 0
        ? 'Not enough posts per format yet to compare formats.'
        : focus
          ? `${typePlural(focus.type)} reached ${pct(focus.diff)} ${focus.diff < 0 ? 'fewer' : 'more'} people than my typical post.`
          : 'My formats reached about as many people as my typical post.',
    caption: opts.absolute
      ? 'Median impressions per post, by format'
      : 'Compared with my typical post',
    bars: groups.map((g) => ({
      label: g.t,
      posts: g.n,
      value: g.m,
      display: opts.absolute ? fmtInt(g.m) : signedPct(ratioOf(g.m) - 1),
      highlight: focus?.type === g.t,
    })),
    typical: {
      value: overall,
      label: opts.absolute ? `typical post · ${fmtInt(overall)}` : 'typical post',
    },
    note:
      groups.length === 0
        ? `A format needs at least ${fmtInt(MIN_GROUP_POSTS)} posts to count.`
        : settings.includeImmature
          ? `Medians of my ${postsText(eligible.length)}. It shows what went together, not what caused it.`
          : `Medians of my ${postsText(eligible.length)} older than 7 days. It shows what went together, not what caused it.`,
  });

  // Momentum, good or bad: a falling reach is worth showing too. Plain facts, no causes.
  const curMed = cur?.medianImpressions ?? null;
  const priMed = pri?.medianImpressions ?? null;
  const change =
    curMed !== null && priMed !== null && priMed > 0 ? roundRatio(curMed / priMed - 1) : null;
  const trend: 'up' | 'down' | 'flat' | 'none' =
    change === null ? 'none' : Math.round(change * 100) === 0 ? 'flat' : change > 0 ? 'up' : 'down';
  const momentumStats: Stat[] = [];
  if (cur && pri && cur.posts > 0 && pri.posts > 0) {
    if (opts.absolute) {
      momentumStats.push({
        big: `${fmtInt(cur.breakouts)} vs ${fmtInt(pri.breakouts)}`,
        small: `breakout posts (${fmtInt(settings.breakoutMultiplier)}× my median)`,
      });
    } else if (cur.medianEngagementRate !== null && pri.medianEngagementRate) {
      momentumStats.push({
        big: signedPct(roundRatio(cur.medianEngagementRate / pri.medianEngagementRate - 1)),
        small: 'engagement rate',
      });
    }
    if (cur.medianOutOfNetworkPct !== null && pri.medianOutOfNetworkPct !== null) {
      momentumStats.push({
        big: share(cur.medianOutOfNetworkPct),
        small: `of impressions from outside my network (${signedPoints(cur.medianOutOfNetworkPct - pri.medianOutOfNetworkPct)} points)`,
      });
    }
  }
  const curPosts = cur?.posts ?? 0;
  const priPosts = pri?.posts ?? 0;
  slides.push({
    kind: 'momentum',
    kicker: 'Last 30 days vs the 30 before',
    label: 'Reach of my typical post',
    trend,
    change: change === null ? '–' : trend === 'flat' ? `±0${NBSP}%` : signedPct(change),
    summary: {
      up: 'More people saw my typical post than the month before.',
      down: 'Fewer people saw my typical post than the month before.',
      flat: 'About as many people saw my typical post as the month before.',
      none: 'Not enough posts in the last 60 days to compare yet.',
    }[trend],
    detail:
      opts.absolute && curMed !== null && priMed !== null
        ? `from ${fmtInt(priMed)} to ${fmtInt(curMed)} impressions (median)`
        : null,
    note:
      trend !== 'none' && (curPosts < TREND_MIN_POSTS || priPosts < TREND_MIN_POSTS)
        ? `Based on only ${fmtInt(curPosts)} and ${fmtInt(priPosts)} posts.`
        : null,
    series: weeklyMedians(eligible, E),
    seriesLabel: `Typical post, week by week (${MOMENTUM_WEEKS} weeks)`,
    stats: momentumStats,
  });

  // Recap of the last 90 days.
  const recentMedian = median(recentEligible.map((p) => p.metrics.impressions));
  const best = [...byPostType(recentEligible)]
    .filter(([, g]) => g.posts >= MIN_GROUP_POSTS && g.medianImpressions !== null)
    .map(([t, g]) => ({
      t,
      ratio: recentMedian ? (g.medianImpressions as number) / recentMedian : 0,
    }))
    .sort((a, b) => b.ratio - a.ratio || (a.t < b.t ? -1 : 1))[0];
  const withOon = recentAll.flatMap((p) =>
    p.metrics.outOfNetworkPct === null ? [] : [p.metrics.outOfNetworkPct],
  );
  const oonMedian = median(withOon);
  const stats: Stat[] = opts.absolute
    ? [
        { big: fmtInt(recentAll.length), small: recentAll.length === 1 ? 'post' : 'posts' },
        { big: fmtInt(recentTotal), small: 'impressions' },
        { big: fmtInt(sum(recentAll.map((p) => p.metrics.comments))), small: 'comments' },
        {
          big: fmtInt(sum(recentAll.map((p) => p.metrics.followersGained ?? 0))),
          small: 'new followers',
        },
      ]
    : [
        { big: fmtInt(recentAll.length), small: recentAll.length === 1 ? 'post' : 'posts' },
        {
          big: share(
            recentAll.length
              ? (recentAll.filter((p) => p.metrics.comments > 0).length / recentAll.length) * 100
              : 0,
          ),
          small: 'of posts got comments',
        },
        ...(oonMedian === null
          ? []
          : [{ big: share(oonMedian), small: 'typical share outside my network' }]),
        ...(best
          ? [{ big: best.t, small: `best format, ${signedPct(roundRatio(best.ratio) - 1)}` }]
          : []),
      ];
  const topOon = top?.metrics.outOfNetworkPct ?? null;
  const topParts = top
    ? [
        opts.absolute
          ? `${fmtInt(top.metrics.impressions)} impressions`
          : `${pct(topShare)} of all my impressions`,
        ...(topOon === null ? [] : [`${share(topOon)} outside my network`]),
      ]
    : [];
  slides.push({
    kind: 'recap',
    kicker: range,
    headline: recapHeadline(daysBetween(recapStart, E) + 1),
    stats,
    topLabel: 'Most-read post',
    topTitle: top ? `“${shareTitle(top)}”` : '',
    topDetail: topParts.join(' · '),
    thanks: 'Thank you to everyone who read, commented and shared.',
  });

  slides.push({
    kind: 'closing',
    headline: 'Made with Post Pulse',
    url: APP_URL,
    privacy: 'Analysed in my browser from my LinkedIn export. My data never left my device.',
    disclaimer: 'Not affiliated with LinkedIn Corporation.',
  });

  return { slides };
}
