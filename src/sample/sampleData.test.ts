// @vitest-environment node
import { freshDb } from '../../tests/builders/db.ts';
import { generateInsights } from '../insights/engine.ts';
import { DEFAULT_SETTINGS } from '../db/types.ts';
import {
  isSampleLoaded,
  loadSample,
  removeSample,
  SAMPLE_RANGE,
  samplePosts,
} from './sampleData.ts';

describe('sample data (SPEC §9.2)', () => {
  it('is deterministic and covers the 90 days before its export date', () => {
    const a = samplePosts();
    expect(samplePosts()).toEqual(a);
    expect(a.length).toBeGreaterThan(30);
    expect(
      a.every((p) => p.publishDate >= SAMPLE_RANGE.start && p.publishDate <= SAMPLE_RANGE.end),
    ).toBe(true);
    expect(new Set(a.map((p) => p.postId)).size).toBe(a.length);
  });

  it('gives the dashboard something to show', () => {
    const insights = generateInsights(
      { posts: samplePosts(), latestExportDate: SAMPLE_RANGE.end },
      DEFAULT_SETTINGS,
    );
    expect(insights.length).toBeGreaterThanOrEqual(3);
  });

  it('loads and removes cleanly', async () => {
    const db = freshDb();
    await loadSample(db);
    expect(await isSampleLoaded(db)).toBe(true);
    expect(await db.posts.count()).toBe(samplePosts().length);
    await removeSample(db);
    expect(await db.posts.count()).toBe(0);
    expect(await isSampleLoaded(db)).toBe(false);
    await db.delete();
  });
});
