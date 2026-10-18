// TC-I01 (SPEC §11.3): every Phase 1 rule just over its threshold, just under
// it, and below its minimum sample size.
import { DEFAULT_ANALYSIS_SETTINGS, makePost, type PostSpec } from '../../tests/builders/posts.ts';
import type { AnalysisPost } from '../analysis/types.ts';
import { generateInsights } from './engine.ts';
import type { RuleId } from './types.ts';

const E = '2026-10-14';
const START = { W3: '2026-09-15', W2: '2026-08-16', W1: '2026-07-17' } as const;

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Posts spread over a window, every `step` days from its first day. */
function inWindow(
  w: keyof typeof START,
  specs: Omit<PostSpec, 'date'>[],
  step = 3,
): AnalysisPost[] {
  return specs.map((s, i) => makePost({ ...s, date: addDays(START[w], i * step) }));
}

const times = <T>(n: number, x: T): T[] => Array.from({ length: n }, () => x);

function fired(posts: AnalysisPost[], rule: RuleId, settings = DEFAULT_ANALYSIS_SETTINGS) {
  return generateInsights({ posts, latestExportDate: E }, settings).filter(
    (i) => i.ruleId === rule,
  );
}

describe('TC-I01 reach_decline', () => {
  const w2 = () => inWindow('W2', times(5, { impressions: 100 }));
  it('fires at −15 %', () => {
    const r = fired([...w2(), ...inWindow('W3', times(5, { impressions: 85 }))], 'reach_decline');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      severity: 'warning',
      title: 'Your typical post reaches fewer people: 100 → 85 (−15 %).',
    });
  });
  it('is critical at −30 %', () => {
    expect(
      fired([...w2(), ...inWindow('W3', times(5, { impressions: 70 }))], 'reach_decline')[0]
        ?.severity,
    ).toBe('critical');
  });
  it('stays quiet at −14 %', () => {
    expect(
      fired([...w2(), ...inWindow('W3', times(5, { impressions: 86 }))], 'reach_decline'),
    ).toEqual([]);
  });
  it('needs 5 posts in each window', () => {
    expect(
      fired([...w2(), ...inWindow('W3', times(4, { impressions: 50 }))], 'reach_decline'),
    ).toEqual([]);
  });
});

describe('TC-I01 resonance_holds', () => {
  // W2: ER 40 / 2000 = 2 %. W3: impressions halved, ER 23 / 1000 = 2.3 % (+15 %).
  const w2 = () => inWindow('W2', times(5, { impressions: 2000, reactions: 39, comments: 1 }));
  it('fires when reach falls and engagement rate stays within ±15 %', () => {
    const posts = [
      ...w2(),
      ...inWindow('W3', times(5, { impressions: 1000, reactions: 22, comments: 1 })),
    ];
    expect(fired(posts, 'resonance_holds')).toHaveLength(1);
  });
  it('stays quiet when engagement rate moves more than 15 %', () => {
    const posts = [
      ...w2(),
      ...inWindow('W3', times(5, { impressions: 1000, reactions: 23, comments: 1 })),
    ];
    expect(fired(posts, 'resonance_holds')).toEqual([]);
  });
  it('needs the reach decline and its sample size', () => {
    const posts = [
      ...w2(),
      ...inWindow('W3', times(4, { impressions: 1000, reactions: 22, comments: 1 })),
    ];
    expect(fired(posts, 'resonance_holds')).toEqual([]);
  });
});

