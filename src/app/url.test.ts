import { DEFAULT_FILTERS } from '../analysis/filters.ts';
import {
  DEFAULT_CHART,
  DEFAULT_TABLE,
  DEFAULT_URL_STATE,
  parseUrl,
  toSearch,
  type AppUrlState,
} from './url.ts';

describe('view state in the URL (SPEC §9.3)', () => {
  it('round-trips every filter and the table state', () => {
    const state: AppUrlState = {
      view: 'breakdowns',
      filters: {
        size: 90,
        window: 2,
        postTypes: ['Repost', 'Video'],
        includeImmature: true,
        hashtagOpeners: true,
        from: '2026-08-01',
        to: '2026-09-30',
      },
      table: { query: 'ai banking', sort: { column: 'impressions', desc: false } },
      chart: { metric: 'reach', log: false, period: 'month' },
    };
    const search = toSearch(state);
    expect(search).toBe(
      '?view=breakdowns&size=90&w=2&types=Repost%2CVideo&growing=1&hashtags=1&from=2026-08-01&to=2026-09-30&q=ai+banking&sort=impressions&dir=asc&metric=reach&scale=linear&period=month',
    );
    expect(parseUrl(search)).toEqual(state);
  });

  it('leaves defaults out of the URL', () => {
    expect(toSearch(DEFAULT_URL_STATE)).toBe('');
    expect(parseUrl('')).toEqual({
      view: 'overview',
      filters: DEFAULT_FILTERS,
      table: DEFAULT_TABLE,
      chart: DEFAULT_CHART,
    });
    expect(parseUrl('?metric=salary').chart).toEqual(DEFAULT_CHART);
    expect(toSearch({ ...DEFAULT_URL_STATE, view: 'posts' })).toBe('?view=posts');
  });

  it('ignores invalid or unknown values instead of failing', () => {
    expect(
      parseUrl(
        '?view=admin&w=-3&types=Image,Hack,Image&growing=yes&from=yesterday&to=2026-13&sort=password',
      ),
    ).toEqual({
      view: 'overview',
      filters: { ...DEFAULT_FILTERS, postTypes: ['Image'] },
      table: DEFAULT_TABLE,
      chart: DEFAULT_CHART,
    });
    expect(parseUrl('?metric=salary').chart).toEqual(DEFAULT_CHART);
    expect(parseUrl('?w=1.5').filters.window).toBe(0);
    expect(parseUrl('?size=14').filters.size).toBe(30);
    expect(parseUrl('?period=year').chart.period).toBe('week');
    // The Insights tab is gone; old links land on the overview.
    expect(parseUrl('?view=insights').view).toBe('overview');
    // All time has a single window.
    expect(parseUrl('?size=all&w=3').filters).toMatchObject({ size: 'all', window: 0 });
    expect(toSearch({ ...DEFAULT_URL_STATE, filters: { ...DEFAULT_FILTERS, size: 'all' } })).toBe(
      '?size=all',
    );
    expect(parseUrl(`?q=${'x'.repeat(500)}`).table.query).toHaveLength(100);
    expect(parseUrl('?sort=comments').table.sort).toEqual({ column: 'comments', desc: true });
  });
});
