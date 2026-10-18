// Posts tab (SPEC §9.2 screen 6): sortable, searchable, filterable, virtualised
// for 5,000+ rows, with CSV export of exactly what's shown.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate, fmtInt, fmtRate } from '../../app/format.ts';
import type { Navigate } from '../../app/useAppUrl.ts';
import type { Dashboard } from '../../app/useDashboard.ts';
import type { History } from '../../app/useHistory.ts';
import type { TableState } from '../../app/url.ts';
import type { Filters } from '../../analysis/filters.ts';
import { Button } from '../../components/Button.tsx';
import { FilterBar } from '../overview/FilterBar.tsx';
import type { PostType } from '../../import/types.ts';
import { safeLinkedInHref } from '../../security/links.ts';
import {
  buildRows,
  COLUMNS,
  csvFileName,
  NUMERIC,
  searchRows,
  sortRows,
  toCsv,
  type ColumnId,
  type PostRow,
} from './table.ts';
import styles from './PostsView.module.css';

export const ROW_HEIGHT = 44;
const OVERSCAN = 10;

interface Props {
  history: History;
  dashboard: Dashboard;
  filters: Filters;
  table: TableState;
  navigate: Navigate;
}

function useViewport(ref: React.RefObject<HTMLDivElement | null>) {
  const [state, setState] = useState({ top: 0, height: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setState({ top: el.scrollTop, height: el.clientHeight || 600 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [ref]);
  return state;
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function PostsView({ history, dashboard, filters, table, navigate }: Props) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const { top, height } = useViewport(scroller);

  const allRows = useMemo(
    () =>
      buildRows(dashboard.filtered, history.posts, dashboard.latestExportDate, dashboard.settings),
    [dashboard, history.posts],
  );
  const rows = useMemo(
    () => sortRows(searchRows(allRows, table.query), table.sort),
    [allRows, table.query, table.sort],
  );
  // Bars scale to the largest value in the current rows, so spikes stand out.
  const max = useMemo(
    () => ({
      impressions: Math.max(1, ...rows.map((r) => r.post.metrics.impressions)),
      reactions: Math.max(1, ...rows.map((r) => r.post.metrics.reactions)),
      comments: Math.max(1, ...rows.map((r) => r.post.metrics.comments)),
    }),
    [rows],
  );

  const first = Math.max(0, Math.floor(top / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((top + height) / ROW_HEIGHT) + OVERSCAN);
  const visible = rows.slice(first, last);
  const typesInData = [...new Set(history.posts.map((p) => p.postType))] as PostType[];

  const sortBy = (column: ColumnId) =>
    navigate(
      {
        table: {
          sort: {
            column,
            desc:
              table.sort.column === column
                ? !table.sort.desc
                : column !== 'title' && column !== 'type',
          },
        },
      },
      'replace',
    );

  return (
    <section className={styles.view} aria-labelledby="posts-title">
      <h1 id="posts-title">{t('posts.title')}</h1>
      <FilterBar
        filters={filters}
        headline={dashboard.headline}
        windowIndex={dashboard.windowIndex}
        typesInData={typesInData}
        navigate={navigate}
        growing={dashboard.settings.includeImmature}
        showWindows={false}
        showGrowing={false}
      />
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className={styles.sr}>{t('posts.search')}</span>
          <input
            type="search"
            value={table.query}
            placeholder={t('posts.searchPlaceholder')}
            onChange={(e) => navigate({ table: { query: e.target.value } }, 'replace')}
            data-testid="posts-search"
          />
        </label>
        <span className={styles.count} data-testid="posts-count" aria-live="polite">
          {t('posts.count', {
            count: rows.length,
            shown: fmtInt(rows.length),
            total: fmtInt(history.posts.length),
          })}
        </span>
        <Button
          onClick={() => download(toCsv(rows), csvFileName(new Date()))}
          disabled={rows.length === 0}
        >
          {t('posts.exportCsv')}
        </Button>
      </div>

      <div
        className={styles.scroller}
        ref={scroller}
        data-testid="posts-scroller"
        tabIndex={0}
        aria-label={t('posts.title')}
      >
        <table className={styles.table} aria-rowcount={rows.length + 1}>
          <thead>
            <tr aria-rowindex={1}>
              {COLUMNS.map((c) => {
                const active = table.sort.column === c;
                return (
                  <th
                    key={c}
                    scope="col"
                    className={`${styles[`col-${c}`] ?? ''} ${NUMERIC.has(c) ? styles.num : ''}`}
                    aria-sort={active ? (table.sort.desc ? 'descending' : 'ascending') : 'none'}
                  >
                    <button type="button" className={styles.sort} onClick={() => sortBy(c)}>
                      {t(`posts.col.${c}`)}
                      <span aria-hidden="true" className={styles.arrow}>
                        {active ? (table.sort.desc ? '▼' : '▲') : ''}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {first > 0 && <tr aria-hidden="true" style={{ height: first * ROW_HEIGHT }} />}
            {visible.map((r, i) => (
              <Row key={r.post.postId} row={r} index={first + i + 2} max={max} />
            ))}
            {last < rows.length && (
              <tr aria-hidden="true" style={{ height: (rows.length - last) * ROW_HEIGHT }} />
            )}
          </tbody>
        </table>
        {rows.length === 0 && <p className={styles.empty}>{t('posts.empty')}</p>}
      </div>
    </section>
  );
}

function Row({ row, index, max }: { row: PostRow; index: number; max: Record<BarColumn, number> }) {
  const { t } = useTranslation();
  const p = row.post;
  const m = p.metrics;
  const href = safeLinkedInHref(p.url);
  const title = p.title || p.postId;
  return (
    <tr aria-rowindex={index} className={styles.row} data-post={p.postId}>
      <td className={styles['col-date']}>{fmtDate(p.publishDate)}</td>
      <td className={styles['col-type']}>{p.postType}</td>
      <td className={styles['col-title']} title={title}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {title}
          </a>
        ) : (
          <span>{title}</span>
        )}
        {p.titleIsHashtags && <span className={styles.badge}>{t('posts.hashtagOpener')}</span>}
      </td>
      <BarCell value={m.impressions} max={max.impressions} column="impressions" />
      <td className={styles.num}>
        {m.outOfNetworkPct === null ? '–' : `${fmtInt(m.outOfNetworkPct)} %`}
      </td>
      <BarCell value={m.reactions} max={max.reactions} column="reactions" />
      <BarCell value={m.comments} max={max.comments} column="comments" />
      <td className={styles.num}>{fmtInt(m.reposts)}</td>
      <td className={styles.num}>{fmtInt(m.saves)}</td>
      <td className={styles.num}>{fmtRate(row.engagementRate)}</td>
      <td>
        {row.status && (
          <span className={`${styles.status} ${styles[row.status]}`}>
            {t(`posts.status.${row.status}`)}
          </span>
        )}
      </td>
    </tr>
  );
}

type BarColumn = 'impressions' | 'reactions' | 'comments';

/** Number with a bar behind it, scaled to the largest value in the table. */
function BarCell({ value, max, column }: { value: number; max: number; column: BarColumn }) {
  return (
    <td className={`${styles.num} ${styles.barCell} ${styles[`col-${column}`] ?? ''}`}>
      <span
        className={styles.bar}
        style={{ width: `${(value / max) * 100}%` }}
        aria-hidden="true"
        data-testid={`bar-${column}`}
      />
      <span className={styles.barValue}>{fmtInt(value)}</span>
    </td>
  );
}
