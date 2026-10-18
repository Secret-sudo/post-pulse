// Rolling windows counted back from the latest export date (SPEC §6.1).

import { isMature } from '../import/derive.ts';
import { daysBetween } from '../import/normalise.ts';
import { WINDOW_DAYS } from './constants.ts';
import type { AnalysisPost } from './types.ts';

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Window k covers (E − size·(k+1), E − size·k]: k = 0 is the most recent.
 * Posts dated after E (shouldn't happen) count as k = 0.
 */
export function windowIndex(
  publishDate: string,
  latestExportDate: string,
  size = WINDOW_DAYS,
): number {
  const age = daysBetween(publishDate, latestExportDate);
  return age < 0 ? 0 : Math.floor(age / size);
}

/** First and last day (inclusive) of window k. */
export function windowBounds(k: number, latestExportDate: string, size = WINDOW_DAYS) {
  const end = addDays(latestExportDate, -size * k);
  return { start: addDays(end, -(size - 1)), end };
}

/** Day `days` after (or before, when negative) an ISO date. */
export { addDays };

/** The three most recent windows are W3 (k = 0), W2 and W1; older ones W0, W-1, … */
export function windowLabel(k: number): string {
  return `W${3 - k}`;
}

/** Posts that count, given the "include growing posts" setting (SPEC §4.5). */
export function eligiblePosts<T extends AnalysisPost>(
  posts: readonly T[],
  latestExportDate: string,
  includeImmature: boolean,
): T[] {
  return includeImmature
    ? [...posts]
    : posts.filter((p) => isMature(p.publishDate, latestExportDate));
}

/** Posts grouped by window index; every index from 0 to the oldest post is present. */
export function groupByWindow<T extends AnalysisPost>(
  posts: readonly T[],
  latestExportDate: string,
  size = WINDOW_DAYS,
): T[][] {
  const groups: T[][] = [];
  for (const p of posts) {
    const k = windowIndex(p.publishDate, latestExportDate, size);
    while (groups.length <= k) groups.push([]);
    (groups[k] as T[]).push(p);
  }
  if (groups.length === 0) groups.push([]);
  return groups;
}