describe('TC-I01 no_breakouts', () => {
  // 15 posts, median 100 → breakout ≥ 300.
  const rest = () => [
    ...inWindow('W2', times(5, { impressions: 100 })),
    ...inWindow('W3', times(5, { impressions: 100 })),
  ];
  it('fires when an earlier window had 2 breakouts', () => {
    const w1 = inWindow(
      'W1',
      [100, 100, 100, 1000, 1000].map((impressions) => ({ impressions })),
    );
    expect(fired([...w1, ...rest()], 'no_breakouts')).toHaveLength(1);
  });
  it('stays quiet when earlier windows had only 1', () => {
    const w1 = inWindow(
      'W1',
      [100, 100, 100, 100, 1000].map((impressions) => ({ impressions })),
    );
    expect(fired([...w1, ...rest()], 'no_breakouts')).toEqual([]);
  });
  it('needs 5 posts in the current window', () => {
    const w1 = inWindow(
      'W1',
      [100, 100, 100, 1000, 1000].map((impressions) => ({ impressions })),
    );
    const posts = [
      ...w1,
      ...inWindow('W2', times(5, { impressions: 100 })),
      ...inWindow('W3', times(4, { impressions: 100 })),
    ];
    expect(fired(posts, 'no_breakouts')).toEqual([]);
  });
});

describe('TC-I01 oon_driver', () => {
  // Spearman without ties: ρ = 1 − 6·Σd² / (n(n² − 1)). n = 21: Σd² = 770 → ρ = 0.5; 772 → 0.4987.
  // A swap of positions i < j adds 2(j − i)² to Σd².
  function permuted(n: number, swaps: [number, number][]): AnalysisPost[] {
    const ranks = Array.from({ length: n }, (_, i) => i);
    for (const [a, b] of swaps) [ranks[a], ranks[b]] = [ranks[b] as number, ranks[a] as number];
    return ranks.map((r, i) =>
      makePost({ date: addDays('2026-07-20', i * 3), impressions: 100 + 10 * i, oon: r * 4 }),
    );
  }
  it('fires at ρ = 0.5 with 21 posts', () => {
    expect(
      fired(
        permuted(21, [
          [0, 16],
          [1, 12],
          [13, 15],
          [17, 19],
        ]),
        'oon_driver',
      ),
    ).toHaveLength(1);
  });
  it('stays quiet just below 0.5', () => {
    expect(
      fired(
        permuted(21, [
          [0, 16],
          [1, 12],
          [17, 20],
        ]),
        'oon_driver',
      ),
    ).toEqual([]);
  });
  it('needs 20 posts', () => {
    expect(fired(permuted(19, []), 'oon_driver')).toEqual([]);
  });
});

describe('TC-I01 comment_drought', () => {
  it('fires at 50 % of posts without comments', () => {
    const posts = inWindow(
      'W3',
      [0, 0, 0, 1, 1, 1].map((comments) => ({ comments })),
    );
    expect(fired(posts, 'comment_drought')[0]?.title).toBe('50 % of recent posts got no comments.');
  });
  it('stays quiet at 40 %', () => {
    expect(
      fired(
        inWindow(
          'W3',
          [0, 0, 1, 1, 1].map((comments) => ({ comments })),
        ),
        'comment_drought',
      ),
    ).toEqual([]);
  });
  it('needs 5 posts', () => {
    expect(fired(inWindow('W3', times(4, { comments: 0 })), 'comment_drought')).toEqual([]);
  });
});

describe('TC-I01 over_posting', () => {
  it('fires above 5 posts a week, counting growing posts too', () => {
    const posts = Array.from({ length: 22 }, (_, i) =>
      makePost({ date: addDays('2026-09-20', i) }),
    );
    expect(posts.some((p) => p.publishDate > '2026-10-07')).toBe(true);
    expect(fired(posts, 'over_posting')).toHaveLength(1);
  });
  it('stays quiet at 4.9 a week on separate days', () => {
    const posts = Array.from({ length: 21 }, (_, i) =>
      makePost({ date: addDays('2026-09-20', i) }),
    );
    expect(fired(posts, 'over_posting')).toEqual([]);
  });
  it('fires with 3 days of 2+ posts, not with 2', () => {
    const days = (d: string[]) => d.map((date) => makePost({ date }));
    expect(
      fired(
        days(['2026-09-20', '2026-09-20', '2026-09-22', '2026-09-22', '2026-09-24', '2026-09-24']),
        'over_posting',
      ),
    ).toHaveLength(1);
    expect(
      fired(
        days(['2026-09-20', '2026-09-20', '2026-09-22', '2026-09-22', '2026-09-24']),
        'over_posting',
      ),
    ).toEqual([]);
  });
  it('needs 5 posts', () => {
    expect(
      fired(
        [
          makePost({ date: '2026-09-20' }),
          makePost({ date: '2026-09-20' }),
          makePost({ date: '2026-09-22' }),
          makePost({ date: '2026-09-22' }),
        ],
        'over_posting',
      ),
    ).toEqual([]);
  });
});

