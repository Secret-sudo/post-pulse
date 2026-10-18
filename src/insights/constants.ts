// Insight thresholds and minimum sample sizes (SPEC §7). Change them here only.

export const REACH_DECLINE_AT = -0.15;
export const REACH_DECLINE_CRITICAL_AT = -0.3;
export const REACH_DECLINE_MIN_POSTS = 5;

/** resonance_holds: engagement-rate change within ± this, inclusive. */
export const RESONANCE_BAND = 0.15;

export const NO_BREAKOUTS_MIN_POSTS = 5;
/** Breakouts an earlier window needs for "no breakouts now" to matter. */
export const NO_BREAKOUTS_PRIOR_MIN = 2;

export const OON_DRIVER_MIN_RHO = 0.5;
export const OON_DRIVER_MIN_POSTS = 20;

export const COMMENT_DROUGHT_AT = 0.5;
export const COMMENT_DROUGHT_MIN_POSTS = 5;

export const OVER_POSTING_PER_WEEK = 5;
export const OVER_POSTING_MULTI_DAYS = 3;
export const OVER_POSTING_MIN_POSTS = 5;

export const WEAK_FORMAT_BELOW = 0.7;
export const STRONG_FORMAT_ABOVE = 1.3;

export const CONCENTRATION_ABOVE = 0.5;
export const CONCENTRATION_MIN_POSTS = 10;

export const HASHTAG_OPENER_BELOW = 0.8;

/** Group size needed for format, topic and hashtag comparisons (SPEC §6.3). */
export const GROUP_MIN_POSTS = 3;

export const OVERVIEW_INSIGHTS = 5;

// Rules added on 17 Oct 2026 (SPEC §7, "More rules").
export const REACH_GROWTH_AT = 0.15;
export const TREND_MIN_POSTS = 5;

/** engagement_shift: median engagement-rate change of at least ± this. */
export const ENGAGEMENT_SHIFT_AT = 0.2;

/** oon_shift: change of the median outside-network share, in percentage points. */
export const OON_SHIFT_POINTS = 10;

/** breakout_run: breakouts the current window needs, and more than the prior one. */
export const BREAKOUT_RUN_MIN = 2;

/** same_day_split: posts sharing a day reach less than this × posts alone on their day. */
export const SAME_DAY_BELOW = 0.8;

/** cadence_drop: current posts ≤ this × prior posts, with at least CADENCE_PRIOR_MIN before. */
export const CADENCE_DROP_AT = 0.5;
export const CADENCE_PRIOR_MIN = 4;

/** follower_drivers: the top FOLLOWER_TOP posts hold at least this share of followers gained. */
export const FOLLOWER_TOP = 3;
export const FOLLOWER_SHARE_AT = 0.5;
export const FOLLOWER_MIN_POSTS = 10;
export const FOLLOWER_MIN_TOTAL = 10;

/** Overview selection (SPEC §7 "Prioritising"): at most this many per family. */
export const OVERVIEW_PER_FAMILY = 2;
