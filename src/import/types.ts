// Shapes produced by the importer (SPEC §4, §5). Storage types build on these.

export const POST_TYPES = [
  'Image',
  'Video',
  'Repost',
  'Text',
  'Article',
  'Document',
  'Poll',
  'Celebration',
  'Other',
] as const;

export type PostType = (typeof POST_TYPES)[number];

export type HeaderLanguage = 'en' | 'de' | 'fr';

export interface PostMetrics {
  impressions: number;
  inNetworkPct: number | null;
  outOfNetworkPct: number | null;
  membersReached: number | null;
  views: number | null;
  watchTimeSec: number | null;
  avgWatchTimeSec: number | null;
  followersGained: number | null;
  profileViewers: number | null;
  reactions: number;
  comments: number;
  reposts: number;
  saves: number;
  sends: number;
  customButton: number | null;
  linkVisits: number | null;
}

export interface ParsedPost {
  postId: string;
  url: string;
  authorSlug: string;
  title: string;
  titleIsHashtags: boolean;
  publishDate: string; // YYYY-MM-DD
  postType: PostType;
  postTypeRaw: string;
  metrics: PostMetrics;
  raw?: Record<string, string>;
}

/** A non-fatal problem. `row` is the 1-based spreadsheet row (row 1 = headers). */
export interface ParseWarning {
  code: string;
  message: string;
  row?: number;
  column?: string;
}

export type ImportErrorCode =
  | 'unsupported-type'
  | 'macro-enabled'
  | 'csv-not-supported'
  | 'too-large'
  | 'password-protected'
  | 'not-xlsx'
  | 'unknown-headers'
  | 'empty';

export interface ImportError {
  code: ImportErrorCode;
  message: string;
  /** Header labels found in the first sheet, for "Copy details" (SPEC §4.4). */
  headersFound?: string[];
}

export interface F1Result {
  ok: true;
  format: 'F1';
  headerLanguage: HeaderLanguage;
  sheetName: string;
  rangeStart?: string;
  rangeEnd: string;
  posts: ParsedPost[];
  warnings: ParseWarning[];
}

export type ImportResult = F1Result | { ok: false; error: ImportError };

/** A raw spreadsheet cell as delivered by the workbook reader. */
export type Cell = string | number | boolean | Date | null | undefined;
