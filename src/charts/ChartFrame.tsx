// Card around a chart with a "Show data" table fallback (SPEC §9.3). An
// expandable frame can fill the window; Escape or the button brings it back.
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button.tsx';
import styles from './ChartFrame.module.css';

export interface DataTable {
  columns: string[];
  rows: (string | number)[][];
}

interface Props {
  title: string;
  description?: string;
  /** A function child gets whether the frame is expanded, e.g. to size the chart. */
  children: ReactNode | ((expanded: boolean) => ReactNode);
  expandable?: boolean;
  data?: DataTable;
  controls?: ReactNode;
  testId?: string;
}

export function ChartFrame({
  title,
  description,
  children,
  expandable = false,
  data,
  controls,
  testId,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  return (
    <section
      className={`${styles.frame} ${expanded ? styles.expanded : ''}`}
      data-testid={testId}
      data-expanded={expanded || undefined}
      aria-label={expanded ? title : undefined}
    >
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {description && <p className={styles.muted}>{description}</p>}
        </div>
        {controls}
        {expandable && (
          <Button
            variant="quiet"
            aria-pressed={expanded}
            onClick={() => setExpanded((v) => !v)}
            data-testid="chart-expand"
          >
            <span aria-hidden="true">{expanded ? '⤡ ' : '⤢ '}</span>
            {expanded ? t('charts.collapse') : t('charts.expand')}
          </Button>
        )}
      </header>
      {typeof children === 'function' ? children(expanded) : children}
      {data && (
        <details className={styles.data}>
          <summary>{t('charts.showData')}</summary>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {data.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
