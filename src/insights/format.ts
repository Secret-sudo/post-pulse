// Number formatting for insight text. Plain, whole percentages (SPEC §9.4).

import type { PostType } from '../import/types.ts';

const INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const ONE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TWO = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const int = (n: number) => INT.format(n);

/** 0.213 → "21 %" */
export const pct = (ratio: number) => `${INT.format(Math.abs(ratio) * 100)} %`;

/** −0.213 → "−21 %", 0.1 → "+10 %" */
export const signedPct = (ratio: number) => `${ratio < 0 ? '−' : '+'}${pct(ratio)}`;

/** Engagement rate 0.0192 → "1.9 %" */
export const rate = (ratio: number) => `${ONE.format(ratio * 100)} %`;

export const oneDecimal = (n: number) => ONE.format(n);
export const twoDecimals = (n: number) => TWO.format(n);

export const posts = (n: number) => `${int(n)} ${n === 1 ? 'post' : 'posts'}`;

const TYPE_PLURAL: Record<PostType, string> = {
  Image: 'Image posts',
  Video: 'Videos',
  Repost: 'Reposts',
  Text: 'Text posts',
  Article: 'Articles',
  Document: 'Documents',
  Poll: 'Polls',
  Celebration: 'Celebrations',
  Other: 'Other posts',
};

/** "Reposts", "Image posts" … for insight titles. */
export const typePlural = (t: PostType) => TYPE_PLURAL[t];
