// View filters (SPEC §9.3). They live in the URL; insights point at them.

import type { PostType } from '../import/types.ts';
import type { WindowSize } from './constants.ts';
import type { AnalysisPost } from './types.ts';

export interface Filters {
  /** Window length in days, or one window over the whole history (SPEC §6.1). */
  size: WindowSize;
  /** Window index, 0 = most recent. */
  window: number;
  postTypes: PostType[];
  /** null = use the "include growing posts" default from Settings. */
  includeImmature: boolean | null;
  /** Show only posts that open with hashtags. */
  hashtagOpeners: boolean;
  /** Custom range, inclusive YYYY-MM-DD. */
  from: string | null;
  to: string | null;
}

export const DEFAULT_FILTERS: Readonly<Filters> = {
  size: 30,
  window: 0,
  postTypes: [],
  includeImmature: null,
  hashtagOpeners: false,
  from: null,
  to: null,
};

/** Posts that pass the type, hashtag and date filters. Window and maturity are applied by the analysis. */
export function applyFilters<T extends AnalysisPost>(posts: readonly T[], f: Filters): T[] {
  return posts.filter(
    (p) =>
      (f.postTypes.length === 0 || f.postTypes.includes(p.postType)) &&
      (!f.hashtagOpeners || p.titleIsHashtags) &&
      (f.from === null || p.publishDate >= f.from) &&
      (f.to === null || p.publishDate <= f.to),
  );
}

export function isFiltered(f: Filters): boolean {
  return f.postTypes.length > 0 || f.hashtagOpeners || f.from !== null || f.to !== null;
}
