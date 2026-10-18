// Groups as a table with an in-cell bar: readable, sortable by eye, and its own
// data table, so no chart library is needed (SPEC §9.3 fallback by design).
import { useTranslation } from 'react-i18next';
import { fmtNumber, fmtRate } from '../../app/format.ts';
import type { GroupStats } from '../../analysis/breakdowns.ts';
import styles from './BarTable.module.css';

export interface BarRow extends GroupStats {
  key: string;
  label: string;
  color?: string;
  note?: string;
}

export function BarTable({
  rows,
  caption,
  testId,
}: {
  rows: BarRow[];
  caption: string;
  testId: string;
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map((r) => r.medianImpressions ?? 0));
  return (
    <div className={styles.wrap}>
      <table className={styles.table} data-testid={testId}>
        <caption className={styles.sr}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('breakdowns.col.group')}</th>
            <th scope="col" className={styles.num}>
              {t('breakdowns.col.posts')}
            </th>
            <th scope="col" className={styles.barCol}>
              {t('breakdowns.col.medianImpressions')}
            </th>
            <th scope="col" className={styles.num}>
              {t('breakdowns.col.medianEr')}
            </th>
            <th scope="col" className={styles.num}>
              {t('breakdowns.col.medianOon')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.tooFew ? styles.tooFew : undefined} data-group={r.key}>
              <th scope="row">
                {r.color && (
                  <span
                    className={styles.swatch}
                    style={{ background: r.color }}
                    aria-hidden="true"
                  />
                )}
                {r.label}
                {r.tooFew && <span className={styles.badge}>{t('breakdowns.tooFew')}</span>}
              </th>
              <td className={styles.num}>{fmtNumber(r.posts)}</td>
              <td className={styles.barCol}>
                {r.medianImpressions === null ? (
                  '–'
                ) : (
                  <span className={styles.barWrap}>
                    <span
                      className={styles.bar}
                      style={{
                        width: `${(r.medianImpressions / max) * 100}%`,
                        ...(r.color ? { background: r.color } : {}),
                      }}
                      aria-hidden="true"
                    />
                    <span className={styles.value}>
                      {fmtNumber(Math.round(r.medianImpressions * 10) / 10)}
                    </span>
                    {r.note && <span className={styles.note}>{r.note}</span>}
                  </span>
                )}
              </td>
              <td className={styles.num}>
                {r.medianEngagementRate === null ? '–' : fmtRate(r.medianEngagementRate)}
              </td>
              <td className={styles.num}>
                {r.medianOutOfNetworkPct === null ? '–' : `${fmtNumber(r.medianOutOfNetworkPct)} %`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
