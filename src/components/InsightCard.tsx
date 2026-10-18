import { useTranslation } from 'react-i18next';
import type { Insight } from '../insights/types.ts';
import styles from './InsightCard.module.css';

interface Props {
  insight: Insight;
  /** Applies the insight's related filter (SPEC §7). */
  onApplyFilter?: (insight: Insight) => void;
}

export function InsightCard({ insight, onApplyFilter }: Props) {
  const { t } = useTranslation();
  return (
    <li className={`${styles.card} ${styles[insight.severity]}`} data-insight={insight.id}>
      <span className={styles.severity}>{t(`severity.${insight.severity}`)}</span>
      <h3>{insight.title}</h3>
      <p className={styles.muted}>{insight.evidence}</p>
      <p>
        <strong>{t('overview.suggestion')}</strong> {insight.suggestion}
      </p>
      {insight.relatedFilter && onApplyFilter && (
        <div>
          <button type="button" className={styles.link} onClick={() => onApplyFilter(insight)}>
            {t('insights.showPosts')}
          </button>
        </div>
      )}
    </li>
  );
}