describe('TC-I01 weak_format and strong_format', () => {
  const images = () => inWindow('W2', times(10, { impressions: 100, type: 'Image' as const }), 2);
  const three = (type: 'Repost' | 'Video', impressions: number, n = 3) =>
    inWindow('W1', times(n, { impressions, type }));
  it('weak fires below 0.7× the overall median', () => {
    const r = fired([...images(), ...three('Repost', 69)], 'weak_format');
    expect(r.map((i) => [i.id, i.title])).toEqual([
      ['weak_format:Repost', 'Reposts reach 31 % fewer people than your typical post.'],
    ]);
    expect(r[0]?.relatedFilter).toEqual({ postTypes: ['Repost'] });
  });
  it('weak stays quiet at exactly 0.7×', () => {
    expect(fired([...images(), ...three('Repost', 70)], 'weak_format')).toEqual([]);
  });
  it('weak needs 3 posts of the type', () => {
    expect(fired([...images(), ...three('Repost', 10, 2)], 'weak_format')).toEqual([]);
  });
  it('strong fires above 1.3×', () => {
    expect(
      fired([...images(), ...three('Video', 131)], 'strong_format').map((i) => i.severity),
    ).toEqual(['positive']);
  });
  it('strong stays quiet at exactly 1.3×', () => {
    expect(fired([...images(), ...three('Video', 130)], 'strong_format')).toEqual([]);
  });
  it('strong needs 3 posts of the type', () => {
    expect(fired([...images(), ...three('Video', 1000, 2)], 'strong_format')).toEqual([]);
  });
});

describe('TC-I01 concentration', () => {
  const nine = () => inWindow('W2', times(9, { impressions: 100 }));
  it('fires when one post has more than half of all impressions', () => {
    expect(
      fired([...nine(), makePost({ date: '2026-07-20', impressions: 901 })], 'concentration'),
    ).toHaveLength(1);
  });
  it('stays quiet at exactly half', () => {
    expect(
      fired([...nine(), makePost({ date: '2026-07-20', impressions: 900 })], 'concentration'),
    ).toEqual([]);
  });
  it('needs 10 posts', () => {
    const posts = [
      ...inWindow('W2', times(8, { impressions: 100 })),
      makePost({ date: '2026-07-20', impressions: 10000 }),
    ];
    expect(fired(posts, 'concentration')).toEqual([]);
  });
});

describe('TC-I01 hashtag_opener', () => {
  const others = () => inWindow('W2', times(10, { impressions: 100 }), 2);
  const tags = (impressions: number, n = 3) =>
    inWindow('W1', times(n, { impressions, hashtags: true }));
  it('fires below 0.8× the overall median', () => {
    expect(fired([...others(), ...tags(79)], 'hashtag_opener')).toHaveLength(1);
  });
  it('stays quiet at exactly 0.8×', () => {
    expect(fired([...others(), ...tags(80)], 'hashtag_opener')).toEqual([]);
  });
  it('needs 3 hashtag posts', () => {
    expect(fired([...others(), ...tags(10, 2)], 'hashtag_opener')).toEqual([]);
  });
});

describe('TC-I01 growing_posts', () => {
  const mature = () => inWindow('W3', times(5, {}));
  it('fires while growing posts are left out', () => {
    const r = fired([...mature(), makePost({ date: '2026-10-10' })], 'growing_posts');
    expect(r[0]?.title).toBe(
      '1 post is still collecting impressions and is excluded from comparisons.',
    );
  });
  it('stays quiet without growing posts', () => {
    expect(fired(mature(), 'growing_posts')).toEqual([]);
  });
  it('stays quiet when growing posts are included', () => {
    const posts = [...mature(), makePost({ date: '2026-10-10' })];
    expect(
      fired(posts, 'growing_posts', { ...DEFAULT_ANALYSIS_SETTINGS, includeImmature: true }),
    ).toEqual([]);
  });
});

