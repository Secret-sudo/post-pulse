// Stored records (SPEC §5).

import type { HeaderLanguage, PostMetrics, PostType } from '../import/types.ts';

export interface Post {
  postId: string;
  url: string;
  authorSlug: string;
  title: string;
  titleIsHashtags: boolean;
  publishDate: string;
  postType: PostType;
  postTypeRaw: string;
  metrics: PostMetrics;
  /** Export end date of the snapshot `metrics` come from. */
  metricsAsOf: string;
  topics: string[];
  raw?: Record<string, string>;
  language?: 'en' | 'de' | 'fr' | 'other';
}

export interface Snapshot {
  postId: string;
  importId: string;
  asOf: string;
  metrics: PostMetrics;
}

export interface ImportRecord {
  importId: string;
  fileName: string;
  /** SHA-256 (hex) of the file bytes. */
  fileHash: string;
  format: 'F1' | 'F2';
  headerLanguage: HeaderLanguage;
  importedAt: string;
  rangeStart?: string;
  rangeEnd: string;
  postsNew: number;
  postsUpdated: number;
  postsUnchanged: number;
  warnings: string[];
}

export interface Topic {
  id: string;
  name: string;
  color: string;
  keywords: string[];
  manualPostIds: string[];
}

export interface Settings {
  locale: string;
  theme: 'system' | 'light' | 'dark';
  breakoutMultiplier: number;
  viralMultiplier: number;
  /** 'multiplier': viral = viralMultiplier × your median; 'impressions': a fixed number (SPEC §6.2). */
  viralMode: 'multiplier' | 'impressions';
  viralImpressions: number;
  includeImmature: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  locale: 'en',
  theme: 'system',
  breakoutMultiplier: 3,
  viralMultiplier: 10,
  viralMode: 'multiplier',
  /** About the top 5 % of personal LinkedIn posts (SPEC §6.2 source note). */
  viralImpressions: 15_000,
  includeImmature: false,
};

/** Settings are stored as a single row under this key. */
export const SETTINGS_KEY = 'app';

export interface SettingsRow extends Settings {
  key: typeof SETTINGS_KEY;
}
