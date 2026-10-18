// In-memory posts for analysis and insight tests. Values are made up.
import type { AnalysisPost, AnalysisSettings } from '../../src/analysis/types.ts';
import type { PostMetrics, PostType } from '../../src/import/types.ts';

let seq = 0;

export interface PostSpec {
  date: string;
  impressions?: number;
  type?: PostType;
  comments?: number;
  reactions?: number;
  oon?: number | null;
  reach?: number | null;
  hashtags?: boolean;
  metrics?: Partial<PostMetrics>;
  id?: string;
}

export function makePost(spec: PostSpec): AnalysisPost {
  seq += 1;
  const id = spec.id ?? String(7500000000000000000n + BigInt(seq));
  const impressions = spec.impressions ?? 100;
  const oon = spec.oon === undefined ? 30 : spec.oon;
  return {
    postId: id,
    url: `https://www.linkedin.com/posts/sample_post-${seq}-ugcPost-${id}-Test`,
    title: `post ${seq}`,
    titleIsHashtags: spec.hashtags ?? false,
    publishDate: spec.date,
    postType: spec.type ?? 'Image',
    metrics: {
      impressions,
      inNetworkPct: oon === null ? null : 100 - oon,
      outOfNetworkPct: oon,
      membersReached: spec.reach === undefined ? Math.round(impressions * 0.6) : spec.reach,
      views: null,
      watchTimeSec: null,
      avgWatchTimeSec: null,
      followersGained: 0,
      profileViewers: 0,
      reactions: spec.reactions ?? 2,
      comments: spec.comments ?? 1,
      reposts: 0,
      saves: 0,
      sends: 0,
      customButton: 0,
      linkVisits: null,
      ...spec.metrics,
    },
  };
}

export const DEFAULT_ANALYSIS_SETTINGS: Readonly<AnalysisSettings> = {
  breakoutMultiplier: 3,
  viralMultiplier: 10,
  includeImmature: false,
};