// Rules added on 17 Oct 2026 (SPEC §7 "More rules"). Thresholds hand-picked at the edges.
describe('TC-I01 reach_growth', () => {
  const w2 = () => inWindow('W2', times(5, { impressions: 100 }));
  it('fires at +15 %', () => {
    const r = fired([...w2(), ...inWindow('W3', times(5, { impressions: 115 }))], 'reach_growth');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      severity: 'positive',
      title: 'Your typical post reaches more people: 100 → 115 (+15 %).',
      effectSize: 0.15,
    });
  });
  it('stays quiet at +14 %', () => {
    expect(
      fired([...w2(), ...inWindow('W3', times(5, { impressions: 114 }))], 'reach_growth'),
    ).toEqual([]);
  });
  it('needs 5 posts in each window', () => {
    expect(
      fired([...w2(), ...inWindow('W3', times(4, { impressions: 200 }))], 'reach_growth'),
    ).toEqual([]);
  });
});

describe('TC-I01 engagement_shift', () => {
  // W2: ER 200 / 10,000 = 2 %.
  const w2 = () => inWindow('W2', times(5, { impressions: 10000, reactions: 199, comments: 1 }));
  const w3 = (reactions: number, n = 5) =>
    inWindow('W3', times(n, { impressions: 10000, reactions, comments: 1 }));
  it('is positive at +20 %', () => {
    expect(fired([...w2(), ...w3(239)], 'engagement_shift')[0]).toMatchObject({
      severity: 'positive',
      title: 'People engage more with your posts: 2.0 % → 2.4 % (+20 %).',
    });
  });
  it('is a warning at −20 %', () => {
    expect(fired([...w2(), ...w3(159)], 'engagement_shift')[0]).toMatchObject({
      severity: 'warning',
      title: 'Fewer people react to what they see: 2.0 % → 1.6 % (−20 %).',
    });
  });
  it('stays quiet at +19 %', () => {
    expect(fired([...w2(), ...w3(237)], 'engagement_shift')).toEqual([]);
  });
  it('needs 5 posts in each window', () => {
    expect(fired([...w2(), ...w3(299, 4)], 'engagement_shift')).toEqual([]);
  });
});

describe('TC-I01 oon_shift', () => {
  const w2 = () => inWindow('W2', times(5, { oon: 30 }));
  it('is positive at +10 percentage points', () => {
    expect(
      fired([...w2(), ...inWindow('W3', times(5, { oon: 40 }))], 'oon_shift')[0],
    ).toMatchObject({
      severity: 'positive',
      title: 'More of your impressions come from outside your network: 30 % → 40 %.',
      effectSize: 0.1,
    });
  });
  it('is a warning at −10 points', () => {
    expect(
      fired([...w2(), ...inWindow('W3', times(5, { oon: 20 }))], 'oon_shift')[0]?.severity,
    ).toBe('warning');
  });
  it('stays quiet at +9 points', () => {
    expect(fired([...w2(), ...inWindow('W3', times(5, { oon: 39 }))], 'oon_shift')).toEqual([]);
  });
  it('needs 5 posts in each window', () => {
    expect(fired([...w2(), ...inWindow('W3', times(4, { oon: 60 }))], 'oon_shift')).toEqual([]);
  });
});

