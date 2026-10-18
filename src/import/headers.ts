// Header mapping registry (SPEC §4.4). EN labels are confirmed against a real
// export (16 Oct 2026). DE/FR lists stay empty until real exports confirm them
// [VERIFY] — never guess LinkedIn's labels.

import type { HeaderLanguage, PostType } from './types.ts';

export const F1_FIELDS = [
  'postUrl',
  'publishDate',
  'postType',
  'impressions',
  'inNetworkPct',
  'outOfNetworkPct',
  'membersReached',
  'views',
  'watchTime',
  'avgWatchTime',
  'followersGained',
  'profileViewers',
  'reactions',
  'comments',
  'reposts',
  'saves',
  'sends',
  'customButton',
  'linkVisits',
] as const;

export type F1Field = (typeof F1_FIELDS)[number];

export const F1_REQUIRED: readonly F1Field[] = [
  'postUrl',
  'publishDate',
  'postType',
  'impressions',
];

/** Share of all F1 fields that must be matched for a sheet to count as F1. */
export const F1_MIN_MATCH_SHARE = 0.8;

type Labels = Record<HeaderLanguage, readonly string[]>;

export const F1_HEADERS: Record<F1Field, Labels> = {
  postUrl: { en: ['Post URL'], de: [], fr: [] },
  publishDate: { en: ['Post Publish Date'], de: [], fr: [] },
  postType: { en: ['Post type'], de: [], fr: [] },
  impressions: { en: ['Impressions'], de: [], fr: [] },
  inNetworkPct: { en: ['Impressions (in-network)'], de: [], fr: [] },
  outOfNetworkPct: { en: ['Impressions (out-of-network)'], de: [], fr: [] },
  membersReached: { en: ['Members reached'], de: [], fr: [] },
  views: { en: ['Views'], de: [], fr: [] },
  watchTime: { en: ['Watch time'], de: [], fr: [] },
  avgWatchTime: { en: ['Avg watch time'], de: [], fr: [] },
  followersGained: { en: ['Followers gained'], de: [], fr: [] },
  profileViewers: { en: ['Profile viewers'], de: [], fr: [] },
  reactions: { en: ['Reactions'], de: [], fr: [] },
  comments: { en: ['Comments'], de: [], fr: [] },
  reposts: { en: ['Reposts'], de: [], fr: [] },
  saves: { en: ['Saves'], de: [], fr: [] },
  sends: { en: ['Sends'], de: [], fr: [] },
  customButton: { en: ['Custom button engagements'], de: [], fr: [] },
  linkVisits: { en: ['Visits to links'], de: [], fr: [] },
};

/** Post type labels per language (SPEC §4.2). DE/FR [VERIFY]. */
export const POST_TYPE_LABELS: Record<Exclude<PostType, 'Other'>, Labels> = {
  Image: { en: ['Image'], de: [], fr: [] },
  Video: { en: ['Video'], de: [], fr: [] },
  Repost: { en: ['Repost'], de: [], fr: [] },
  Text: { en: ['Text'], de: [], fr: [] },
  Article: { en: ['Article'], de: [], fr: [] },
  Document: { en: ['Document'], de: [], fr: [] },
  Poll: { en: ['Poll'], de: [], fr: [] },
  Celebration: { en: ['Celebration'], de: [], fr: [] },
};

/**
 * Normalise a header or label for matching: NFKC, lower case, every run of
 * characters that isn't a letter or digit becomes one space (SPEC §4.4).
 */
export function normaliseLabel(label: string): string {
  return label
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const LANGUAGES: readonly HeaderLanguage[] = ['en', 'de', 'fr'];

const headerIndex = new Map<string, { field: F1Field; language: HeaderLanguage }[]>();
for (const field of F1_FIELDS) {
  for (const language of LANGUAGES) {
    for (const label of F1_HEADERS[field][language]) {
      const key = normaliseLabel(label);
      const entries = headerIndex.get(key) ?? [];
      entries.push({ field, language });
      headerIndex.set(key, entries);
    }
  }
}

/** All registry matches for one header cell (several languages may share a label). */
export function lookupHeader(header: string): { field: F1Field; language: HeaderLanguage }[] {
  return headerIndex.get(normaliseLabel(header)) ?? [];
}

const postTypeIndex = new Map<string, PostType>();
for (const [type, labels] of Object.entries(POST_TYPE_LABELS)) {
  for (const language of LANGUAGES) {
    for (const label of labels[language])
      postTypeIndex.set(normaliseLabel(label), type as PostType);
  }
}

export function lookupPostType(label: string): PostType | undefined {
  return postTypeIndex.get(normaliseLabel(label));
}
