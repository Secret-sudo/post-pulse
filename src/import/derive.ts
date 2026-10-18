// Fields derived from a post's URL and metrics (SPEC §4.5).

import { STOP_WORDS } from '../topics/stopwords.ts';
import { daysBetween } from './normalise.ts';
import type { PostMetrics } from './types.ts';

const ACTIVITY_ID = /(?:ugcPost|share|activity)-(\d{15,25})/;
const ACTIVITY_SUFFIX = /-(?:ugcPost|share|activity)-(?!.*-(?:ugcPost|share|activity)-).*$/;
const TITLE_MAX = 120;

/** Activity ID from the URL, or `h:` + SHA-1 of the normalised URL. The merge key. */
export async function derivePostId(url: string): Promise<string> {
  const id = ACTIVITY_ID.exec(url)?.[1];
  if (id) return id;
  const bytes = new TextEncoder().encode(normaliseUrl(url));
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return `h:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Lower-case host, no query, no fragment, no trailing slash. */
export function normaliseUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url
      .trim()
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '');
  }
}

function postsSlug(url: string): string {
  const path = url.replace(/[?#].*$/, '');
  const i = path.indexOf('/posts/');
  return i === -1 ? '' : path.slice(i + '/posts/'.length).replace(/\/+$/, '');
}

/** Text between `/posts/` and the first `_` (SPEC §4.5). */
export function deriveAuthorSlug(url: string): string {
  const slug = postsSlug(url);
  const i = slug.indexOf('_');
  return i === -1 ? '' : slug.slice(0, i);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Best-effort title from the URL slug (SPEC §4.5). */
export function deriveTitle(url: string): string {
  const slug = postsSlug(url);
  const i = slug.indexOf('_');
  const body = i === -1 ? slug : slug.slice(i + 1);
  const text = safeDecode(body)
    .normalize('NFKC')
    .replace(ACTIVITY_SUFFIX, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(text).slice(0, TITLE_MAX).join('').trimEnd();
}

/** True when the title most likely is a run of hashtags (SPEC §4.5). */
export function isHashtagTitle(title: string): boolean {
  const tokens = title.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.some((t) => STOP_WORDS.has(t) || /\d/.test(t) || t.startsWith('http'))) return false;
  return tokens.length >= 3 || tokens.some((t) => Array.from(t).length >= 12);
}

export function engagements(m: PostMetrics): number {
  return m.reactions + m.comments + m.reposts + m.saves + m.sends;
}

export function engagementRate(m: PostMetrics): number {
  return m.impressions === 0 ? 0 : engagements(m) / m.impressions;
}

export const MATURE_AFTER_DAYS = 7;

export function ageDays(publishDate: string, asOf: string): number {
  return daysBetween(publishDate, asOf);
}

export function isMature(publishDate: string, asOf: string): boolean {
  return ageDays(publishDate, asOf) >= MATURE_AFTER_DAYS;
}
