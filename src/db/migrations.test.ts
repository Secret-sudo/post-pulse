// @vitest-environment node
import 'fake-indexeddb/auto';
import { MIGRATIONS, type Migration } from './migrations.ts';
import { createDb } from './schema.ts';
import type { Post } from './types.ts';

describe('schema migrations (SPEC §5)', () => {
  it('TC-M07 a v2 migration keeps v1 data and defaults the new field', async () => {
    const name = `migration-${Math.random().toString(36).slice(2)}`;
    const v1 = createDb(name, MIGRATIONS);
    const post = {
      postId: '7400000000000004000',
      url: 'https://www.linkedin.com/posts/sample_x-ugcPost-7400000000000004000-AbCd',
      authorSlug: 'sample',
      title: 'x',
      titleIsHashtags: false,
      publishDate: '2026-10-01',
      postType: 'Image',
      postTypeRaw: 'Image',
      metrics: {
        impressions: 1,
        inNetworkPct: null,
        outOfNetworkPct: null,
        membersReached: null,
        views: null,
        watchTimeSec: null,
        avgWatchTimeSec: null,
        followersGained: null,
        profileViewers: null,
        reactions: 0,
        comments: 0,
        reposts: 0,
        saves: 0,
        sends: 0,
        customButton: null,
        linkVisits: null,
      },
      metricsAsOf: '2026-10-14',
      topics: [],
    } satisfies Post;
    await v1.posts.add(post);
    v1.close();

    const testV2: Migration = {
      version: 2,
      stores: { posts: 'postId, publishDate, authorSlug, postType, language' },
      upgrade: (tx) =>
        tx
          .table('posts')
          .toCollection()
          .modify((p: Post) => {
            p.language = 'other';
          }),
    };
    const v2 = createDb(name, [...MIGRATIONS, testV2]);
    expect(await v2.posts.get(post.postId)).toEqual({ ...post, language: 'other' });
    expect(await v2.posts.where('language').equals('other').count()).toBe(1);
    expect(v2.verno).toBe(2);
    await v2.delete();
  });

  it('versions are strictly increasing', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
  });
});
