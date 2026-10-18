// Small statistics helpers (SPEC §6.4: medians, not means).

import { RATIO_DECIMALS } from './constants.ts';

/** Median; mean of the two middle values for even counts; null when empty. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1
    ? (s[mid] as number)
    : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function roundRatio(x: number): number {
  const f = 10 ** RATIO_DECIMALS;
  return Math.round(x * f) / f;
}

/** 1-based ranks; ties get the average of their positions. */
export function averageRanks(values: readonly number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  for (let start = 0; start < order.length;) {
    let end = start;
    while (end + 1 < order.length && order[end + 1]?.v === order[start]?.v) end += 1;
    const rank = (start + end) / 2 + 1;
    for (let j = start; j <= end; j += 1) ranks[(order[j] as { i: number }).i] = rank;
    start = end + 1;
  }
  return ranks;
}

/** Spearman's rank correlation; null when undefined (fewer than 2 pairs or a constant series). */
export function spearman(a: readonly number[], b: readonly number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null;
  const ra = averageRanks(a);
  const rb = averageRanks(b);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < ra.length; i += 1) {
    const da = (ra[i] as number) - ma;
    const db = (rb[i] as number) - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  return va === 0 || vb === 0 ? null : cov / Math.sqrt(va * vb);
}

/** Trailing median over the last `size` values, including the current one. */
export function rollingMedian(values: readonly number[], size: number): number[] {
  return values.map((_, i) => median(values.slice(Math.max(0, i - size + 1), i + 1)) as number);
}

export function sum(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0);
}
