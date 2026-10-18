import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Filters } from '../analysis/filters.ts';
import {
  parseUrl,
  toSearch,
  type AppUrlState,
  type ChartState,
  type TableState,
  type View,
} from './url.ts';

const EVENT = 'post-pulse:navigate';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

const getSearch = () => window.location.search;

export interface Navigate {
  (
    patch: {
      view?: View;
      filters?: Partial<Filters>;
      table?: Partial<TableState>;
      chart?: Partial<ChartState>;
    },
    mode?: 'push' | 'replace',
  ): void;
}

/** Current view and filters from the URL, and a way to change them (back button works). */
export function useAppUrl(): [AppUrlState, Navigate] {
  const search = useSyncExternalStore(subscribe, getSearch, () => '');
  const state = useMemo(() => parseUrl(search), [search]);
  const navigate = useCallback<Navigate>((patch, mode = 'push') => {
    const current = parseUrl(window.location.search);
    const next: AppUrlState = {
      view: patch.view ?? current.view,
      filters: { ...current.filters, ...patch.filters },
      table: { ...current.table, ...patch.table },
      chart: { ...current.chart, ...patch.chart },
    };
    const url = `${window.location.pathname}${toSearch(next)}`;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [state, navigate];
}
