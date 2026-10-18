// Posts table model (SPEC §9.2 screen 6): rows with derived values, search,
// sort and CSV export. Pure, so it's tested without a browser.

import { thresholds } from '../../analysis/metrics.ts';
import type { AnalysisPost, AnalysisSettings } from '../../analysis/types.ts';
import { eligiblePosts } from '../../analysis/windows.ts';
import { engagementRate, isMature } from '../../import/derive.ts';

export type PostStatus = 'growing' | 'viral' | 'breakout' | null;

export interface PostRow {
  post: AnalysisPost;
  engagementRate: number;
  status: PostStatus;
}

export const COLUMNS = [
  'date',
  'type',
  'title',
  'impressions',
  'outOfNetwork',
  'reactions',
  'comments',
  'reposts',
  'saves',
  'engagementRate',
  'status',
] as const;
export type ColumnId = (typeof COLUMNS)[number];

export const NUMERIC: ReadonlySet<ColumnId> = new Set([
  'impressions',
  'outOfNetwork',
  'reactions',
  'comments',
  'reposts',
  'saves',
  'engagementRate',
]);

export interface Sort {
  column: ColumnId;
  desc: boolean;
}

export const DEFAULT_SORT: Sort = { column: 'date', desc: true };

/** Rows for every post. Breakout/viral use the personal median over the full, unfiltered history (SPEC §6.2). */
export function buildRows(
  posts: readonly AnalysisPost[],
  allPosts: readonly AnalysisPost[],
  latestExportDate: string,
  settings: AnalysisSettings,
): PostRow[] {
  const t = thresholds(
    eligiblePosts(allPosts, latestExportDate, settings.includeImmature),
    settings,
  );
  return posts.map((post) => {
    const imp = post.metrics.impressions;
    const status: PostStatus = !isMature(post.publishDate, latestExportDate)
      ? 'growing'
      : t.viral !== null && imp >= t.viral
        ? 'viral'
        : t.breakout !== null && imp >= t.breakout
          ? 'breakout'
          : null;
    return { post, engagementRate: engagementRate(post.metrics), status };
  });
}

/** Case- and accent-insensitive search in titles and post types. */
export function searchRows(rows: readonly PostRow[], query: string): PostRow[] {
  const norm = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...rows];
  return rows.filter((r) => {
    const hay = norm(`${r.post.title} ${r.post.postType}`);
    return terms.every((t) => hay.includes(t));
  });
}

const STATUS_RANK: Record<NonNullable<PostStatus> | 'none', number> = {
  viral: 3,
  breakout: 2,
  growing: 1,
  none: 0,
};

function sortValue(r: PostRow, c: ColumnId): number | string {
  const m = r.post.metrics;
  switch (c) {
    case 'date':
      return r.post.publishDate;
    case 'type':
      return r.post.postType;
    case 'title':
      return r.post.title.toLowerCase();
    case 'impressions':
      return m.impressions;
    case 'outOfNetwork':
      return m.outOfNetworkPct ?? -1;
    case 'reactions':
      return m.reactions;
    case 'comments':
      return m.comments;
    case 'reposts':
      return m.reposts;
    case 'saves':
      return m.saves;
    case 'engagementRate':
      return r.engagementRate;
    case 'status':
      return STATUS_RANK[r.status ?? 'none'];
  }
}

/** Stable sort; ties keep newest first. */
export function sortRows(rows: readonly PostRow[], sort: Sort): PostRow[] {
  const dir = sort.desc ? -1 : 1;
  return rows
    .map((r, i) => ({ r, i, v: sortValue(r, sort.column) }))
    .sort((a, b) => {
      if (a.v < b.v) return -dir;
      if (a.v > b.v) return dir;
      if (a.r.post.publishDate !== b.r.post.publishDate)
        return a.r.post.publishDate < b.r.post.publishDate ? 1 : -1;
      return a.i - b.i;
    })
    .map((x) => x.r);
}

const CSV_HEADERS: Record<ColumnId, string> = {
  date: 'Publish date',
  type: 'Post type',
  title: 'Title',
  impressions: 'Impressions',
  outOfNetwork: 'Outside network %',
  reactions: 'Reactions',
  comments: 'Comments',
  reposts: 'Reposts',
  saves: 'Saves',
  engagementRate: 'Engagement rate %',
  status: 'Status',
};

/**
 * One CSV field. Quotes when needed, and neutralises spreadsheet formulas
 * (`=`, `+`, `-`, `@`, tab, CR at the start) so an export opened in Excel
 * can't run anything (CSV injection).
 */
export function csvField(value: string | number | null): string {
  if (value === null) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvValue(r: PostRow, c: ColumnId): string | number | null {
  const m = r.post.metrics;
  switch (c) {
    case 'date':
      return r.post.publishDate;
    case 'type':
      return r.post.postType;
    case 'title':
      return r.post.title;
    case 'impressions':
      return m.impressions;
    case 'outOfNetwork':
      return m.outOfNetworkPct;
    case 'reactions':
      return m.reactions;
    case 'comments':
      return m.comments;
    case 'reposts':
      return m.reposts;
    case 'saves':
      return m.saves;
    case 'engagementRate':
      return Math.round(r.engagementRate * 10000) / 100;
    case 'status':
      return r.status ?? '';
  }
}

/** The current view as CSV: the visible columns plus the post URL. */
export function toCsv(rows: readonly PostRow[]): string {
  const header = [...COLUMNS.map((c) => CSV_HEADERS[c]), 'Post URL'].map(csvField).join(',');
  const lines = rows.map((r) =>
    [...COLUMNS.map((c) => csvValue(r, c)), r.post.url].map(csvField).join(','),
  );
  return `${[header, ...lines].join('\r\n')}\r\n`;
}

export function csvFileName(date: Date): string {
  return `postpulse-posts-${date.toISOString().slice(0, 10)}.csv`;
}
