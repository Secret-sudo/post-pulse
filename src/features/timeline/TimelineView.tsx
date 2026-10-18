// Timeline tab (SPEC §9.2 screen 4).
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate, fmtInt, fmtNumber, fmtRate } from '../../app/format.ts';
import type { Navigate } from '../../app/useAppUrl.ts';
import type { Dashboard } from '../../app/useDashboard.ts';
import type { History } from '../../app/useHistory.ts';
import type { ChartState } from '../../app/url.ts';
import type { Filters } from '../../analysis/filters.ts';
import { eligiblePosts } from '../../analysis/windows.ts';
import { Chart, type ChartClick } from '../../charts/Chart.tsx';
import { ChartFrame } from '../../charts/ChartFrame.tsx';
import type { ChartTheme } from '../../charts/theme.ts';
import { Chip } from '../../components/Chip.tsx';
import { engagementRate, engagements } from '../../import/derive.ts';
import type { PostType } from '../../import/types.ts';
import { safeLinkedInHref } from '../../security/links.ts';
import { FilterBar } from '../overview/FilterBar.tsx';
import {
  buildTimeline,
  COUNT_METRICS,
  METRICS,
  type TimelineMetric,
  type TimelinePoint,
} from './timeline.ts';
import { pointForClick, timelineOption } from './timelineOption.ts';
import styles from './TimelineView.module.css';

interface Props {
  history: History;
  dashboard: Dashboard;
  filters: Filters;
  chart: ChartState;
  navigate: Navigate;
}

export function formatMetric(metric: TimelineMetric, v: number): string {
  if (metric === 'engagementRate') return fmtRate(v);
  if (metric === 'outOfNetwork') return `${fmtNumber(v)} %`;
  return fmtInt(v);
}

export function TimelineView({ history, dashboard, filters, chart, navigate }: Props) {
  const { t } = useTranslation();
  const posts = useMemo(
    () =>
      eligiblePosts(
        dashboard.filtered,
        dashboard.latestExportDate,
        dashboard.settings.includeImmature,
      ),
    [dashboard],
  );
  const model = useMemo(
    () =>
      buildTimeline(
        posts,
        chart.metric,
        dashboard.headline.windows,
        dashboard.windowIndex,
        chart.log,
      ),
    [posts, chart.metric, chart.log, dashboard.headline.windows, dashboard.windowIndex],
  );

  const tooltip = useCallback(
    (p: TimelinePoint) => {
      const m = p.post.metrics;
      return [
        p.title || p.postId,
        `${fmtDate(p.date)} · ${p.type}`,
        `${t('timeline.metric.impressions')}: ${fmtInt(m.impressions)}`,
        `${t('timeline.metric.reach')}: ${m.membersReached === null ? '–' : fmtInt(m.membersReached)}`,
        `${t('timeline.metric.engagements')}: ${fmtInt(engagements(m))}`,
        `${t('timeline.metric.engagementRate')}: ${fmtRate(engagementRate(m))}`,
        `${t('timeline.metric.outOfNetwork')}: ${m.outOfNetworkPct === null ? '–' : `${fmtNumber(m.outOfNetworkPct)} %`}`,
        `${t('timeline.comments')}: ${fmtInt(m.comments)}`,
        t('timeline.clickHint'),
      ].join('\n');
    },
    [t],
  );

  const option = useCallback(
    (theme: ChartTheme) =>
      timelineOption(model, theme, {
        metric: t(`timeline.metric.${chart.metric}`),
        median: t('timeline.median'),
        format: (v) => formatMetric(chart.metric, v),
        tooltip,
      }),
    [model, chart.metric, t, tooltip],
  );

  const onClick = useCallback(
    (e: ChartClick) => {
      const p = pointForClick(model, e.seriesId, e.dataIndex);
      const href = p ? safeLinkedInHref(p.url) : null;
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    },
    [model],
  );

  const typesInData = [...new Set(history.posts.map((p) => p.postType))] as PostType[];

  return (
    <section className={styles.view} aria-labelledby="timeline-title">
      <h1 id="timeline-title">{t('timeline.title')}</h1>
      <FilterBar
        filters={filters}
        headline={dashboard.headline}
        windowIndex={dashboard.windowIndex}
        typesInData={typesInData}
        navigate={navigate}
        growing={dashboard.settings.includeImmature}
      />
      <ChartFrame
        title={t(`timeline.metric.${chart.metric}`)}
        description={t('timeline.description')}
        testId="timeline"
        expandable
        controls={
          <div className={styles.controls}>
            <div role="group" aria-label={t('timeline.metricLabel')} className={styles.group}>
              {METRICS.map((m) => (
                <Chip
                  key={m}
                  selected={chart.metric === m}
                  onClick={() => navigate({ chart: { metric: m } }, 'replace')}
                >
                  {t(`timeline.metric.${m}`)}
                </Chip>
              ))}
            </div>
            {COUNT_METRICS.has(chart.metric) && (
              <Chip
                selected={chart.log}
                onClick={() => navigate({ chart: { log: !chart.log } }, 'replace')}
              >
                {t('timeline.logScale')}
              </Chip>
            )}
          </div>
        }
        data={{
          columns: [
            t('timeline.col.date'),
            t('timeline.col.type'),
            t('timeline.col.title'),
            t(`timeline.metric.${chart.metric}`),
          ],
          rows: [...model.points]
            .reverse()
            .map((p) => [p.date, p.type, p.title || p.postId, formatMetric(chart.metric, p.value)]),
        }}
      >
        {(expanded: boolean) => (
          <>
            {model.logUnavailable && <p className={styles.note}>{t('timeline.logUnavailable')}</p>}
            {model.points.length === 0 ? (
              <p className={styles.note}>{t('timeline.empty')}</p>
            ) : (
              <Chart
                key={expanded ? 'expanded' : 'normal'}
                option={option}
                onClick={onClick}
                height={expanded ? Math.max(380, window.innerHeight - 200) : 380}
                label={t('timeline.chartLabel', {
                  count: model.points.length,
                  formatted: fmtInt(model.points.length),
                  metric: t(`timeline.metric.${chart.metric}`),
                })}
                testId="timeline-chart"
              />
            )}
          </>
        )}
      </ChartFrame>
    </section>
  );
}
