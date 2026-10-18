import { useTranslation } from 'react-i18next';
import { fmtInt, fmtRange } from '../../app/format.ts';
import type { Headline } from '../../analysis/metrics.ts';
import { safeLinkedInHref } from '../../security/links.ts';
import styles from './BestPosts.module.css';

/** Most recent windows listed; a 7-day view of a long history would otherwise go on and on. */
const BEST_WINDOWS = 6;

export function BestPosts({ headline }: { headline: Headline }) {
  const { t } = useTranslation();
  const name = (k: number) =>
    headline.size === 'all'
      ? t('filters.sizeAll')
      : k === 0
        ? t('filters.windowLatest', { days: headline.size })
        : k === 1
          ? t('filters.windowPrior', { days: headline.size })
          : null;
  return (
    <section aria-labelledby="best-title">
      <h2 id="best-title" className={styles.title}>
        {t('overview.bestTitle')}
      </h2>
      <ol className={styles.list}>
        {headline.windows.slice(0, BEST_WINDOWS).map((w) => {
          const p = w.metrics.bestPost;
          return (
            <li key={w.k} className={styles.item} data-testid={`best-${w.k}`}>
              <span className={styles.window}>
                {name(w.k)} <span className={styles.muted}>{fmtRange(w.start, w.end)}</span>
              </span>
              {p ? (
                <>
                  {safeLinkedInHref(p.url) ? (
                    <a
                      href={safeLinkedInHref(p.url) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.post}
                    >
                      {p.title || p.postId}
                      <span className={styles.sr}> {t('overview.openOnLinkedIn')}</span>
                    </a>
                  ) : (
                    <span className={styles.post}>{p.title || p.postId}</span>
                  )}
                  <span className={styles.muted}>
                    {p.postType} ·{' '}
                    {t('overview.impressions', {
                      count: p.metrics.impressions,
                      formatted: fmtInt(p.metrics.impressions),
                    })}
                  </span>
                </>
              ) : (
                <span className={styles.muted}>{t('overview.bestEmpty')}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
