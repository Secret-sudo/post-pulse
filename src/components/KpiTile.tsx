import { useTranslation } from 'react-i18next';
import { fmtChange, fmtDate, fmtInt, fmtNumber, fmtRange, fmtRate } from '../app/format.ts';
import type { Kpi } from '../features/overview/kpis.ts';
import { InfoTip } from './InfoTip.tsx';
import { Sparkline } from './Sparkline.tsx';
import styles from './KpiTile.module.css';

export function formatKpiValue(kpi: Pick<Kpi, 'format'>, v: number | null): string {
  if (v === null) return '–';
  return kpi.format === 'rate'
    ? fmtRate(v)
    : kpi.format === 'int'
      ? fmtInt(v)
      : fmtNumber(Math.round(v * 10) / 10);
}

export function KpiTile({
  kpi,
  definitionValues = {},
}: {
  kpi: Kpi;
  definitionValues?: Record<string, string>;
}) {
  const { t } = useTranslation();
  const c = kpi.change === null ? null : fmtChange(kpi.change);
  const points = kpi.series.map((s) => ({
    value: s.value,
    text: t('kpi.sparkPoint', {
      dates: s.start === s.end ? fmtDate(s.start) : fmtRange(s.start, s.end),
      value: formatKpiValue(kpi, s.value),
      count: s.posts,
    }),
  }));
  const sparkLabel = t('kpi.sparkLabel', {
    label: t(`kpi.${kpi.id}.label`),
    points: points.map((p) => p.text).join('; '),
  });
  return (
    <article className={styles.tile} data-kpi={kpi.id}>
      <header className={styles.head}>
        <h3 className={styles.label}>{t(`kpi.${kpi.id}.label`)}</h3>
        <InfoTip text={t(`kpi.${kpi.id}.definition`, definitionValues)} />
      </header>
      <p className={styles.value} data-testid="kpi-value">
        {formatKpiValue(kpi, kpi.value)}
      </p>
      <p className={styles.meta}>
        {c ? (
          <span className={`${styles.change} ${styles[c.direction]}`} data-testid="kpi-change">
            <span aria-hidden="true">{c.text}</span>
            <span className={styles.sr}>{c.words}</span>
          </span>
        ) : (
          <span className={styles.muted}>{t('kpi.noPrior')}</span>
        )}
        <span className={styles.muted}>
          {kpi.priorPosts === null
            ? t('kpi.sample', { count: kpi.posts })
            : t('kpi.sampleVs', { count: kpi.posts, prior: kpi.priorPosts })}
        </span>
      </p>
      <footer className={styles.foot}>
        <Sparkline points={points} label={sparkLabel} />
        {kpi.status && (
          <span className={`${styles.status} ${styles[kpi.status]}`} data-testid="kpi-status">
            {t(`status.${kpi.status}`)}
          </span>
        )}
      </footer>
    </article>
  );
}
