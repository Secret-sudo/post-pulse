// The view and its filters live in the query string, so every view has a
// shareable link (SPEC §9.3). Only view settings go in: never post data.

import { WINDOW_SIZES, type WindowSize } from '../analysis/constants.ts';
import { DEFAULT_FILTERS, type Filters } from '../analysis/filters.ts';
import { COLUMNS, DEFAULT_SORT, type ColumnId, type Sort } from '../features/posts/table.ts';
import { METRICS, type TimelineMetric } from '../features/timeline/timeline.ts';
import { PERIODS, type Period } from '../analysis/breakdowns.ts';
import { POST_TYPES, type PostType } from '../import/types.ts';

export const VIEWS = ['overview', 'timeline', 'breakdowns', 'posts', 'settings'] as const;
export type View = (typeof VIEWS)[number];

export interface TableState {
  query: string;
  sort: Sort;
}

export interface ChartState {
  metric: TimelineMetric;
  log: boolean;
  /** Posting rhythm grouped by day, week or month. */
  period: Period;
}

export interface AppUrlState {
  view: View;
  filters: Filters;
  table: TableState;
  chart: ChartState;
}

export const DEFAULT_TABLE: TableState = { query: '', sort: DEFAULT_SORT };
export const DEFAULT_CHART: ChartState = { metric: 'impressions', log: true, period: 'week' };

export const DEFAULT_URL_STATE: AppUrlState = {
  view: 'overview',
  filters: { ...DEFAULT_FILTERS },
  table: { ...DEFAULT_TABLE },
  chart: { ...DEFAULT_CHART },
};

const MAX_QUERY = 100;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseUrl(search: string): AppUrlState {
  const q = new URLSearchParams(search);
  const view = (VIEWS as readonly string[]).includes(q.get('view') ?? '')
    ? (q.get('view') as View)
    : 'overview';
  const w = Number(q.get('w'));
  const sizeParam = q.get('size');
  const size =
    WINDOW_SIZES.find((s) => String(s) === sizeParam) ?? (DEFAULT_FILTERS.size as WindowSize);
  const types = (q.get('types') ?? '')
    .split(',')
    .filter((t): t is PostType => (POST_TYPES as readonly string[]).includes(t));
  const date = (key: string) => {
    const v = q.get(key);
    return v && ISO.test(v) ? v : null;
  };
  return {
    view,
    filters: {
      size,
      window: size !== 'all' && Number.isInteger(w) && w >= 0 && w < 1000 ? w : 0,
      postTypes: [...new Set(types)],
      includeImmature: q.get('growing') === '1' ? true : q.get('growing') === '0' ? false : null,
      hashtagOpeners: q.get('hashtags') === '1',
      from: date('from'),
      to: date('to'),
    },
    table: {
      query: (q.get('q') ?? '').slice(0, MAX_QUERY),
      sort: {
        column: (COLUMNS as readonly string[]).includes(q.get('sort') ?? '')
          ? (q.get('sort') as ColumnId)
          : DEFAULT_SORT.column,
        desc: q.has('sort') ? q.get('dir') !== 'asc' : DEFAULT_SORT.desc,
      },
    },
    chart: {
      metric: (METRICS as readonly string[]).includes(q.get('metric') ?? '')
        ? (q.get('metric') as TimelineMetric)
        : DEFAULT_CHART.metric,
      log: q.get('scale') !== 'linear',
      period: PERIODS.find((p) => p === q.get('period')) ?? DEFAULT_CHART.period,
    },
  };
}

/** Query string for a state; defaults are left out so links stay short. */
export function toSearch(state: AppUrlState): string {
  const q = new URLSearchParams();
  const f = state.filters;
  if (state.view !== 'overview') q.set('view', state.view);
  if (f.size !== DEFAULT_FILTERS.size) q.set('size', String(f.size));
  if (f.window !== 0 && f.size !== 'all') q.set('w', String(f.window));
  if (f.postTypes.length > 0) q.set('types', f.postTypes.join(','));
  if (f.includeImmature !== null) q.set('growing', f.includeImmature ? '1' : '0');
  if (f.hashtagOpeners) q.set('hashtags', '1');
  if (f.from) q.set('from', f.from);
  if (f.to) q.set('to', f.to);
  const tbl = state.table;
  if (tbl.query) q.set('q', tbl.query.slice(0, MAX_QUERY));
  if (tbl.sort.column !== DEFAULT_SORT.column || tbl.sort.desc !== DEFAULT_SORT.desc) {
    q.set('sort', tbl.sort.column);
    q.set('dir', tbl.sort.desc ? 'desc' : 'asc');
  }
  if (state.chart.metric !== DEFAULT_CHART.metric) q.set('metric', state.chart.metric);
  if (!state.chart.log) q.set('scale', 'linear');
  if (state.chart.period !== DEFAULT_CHART.period) q.set('period', state.chart.period);
  const s = q.toString();
  return s ? `?${s}` : '';
}
