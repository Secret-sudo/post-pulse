// Breakdowns tab (SPEC §9.2 screen 5, Phase 1 parts): format tier list,
// outside-network buckets and posting rhythm.
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate, fmtDay, fmtInt, fmtNumber } from '../../app/format.ts';
import type { Navigate } from '../../app/useAppUrl.ts';
import type { Dashboard } from '../../app/useDashboard.ts';
import type { History } from '../../app/useHistory.ts';
import { PERIODS, type Period } from '../../analysis/breakdowns.ts';
import type { Filters } from '../../analysis/filters.ts';
import type { ChartState } from '../../app/url.ts';
import { Chip } from '../../components/Chip.tsx';
import { eligiblePosts } from '../../analysis/windows.ts';
import { Chart } from '../../charts/Chart.tsx';
import { ChartFrame } from '../../charts/ChartFrame.tsx';
import type { ChartTheme } from '../../charts/theme.ts';
import type { PostType } from '../../import/types.ts';
import { FilterBar } from '../overview/FilterBar.tsx';
import { BarTable, type BarRow } from './BarTable.tsx';
import { formatTiers, outOfNetworkBuckets, postingRhythm } from './model.ts';
import { rhythmOption } from './rhythmOption.ts';
import styles from './BreakdownsView.module.css';

const typeColor = (type: PostType) => `var(--type-${type.toLowerCase()})`;

interface Props {
  history: History;
  dashboard: Dashboard;
  filters: Filters;
  chart: ChartState;
  navigate: Navigate;
}

const MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const fmtMonth = (iso: string) => MONTH.format(new Date(`${iso}T00:00:00Z`));
const periodLabel: Record<Period, (start: string) => string> = {
  day: fmtDay,
  week: fmtDay,
  month: fmtMonth,
};
const periodCell: Record<Period, (start: string) => string> = {
  day: fmtDate,
  week: fmtDate,
  month: fmtMonth,
};

export function BreakdownsView({ history, dashboard, filters, chart, navigate }: Props) {
  const { t } = useTranslation();
  const eligible = useMemo(
    () =>
      eligiblePosts(
        dashboard.filtered,
        dashboard.latestExportDate,
        dashboard.settings.includeImmature,
      ),
    [dashboard],
  );
  const tiers = useMemo(() => formatTiers(eligible), [eligible]);
  const buckets = useMemo(() => outOfNetworkBuckets(eligible), [eligible]);
  // Rhythm counts every post: how often you post doesn't depend on a post's age.
  const period = chart.period;
  const rhythm = useMemo(
    () => postingRhythm(dashboard.filtered, dashboard.headline.thresholds.viral, period),
    [dashboard, period],
  );

  const tierRows: BarRow[] = tiers.rows.map((r) => ({
    ...r,
    key: r.type,
    label: r.type,
    color: typeColor(r.type),
    ...(r.ratio === null || r.tooFew
      ? {}
      : { note: `${fmtNumber(Math.round(r.ratio * 100) / 100)}×` }),
  }));
  const bucketRows: BarRow[] = buckets.map((b) => ({ ...b, key: b.id }));

  const option = useCallback(
    (theme: ChartTheme) =>
      rhythmOption(rhythm, theme, {
        regular: t('breakdowns.rhythm.regular'),
        viral: t('breakdowns.rhythm.viral'),
        posts: t(`breakdowns.rhythm.postsPer.${period}`),
        impressions: t('breakdowns.rhythm.impressions'),
        formatInt: fmtInt,
        period: periodLabel[period],
      }),
    [rhythm, t, period],
  );

  const typesInData = [...new Set(history.posts.map((p) => p.postType))] as PostType[];
  const overall = tiers.overallMedian;

  return (
    <section className={styles.view} aria-labelledby="breakdowns-title">
      <h1 id="breakdowns-title">{t('breakdowns.title')}</h1>
      <FilterBar
        filters={filters}
        headline={dashboard.headline}
        windowIndex={dashboard.windowIndex}
        typesInData={typesInData}
        navigate={navigate}
        growing={dashboard.settings.includeImmature}
        showWindows={false}
      />

      <ChartFrame
        title={t('breakdowns.formats.title')}
        description={
          overall === null
            ? t('breakdowns.formats.description')
            : t('breakdowns.formats.descriptionMedian', {
                median: fmtNumber(overall),
                count: eligible.length,
                formatted: fmtInt(eligible.length),
              })
        }
        testId="formats"
      >
        <BarTable rows={tierRows} caption={t('breakdowns.formats.title')} testId="format-tiers" />
      </ChartFrame>

      <ChartFrame
        title={t('breakdowns.oon.title')}
        description={t('breakdowns.oon.description')}
        testId="oon"
      >
        <BarTable rows={bucketRows} caption={t('breakdowns.oon.title')} testId="oon-buckets" />
      </ChartFrame>

      <ChartFrame
        title={t('breakdowns.rhythm.title')}
        description={t(`breakdowns.rhythm.description.${period}`)}
        testId="rhythm"
        controls={
          <div role="group" aria-label={t('breakdowns.rhythm.groupBy')} className={styles.group}>
            {PERIODS.map((p) => (
              <Chip
                key={p}
                selected={p === period}
                onClick={() => navigate({ chart: { period: p } }, 'replace')}
                data-testid={`period-${p}`}
              >
                {t(`breakdowns.rhythm.period.${p}`)}
              </Chip>
            ))}
          </div>
        }
        data={{
          columns: [
            t(`breakdowns.rhythm.col.${period}`),
            t(`breakdowns.rhythm.postsPer.${period}`),
            t('breakdowns.rhythm.regular'),
            t('breakdowns.rhythm.viral'),
          ],
          rows: rhythm.points.map((w) => [
            periodCell[period](w.start),
            w.posts,
            fmtInt(w.impressionsRegular),
            fmtInt(w.impressionsViral),
          ]),
        }}
      >
        {rhythm.points.length === 0 ? (
          <p className={styles.note}>{t('timeline.empty')}</p>
        ) : (
          <Chart
            option={option}
            height={300}
            label={t(`breakdowns.rhythm.chartLabel.${period}`, { count: rhythm.points.length })}
            testId="rhythm-chart"
          />
        )}
      </ChartFrame>
    </section>
  );
}
