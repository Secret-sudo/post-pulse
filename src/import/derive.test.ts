// @vitest-environment node
import {
  ageDays,
  deriveAuthorSlug,
  derivePostId,
  deriveTitle,
  engagementRate,
  engagements,
  isHashtagTitle,
  isMature,
} from './derive.ts';
import type { PostMetrics } from './types.ts';

const BASE = 'https://www.linkedin.com/posts/';

describe('derived fields (SPEC §4.5)', () => {
  it('TC-P07 takes the activity ID from ugcPost, share and activity URLs', async () => {
    expect(await derivePostId(`${BASE}sample_a-b-ugcPost-7400000000000000011-AbCd`)).toBe(
      '7400000000000000011',
    );
    expect(await derivePostId(`${BASE}sample_a-b-share-7400000000000000012--_zm`)).toBe(
      '7400000000000000012',
    );
    expect(await derivePostId(`${BASE}sample_a-b-activity-7400000000000000000-AbCd`)).toBe(
      '7400000000000000000',
    );
  });

  it('TC-P07 falls back to a stable SHA-1 of the normalised URL', async () => {
    const id = await derivePostId(`${BASE}sample_no-id-here`);
    expect(id).toMatch(/^h:[0-9a-f]{40}$/);
    for (const variant of [
      `${BASE}sample_no-id-here/`,
      `${BASE}sample_no-id-here?utm_source=x`,
      `${BASE}sample_no-id-here#comments`,
      `https://WWW.LINKEDIN.COM/posts/sample_no-id-here`,
    ]) {
      expect(await derivePostId(variant)).toBe(id);
    }
    expect(await derivePostId('not a url')).toMatch(/^h:[0-9a-f]{40}$/);
  });

  it('TC-P08 reads the author slug', () => {
    expect(deriveAuthorSlug(`${BASE}sample_how-we-plan-ugcPost-7400000000000000011-AbCd`)).toBe(
      'sample',
    );
    expect(
      deriveAuthorSlug('https://www.linkedin.com/feed/update/urn:li:activity:7400000000000000000'),
    ).toBe('');
  });

  it('TC-P09 builds titles from slugs', () => {
    expect(
      deriveTitle(
        `${BASE}sample_how-we-plan-a-product-launch-in-six-weeks-ugcPost-7400000000000000011-AbCd`,
      ),
    ).toBe('how we plan a product launch in six weeks');
    const bold = encodeURIComponent('𝐇𝐞𝐥𝐥𝐨-𝐖𝐨𝐫𝐥𝐝');
    expect(deriveTitle(`${BASE}sample_${bold}-share-7400000000000000013-AbCd`)).toBe('Hello World');
    const long = Array.from({ length: 20 }, () => 'abcdefghij').join('-'); // char 120 is a letter
    const title = deriveTitle(`${BASE}sample_${long}-ugcPost-7400000000000000001-AbCd`);
    expect(Array.from(title)).toHaveLength(120);
    expect(deriveTitle(`${BASE}sample_bad-%E0%A4%A-escape-ugcPost-7400000000000000002-x`)).toBe(
      'bad %E0%A4%A escape',
    );
  });

  it('TC-P09 strips only the last activity suffix', () => {
    expect(deriveTitle(`${BASE}sample_how-we-share-ideas-share-7400000000000000003-AbCd`)).toBe(
      'how we share ideas',
    );
  });

  it('TC-P10 recognises hashtag openers', () => {
    for (const t of [
      'machinelearning productivity remotework',
      'keeplearningeveryday',
      'data ai leadership',
    ]) {
      expect(isHashtagTitle(t), t).toBe(true);
    }
    for (const t of [
      'brilliant',
      'no questions',
      'the planning ritual',
      'Hello World',
      '128 gb speicher reicht nicht mehr',
      'live httpslnkdinexample',
      '',
    ]) {
      expect(isHashtagTitle(t), t).toBe(false);
    }
  });

  it('TC-P17 computes engagements, engagement rate and maturity', () => {
    const m: PostMetrics = {
      impressions: 212,
      inNetworkPct: 82,
      outOfNetworkPct: 18,
      membersReached: 115,
      views: null,
      watchTimeSec: null,
      avgWatchTimeSec: null,
      followersGained: 1,
      profileViewers: 1,
      reactions: 14,
      comments: 0,
      reposts: 0,
      saves: 1,
      sends: 0,
      customButton: 0,
      linkVisits: null,
    };
    expect(engagements(m)).toBe(15);
    expect(engagementRate(m)).toBeCloseTo(0.0708, 4);
    expect(engagementRate({ ...m, impressions: 0 })).toBe(0);
    expect(ageDays('2026-10-08', '2026-10-14')).toBe(6);
    expect(isMature('2026-10-08', '2026-10-14')).toBe(false);
    expect(isMature('2026-10-07', '2026-10-14')).toBe(true);
  });
});