describe('TC-I01 breakout_run', () => {
  // Median 100 over the history, so breakouts start at 300.
  it('fires with 2 breakouts after 1', () => {
    const posts = [
      ...inWindow('W2', [...times(9, { impressions: 100 }), { impressions: 400 }]),
      ...inWindow('W3', [...times(3, { impressions: 100 }), ...times(2, { impressions: 400 })]),
    ];
    expect(fired(posts, 'breakout_run')[0]).toMatchObject({
      severity: 'positive',
      title: '2 breakout posts in the last 30 days (1 in the 30 before).',
      effectSize: 0.5,
    });
  });
  it('stays quiet when there were as many before', () => {
    const posts = [
      ...inWindow('W2', [...times(8, { impressions: 100 }), ...times(2, { impressions: 400 })]),
      ...inWindow('W3', [...times(3, { impressions: 100 }), ...times(2, { impressions: 400 })]),
    ];
    expect(fired(posts, 'breakout_run')).toEqual([]);
  });
  it('needs 5 posts in the current window', () => {
    const posts = [
      ...inWindow('W2', times(10, { impressions: 100 })),
      ...inWindow('W3', [...times(2, { impressions: 100 }), ...times(2, { impressions: 400 })]),
    ];
    expect(fired(posts, 'breakout_run')).toEqual([]);
  });
});

describe('TC-I01 same_day_split', () => {
  const singles = () =>
    ['2026-09-01', '2026-09-03', '2026-09-05'].map((date) => makePost({ date, impressions: 100 }));
  const doubles = (impressions: number, days = ['2026-09-10', '2026-09-12']) =>
    days.flatMap((date) => [makePost({ date, impressions }), makePost({ date, impressions })]);
  it('fires below 0.8× the posts alone on their day', () => {
    expect(fired([...singles(), ...doubles(79)], 'same_day_split')[0]).toMatchObject({
      severity: 'warning',
      title: 'Posts that share a day with another post reach 21 % fewer people.',
      effectSize: 0.21,
    });
  });
  it('stays quiet at exactly 0.8×', () => {
    expect(fired([...singles(), ...doubles(80)], 'same_day_split')).toEqual([]);
  });
  it('needs 3 posts that share a day', () => {
    expect(fired([...singles(), ...doubles(10, ['2026-09-10'])], 'same_day_split')).toEqual([]);
  });
});

describe('TC-I01 cadence_drop', () => {
  it('fires at half as many posts as the window before, growing ones included', () => {
    const posts = [
      ...inWindow('W2', times(4, {})),
      makePost({ date: '2026-09-20' }),
      makePost({ date: '2026-10-12' }),
    ];
    expect(fired(posts, 'cadence_drop')[0]).toMatchObject({
      severity: 'info',
      title: 'You posted less: 2 posts in the last 30 days vs 4 in the 30 before.',
      effectSize: 0.5,
    });
  });
  it('stays quiet at three quarters', () => {
    expect(
      fired([...inWindow('W2', times(4, {})), ...inWindow('W3', times(3, {}))], 'cadence_drop'),
    ).toEqual([]);
  });
  it('needs 4 posts in the window before', () => {
    expect(fired(inWindow('W2', times(3, {})), 'cadence_drop')).toEqual([]);
  });
});

describe('TC-I01 follower_drivers', () => {
  const withFollowers = (counts: number[]) =>
    inWindow(
      'W2',
      counts.map((followersGained) => ({ metrics: { followersGained } })),
      2,
    );
  it('fires when 3 posts bring 60 % of followers', () => {
    expect(
      fired(withFollowers([2, 2, 2, 1, 1, 1, 1, 0, 0, 0]), 'follower_drivers')[0],
    ).toMatchObject({
      severity: 'info',
      title: '3 posts brought 60 % of the followers your posts gained.',
      effectSize: 0.6,
    });
  });
  it('fires at exactly half', () => {
    expect(fired(withFollowers([2, 2, 1, 1, 1, 1, 1, 1, 0, 0]), 'follower_drivers')).toHaveLength(
      1,
    );
  });
  it('stays quiet when followers are spread out', () => {
    expect(fired(withFollowers(times(10, 1)), 'follower_drivers')).toEqual([]);
  });
  it('needs 10 followers and 10 posts', () => {
    expect(fired(withFollowers([3, 3, 3, 0, 0, 0, 0, 0, 0, 0]), 'follower_drivers')).toEqual([]);
    expect(fired(withFollowers([5, 5, 5, 0, 0, 0, 0, 0, 0]), 'follower_drivers')).toEqual([]);
  });
});
