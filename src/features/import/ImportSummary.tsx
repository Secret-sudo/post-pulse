import { useTranslation } from 'react-i18next';
import type { ImportRecord } from '../../db/types.ts';
import styles from './ImportSummary.module.css';

export function ImportSummary({
  record,
  replacedSample,
}: {
  record: ImportRecord;
  replacedSample: boolean;
}) {
  const { t } = useTranslation();
  const counts = [
    ['new', record.postsNew],
    ['updated', record.postsUpdated],
    ['unchanged', record.postsUnchanged],
  ] as const;
  return (
    <>
      <dl className={styles.counts} data-testid="import-summary">
        {counts.map(([key, n]) => (
          <div key={key} className={styles.count} data-testid={`summary-${key}`}>
            <dt>{t(`import.summary.${key}`)}</dt>
            <dd>{n.toLocaleString('en-US')}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.muted}>
        {record.rangeStart
          ? t('import.summary.range', { start: record.rangeStart, end: record.rangeEnd })
          : t('import.summary.rangeEndOnly', { end: record.rangeEnd })}
      </p>
      {replacedSample && <p>{t('import.summary.replacedSample')}</p>}
      {record.warnings.length > 0 && (
        <details className={styles.warnings}>
          <summary>{t('import.summary.warnings', { count: record.warnings.length })}</summary>
          <ul>
            {record.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <div className={styles.backup}>
        <strong>{t('import.summary.backupTitle')}</strong>
        <p>{t('import.summary.backupText')}</p>
      </div>
    </>
  );
}
