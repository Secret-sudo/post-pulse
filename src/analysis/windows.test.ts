import { makePost } from '../../tests/builders/posts.ts';
import { eligiblePosts, groupByWindow, windowBounds, windowIndex, windowLabel } from './windows.ts';

const E = '2026-10-14';

describe('rolling windows (SPEC §6.1)', () => {
  it('TC-A01 assigns dates to windows including each window’s last day', () => {
    const cases: [string, number][] = [
      ['2026-10-14', 0],
      ['2026-09-15', 0],
      ['2026-09-14', 1],
      ['2026-08-16', 1],
      ['2026-08-15', 2],
      ['2026-07-17', 2],
      ['2026-07-16', 3],
      ['2026-10-20', 0],
    ];
    for (const [date, k] of cases) expect(windowIndex(date, E), date).toBe(k);
    expect(['W3', 'W2', 'W1', 'W0'].map((_, k) => windowLabel(k))).toEqual([
      'W3',
      'W2',
      'W1',
      'W0',
    ]);
  });

  it('TC-A01 window bounds match SPEC §6.1 for the real export date', () => {
    expect(windowBounds(0, E)).toEqual({ start: '2026-09-15', end: '2026-10-14' });
    expect(windowBounds(1, E)).toEqual({ start: '2026-08-16', end: '2026-09-14' });
    expect(windowBounds(2, E)).toEqual({ start: '2026-07-17', end: '2026-08-15' });
    expect(windowBounds(0, E, 7)).toEqual({ start: '2026-10-08', end: '2026-10-14' });
  });

  it('groups posts by window, keeping empty windows in between', () => {
    const posts = [makePost({ date: '2026-10-01' }), makePost({ date: '2026-07-20' })];
    expect(groupByWindow(posts, E).map((g) => g.length)).toEqual([1, 0, 1]);
    expect(groupByWindow([], E)).toEqual([[]]);
  });

  it('TC-A10 leaves out posts younger than 7 days unless included', () => {
    const posts = [makePost({ date: '2026-10-07' }), makePost({ date: '2026-10-08' })];
    expect(eligiblePosts(posts, E, false).map((p) => p.publishDate)).toEqual(['2026-10-07']);
    expect(eligiblePosts(posts, E, true)).toHaveLength(2);
  });
});
