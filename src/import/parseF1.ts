// Per-post performance export (F1) parser (SPEC §4.2–4.5). Works on plain
// cell rows so it doesn't depend on the workbook library.

import type { F1Detection } from './detect.ts';
import { lookupPostType, type F1Field } from './headers.ts';
import { derivePostId, deriveAuthorSlug, deriveTitle, isHashtagTitle } from './derive.ts';
import {
  cellText,
  daysBetween,
  isEmptyCell,
  isSlashDate,
  parseDate,
  parseDuration,
  parseInteger,
  parsePercent,
  parseSlashDate,
  type Parsed,
  type SlashOrder,
} from './normalise.ts';
import type {
  Cell,
  F1Result,
  ImportError,
  ParsedPost,
  ParseWarning,
  PostMetrics,
  PostType,
} from './types.ts';

const FILE_RANGE = /(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.xlsx$/i;

/** `PostPerformance_2026-07-17_2026-10-14.xlsx` → start and end date. */
export function rangeFromFileName(fileName: string): { start: string; end: string } | null {
  const m = FILE_RANGE.exec(fileName);
  if (!m?.[1] || !m[2]) return null;
  const valid = (d: string) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
  return valid(m[1]) && valid(m[2]) ? { start: m[1], end: m[2] } : null;
}

/** Count fields that default to 0 when empty (SPEC §4.3). */
const REQUIRED_COUNTS = [
  'impressions',
  'reactions',
  'comments',
  'reposts',
  'saves',
  'sends',
] as const;

/** Allowed gap between in-network + out-of-network and 100 % (SPEC §4.2). */
const NETWORK_SUM_TOLERANCE = 1;

/** Dates may sit this many days outside the file-name range (SPEC §4.3). */
const RANGE_TOLERANCE_DAYS = 1;

function chooseSlashOrder(
  dates: string[],
  preferred: SlashOrder,
  warnings: ParseWarning[],
): SlashOrder {
  const other: SlashOrder = preferred === 'MDY' ? 'DMY' : 'MDY';
  const allValid = (order: SlashOrder) => dates.every((d) => parseSlashDate(d, order) !== null);
  if (!allValid(preferred) && dates.length > 0 && allValid(other)) {
    warnings.push({
      code: 'date-order-switched',
      message: `Dates only make sense as ${other === 'DMY' ? 'day/month/year' : 'month/day/year'}, so they were read that way.`,
      column: 'publishDate',
    });
    return other;
  }
  return preferred;
}

export async function parseF1(
  rows: readonly (readonly Cell[])[],
  detection: F1Detection,
  fileName: string,
  sheetName: string,
): Promise<F1Result | { ok: false; error: ImportError }> {
  const warnings: ParseWarning[] = [];
  const col = detection.columns;
  const cell = (row: readonly Cell[], field: F1Field): Cell => {
    const i = col[field];
    return i === undefined ? undefined : row[i];
  };

  const dataRows = rows
    .slice(1)
    .map((row, i) => ({ row, rowNumber: i + 2 }))
    .filter(({ row }) => row.some((c) => !isEmptyCell(c)));

  if (dataRows.length === 0) {
    return {
      ok: false,
      error: { code: 'empty', message: 'This export has no posts in it.' },
    };
  }

  const slashDates = dataRows
    .map(({ row }) => cell(row, 'publishDate'))
    .filter(isSlashDate)
    .map((d) => d.trim());
  const order = chooseSlashOrder(slashDates, detection.language === 'en' ? 'MDY' : 'DMY', warnings);

  const posts: ParsedPost[] = [];
  const seen = new Set<string>();

  for (const { row, rowNumber } of dataRows) {
    const warn = (column: string, code: string, message: string) =>
      warnings.push({ code, message, row: rowNumber, column });
    const take = <T>(field: F1Field, parsed: Parsed<T>): T | null => {
      if (parsed.problem) warn(field, 'bad-value', parsed.problem);
      return parsed.value;
    };

    const url = cellText(cell(row, 'postUrl'));
    if (url === '') {
      warn('postUrl', 'row-skipped', 'Row skipped: it has no post URL.');
      continue;
    }
    const publishDate = take('publishDate', parseDate(cell(row, 'publishDate'), order));
    if (!publishDate) {
      warn('publishDate', 'row-skipped', 'Row skipped: its publish date could not be read.');
      continue;
    }

    const postTypeRaw = cellText(cell(row, 'postType'));
    const known = lookupPostType(postTypeRaw);
    const postType: PostType = known ?? 'Other';
    if (postTypeRaw === '') warn('postType', 'bad-value', 'Post type is empty.');

    const int = (f: F1Field) => take(f, parseInteger(cell(row, f)));
    const counts = Object.fromEntries(
      REQUIRED_COUNTS.map((f) => {
        const v = int(f);
        if (v === null) warn(f, 'defaulted-to-zero', `Empty ${f} counted as 0.`);
        return [f, v ?? 0];
      }),
    ) as Record<(typeof REQUIRED_COUNTS)[number], number>;

    const metrics: PostMetrics = {
      ...counts,
      inNetworkPct: take('inNetworkPct', parsePercent(cell(row, 'inNetworkPct'))),
      outOfNetworkPct: take('outOfNetworkPct', parsePercent(cell(row, 'outOfNetworkPct'))),
      membersReached: int('membersReached'),
      views: int('views'),
      watchTimeSec: take('watchTime', parseDuration(cell(row, 'watchTime'))),
      avgWatchTimeSec: take('avgWatchTime', parseDuration(cell(row, 'avgWatchTime'))),
      followersGained: int('followersGained'),
      profileViewers: int('profileViewers'),
      customButton: int('customButton'),
      linkVisits: int('linkVisits'),
    };

    if (
      metrics.inNetworkPct !== null &&
      metrics.outOfNetworkPct !== null &&
      Math.abs(metrics.inNetworkPct + metrics.outOfNetworkPct - 100) > NETWORK_SUM_TOLERANCE
    ) {
      warn(
        'outOfNetworkPct',
        'network-sum',
        `In-network and out-of-network add up to ${metrics.inNetworkPct + metrics.outOfNetworkPct} %, not 100 %.`,
      );
    }

    const postId = await derivePostId(url);
    if (seen.has(postId)) {
      warn('postUrl', 'duplicate-post', 'Row skipped: the same post appears earlier in the file.');
      continue;
    }
    seen.add(postId);

    const title = deriveTitle(url);
    const post: ParsedPost = {
      postId,
      url,
      authorSlug: deriveAuthorSlug(url),
      title,
      titleIsHashtags: isHashtagTitle(title),
      publishDate,
      postType,
      postTypeRaw,
      metrics,
    };
    if (detection.extraColumns.length > 0) {
      post.raw = Object.fromEntries(
        detection.extraColumns.map(({ index, header }) => [header, cellText(row[index])]),
      );
    }
    posts.push(post);
  }

  if (posts.length === 0) {
    return {
      ok: false,
      error: { code: 'empty', message: 'No post in this export could be read.' },
    };
  }

  const range = rangeFromFileName(fileName);
  const latest = posts.reduce((max, p) => (p.publishDate > max ? p.publishDate : max), '');
  if (range) {
    for (const p of posts) {
      if (
        daysBetween(range.start, p.publishDate) < -RANGE_TOLERANCE_DAYS ||
        daysBetween(p.publishDate, range.end) < -RANGE_TOLERANCE_DAYS
      ) {
        warnings.push({
          code: 'outside-range',
          message: `Post dated ${p.publishDate} is outside the export range ${range.start} to ${range.end}.`,
          column: 'publishDate',
        });
      }
    }
  }

  const result: F1Result = {
    ok: true,
    format: 'F1',
    headerLanguage: detection.language,
    sheetName,
    rangeEnd: range?.end ?? latest,
    posts,
    warnings,
  };
  if (range) result.rangeStart = range.start;
  return result;
}
