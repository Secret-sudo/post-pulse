// Inputs to the analysis functions. Stored posts and freshly parsed posts both fit.

import type { Settings } from '../db/types.ts';
import type { ParsedPost } from '../import/types.ts';

export type AnalysisPost = Pick<
  ParsedPost,
  'postId' | 'url' | 'title' | 'titleIsHashtags' | 'publishDate' | 'postType' | 'metrics'
>;

export type AnalysisSettings = Pick<
  Settings,
  'breakoutMultiplier' | 'viralMultiplier' | 'includeImmature'
> &
  Partial<Pick<Settings, 'viralMode' | 'viralImpressions'>>;

export interface Dataset {
  posts: readonly AnalysisPost[];
  /** Latest export date of the whole history (SPEC §4.5). */
  latestExportDate: string;
}
