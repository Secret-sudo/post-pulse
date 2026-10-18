// Analysis thresholds (SPEC §6). Change them here only.

export const WINDOW_DAYS = 30;

/** Window sizes the user can pick (SPEC §6.1); 'all' is one window over the whole history. */
export const WINDOW_SIZES = [7, 30, 90, 'all'] as const;
export type WindowSize = (typeof WINDOW_SIZES)[number];

/** Sparkline points inside a window: days for a 7-day window, otherwise weeks (SPEC §9.2). */
export const sparkBucketDays = (size: WindowSize) => (size === 7 ? 1 : 7);

/** Groups smaller than this are shown greyed out and never trigger insights (SPEC §6.3). */
export const MIN_GROUP_POSTS = 3;

/** Trailing posts in the timeline's rolling median (SPEC §6.3). */
export const ROLLING_MEDIAN_POSTS = 7;

/** KPI status chip boundaries on the rounded change (SPEC §6.2). */
export const STATUS_GROWING_AT = 0.1;
export const STATUS_SLIPPING_AT = -0.1;
export const STATUS_DOWN_SHARPLY_AT = -0.3;

/** Decimals that ratios are rounded to before any threshold comparison (SPEC §6.2). */
export const RATIO_DECIMALS = 4;

/** Upper bounds (inclusive) of the outside-network buckets, in percent (SPEC §6.3). */
export const OON_BUCKETS = [
  { id: '0-40', label: '0–40 %', max: 40 },
  { id: '41-60', label: '41–60 %', max: 60 },
  { id: '61-80', label: '61–80 %', max: 80 },
  { id: '81-100', label: '81–100 %', max: 100 },
] as const;
