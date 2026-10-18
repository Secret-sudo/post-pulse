// Overview tab (SPEC §9.2 screen 3).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtInt, fmtNumber } from '../../app/format.ts';
import type { Navigate } from '../../app/useAppUrl.ts';
import type { Dashboard } from '../../app/useDashboard.ts';
import type { History } from '../../app/useHistory.ts';
import { DEFAULT_FILTERS, isFiltered, type Filters } from '../../analysis/filters.ts';
import { InsightCard } from '../../components/InsightCard.tsx';
import { KpiTile } from '../../components/KpiTile.tsx';
import type { PostType } from '../../import/types.ts';
import type { Insight } from '../../insights/types.ts';
import { overviewInsights } from '../../insights/engine.ts';
import { Button } from '../../components/Button.tsx';
import { ShareDialog } from '../share/ShareDialog.tsx';
import { BestPosts } from './BestPosts.tsx';
import { FilterBar } from './FilterBar.tsx';
import { buildKpis } from './kpis.ts';
import styles from './Overview.module.css';

interface Props {
  history: History;
  dashboard: Dashboard;
  filters: Filters;
  navigate: Navigate;
}

/** Insights about a set of posts open the posts table; window-level ones open the overview. */
export function applyInsightFilter(navigate: Navigate, insight: Insight) {
  const f = insight.relatedFilter ?? {};
  const view = f.postTypes || f.hashtagOpeners ? 'posts' : 'overview';
  navigate({ view, filters: { ...DEFAULT_FILTERS, ...f }, table: { query: '' } });
}

export function Overview({ history, dashboard, filters, navigate }: Props) {
  const { t } = useTranslation();
  const { headline, windowIndex, insights } = dashboard;
  const author = history.posts.find((p) => p.authorSlug !== '')?.authorSlug ?? '';
  const earliest = history.posts.reduce(
    (min, p) => (p.publishDate < min ? p.publishDate : min),
    history.posts[0]?.publishDate ?? '',
  );
  const kpis = buildKpis(headline, windowIndex, dashboard.spark);
  const [showAll, setShowAll] = useState(false);
  const [sharing, setSharing] = useState(false);
  const top5 = overviewInsights(insights);
  const shownInsights = showAll ? [...top5, ...insights.filter((i) => !top5.includes(i))] : top5;
  const hidden = insights.length - top5.length;
  const typesInData = [...new Set(history.posts.map((p) => p.postType))] as PostType[];
  const top = insights[0];
  const breakout = headline.thresholds.breakout;

  return (
    <div className={styles.overview}>
      <section className={styles.profile} aria-label="Profile">
        <span className={styles.avatar} aria-hidden="true">
          {author.slice(0, 2).toUpperCase() || '?'}
        </span>
        <div>
          <h1 className={styles.author}>{author || t('app.name')}</h1>
          <p className={styles.muted} data-testid="history-summary">
            {t('overview.posts', {
              count: history.posts.length,
              formatted: fmtInt(history.posts.length),
            })}{' '}
            · {t('overview.history', { start: earliest, end: history.latestExportDate ?? '' })}
          </p>
        </div>
      </section>

      <div className={styles.takeawayRow}>
        {top && (
          <p className={styles.takeaway} data-testid="takeaway">
            <strong>{t('overview.takeaway')}</strong> {top.title}
          </p>
        )}
        <Button onClick={() => setSharing(true)} data-testid="share-open">
          {t('share.button')} <span className={styles.alphaBadge}>{t('share.alpha')}</span>
        </Button>
      </div>
      {sharing && (
        <ShareDialog
          open
          onClose={() => setSharing(false)}
          history={history}
          dashboard={dashboard}
        />
      )}

      <FilterBar
        filters={filters}
        headline={headline}
        windowIndex={windowIndex}
        typesInData={typesInData}
        navigate={navigate}
        growing={dashboard.settings.includeImmature}
      />
      {isFiltered(filters) && (
        <p className={styles.muted} data-testid="filtered-count">
          {t('overview.filtered', {
            shown: fmtInt(dashboard.filtered.length),
            total: fmtInt(history.posts.length),
          })}
        </p>
      )}

      <section aria-labelledby="kpi-title">
        <h2 id="kpi-title" className={styles.sectionTitle}>
          {t('overview.kpiTitle')}
        </h2>
        <div className={styles.kpis}>
          {kpis.map((k) => (
            <KpiTile
              key={k.id}
              kpi={k}
              definitionValues={{
                multiplier: fmtNumber(dashboard.settings.breakoutMultiplier),
                threshold: breakout === null ? '–' : fmtInt(Math.ceil(breakout)),
              }}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="insights-title">
        <h2 id="insights-title" className={styles.sectionTitle}>
          {t('overview.insightsTitle')}
        </h2>
        <p className={styles.muted}>{t('overview.insightsIntro')}</p>
        {insights.length === 0 ? (
          <p className={styles.muted}>{t('overview.noInsights')}</p>
        ) : (
          <>
            <ul className={styles.cards} data-testid="insight-list" id="insight-list">
              {shownInsights.map((i) => (
                <InsightCard
                  key={i.id}
                  insight={i}
                  onApplyFilter={(x) => applyInsightFilter(navigate, x)}
                />
              ))}
            </ul>
            {hidden > 0 && (
              <Button
                variant="quiet"
                aria-expanded={showAll}
                aria-controls="insight-list"
                onClick={() => setShowAll((v) => !v)}
                data-testid="insights-toggle"
              >
                {showAll ? t('overview.showFewer') : t('overview.showAll', { count: hidden })}
              </Button>
            )}
          </>
        )}
      </section>

      <BestPosts headline={headline} />
    </div>
  );
}
