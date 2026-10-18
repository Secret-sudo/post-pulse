import { useTranslation } from 'react-i18next';
import { fmtDate, fmtRange } from '../../app/format.ts';
import type { Navigate } from '../../app/useAppUrl.ts';
import { Button } from '../../components/Button.tsx';
import { Chip } from '../../components/Chip.tsx';
import { InfoTip } from '../../components/InfoTip.tsx';
import { WINDOW_SIZES, type WindowSize } from '../../analysis/constants.ts';
import { DEFAULT_FILTERS, isFiltered, type Filters } from '../../analysis/filters.ts';
import type { Headline } from '../../analysis/metrics.ts';
import { POST_TYPES, type PostType } from '../../import/types.ts';
import styles from './FilterBar.module.css';

/** Windows shown as chips; older ones are in a menu so a 7-day view stays tidy. */
const WINDOW_CHIPS = 4;

interface Props {
  filters: Filters;
  headline: Headline;
  windowIndex: number;
  typesInData: PostType[];
  navigate: Navigate;
  showWindows?: boolean;
  showGrowing?: boolean;
  /** Whether growing posts are currently included (URL or the Settings default). */
  growing: boolean;
}

export function FilterBar({
  filters,
  headline,
  windowIndex,
  typesInData,
  navigate,
  showWindows = true,
  showGrowing = true,
  growing,
}: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<Filters>) => navigate({ filters: patch }, 'replace');
  const size = headline.size;
  const windowName = (k: number) =>
    k === 0
      ? t('filters.windowLatest', { days: size })
      : k === 1
        ? t('filters.windowPrior', { days: size })
        : fmtRange(headline.windows[k]?.start ?? '', headline.windows[k]?.end ?? '');
  const sizeName = (s: WindowSize) =>
    s === 'all' ? t('filters.sizeAll') : t('filters.sizeDays', { days: s });
  const types = POST_TYPES.filter((ty) => typesInData.includes(ty));
  const toggleType = (ty: PostType) =>
    set({
      postTypes: filters.postTypes.includes(ty)
        ? filters.postTypes.filter((x) => x !== ty)
        : [...filters.postTypes, ty],
    });
  const chips = headline.windows.slice(0, WINDOW_CHIPS);
  const older = headline.windows.slice(WINDOW_CHIPS);
  const first = headline.windows[0];

  return (
    <section className={styles.bar} aria-label={t('filters.label')}>
      {showWindows && (
        <>
          <div className={styles.row}>
            <span className={styles.rowLabel} id="filter-size">
              {t('filters.size')}
            </span>
            <div className={styles.group} role="group" aria-labelledby="filter-size">
              {WINDOW_SIZES.map((s) => (
                <Chip
                  key={s}
                  selected={s === size}
                  onClick={() => set({ size: s, window: 0 })}
                  data-testid={`size-${s}`}
                >
                  {sizeName(s)}
                </Chip>
              ))}
            </div>
          </div>
          {size !== 'all' && (
            <div className={styles.row}>
              <span className={styles.rowLabel} id="filter-window">
                {t('filters.window')}
              </span>
              <div className={styles.group} role="group" aria-labelledby="filter-window">
                {chips.map((w) => (
                  <Chip
                    key={w.k}
                    selected={w.k === windowIndex}
                    onClick={() => set({ window: w.k })}
                    title={fmtRange(w.start, w.end)}
                    data-testid={`window-${w.k}`}
                  >
                    {windowName(w.k)}
                    {w.k < 2 && <span className={styles.dates}>{fmtRange(w.start, w.end)}</span>}
                  </Chip>
                ))}
                {older.length > 0 && (
                  <select
                    className={styles.select}
                    aria-label={t('filters.olderWindows')}
                    value={windowIndex >= WINDOW_CHIPS ? String(windowIndex) : ''}
                    onChange={(e) =>
                      e.target.value !== '' && set({ window: Number(e.target.value) })
                    }
                    data-testid="window-older"
                  >
                    <option value="">{t('filters.olderWindows')}</option>
                    {older.map((w) => (
                      <option key={w.k} value={w.k}>
                        {fmtRange(w.start, w.end)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
          <p className={styles.explain} data-testid="window-explain">
            {size === 'all'
              ? t('filters.explainAll', {
                  start: first ? fmtDate(first.start) : '',
                  end: fmtDate(headline.latestExportDate),
                })
              : t('filters.explain', { days: size, date: fmtDate(headline.latestExportDate) })}
          </p>
        </>
      )}
      {types.length > 1 && (
        <div className={styles.row}>
          <span className={styles.rowLabel} id="filter-types">
            {t('filters.types')}
          </span>
          <div className={styles.group} role="group" aria-labelledby="filter-types">
            {types.map((ty) => (
              <Chip
                key={ty}
                selected={filters.postTypes.includes(ty)}
                onClick={() => toggleType(ty)}
              >
                {ty}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {(showGrowing ||
        filters.hashtagOpeners ||
        isFiltered(filters) ||
        filters.includeImmature !== null ||
        filters.window !== 0 ||
        filters.size !== DEFAULT_FILTERS.size) && (
        <div className={styles.row}>
          <span className={styles.rowLabel} id="filter-options">
            {t('filters.options')}
          </span>
          <div className={styles.group} role="group" aria-labelledby="filter-options">
            {showGrowing && (
              <span className={styles.withTip}>
                <Chip selected={growing} onClick={() => set({ includeImmature: !growing })}>
                  {t('filters.growing')}
                </Chip>
                <InfoTip text={t('filters.growingHint')} label={t('filters.growingWhat')} />
              </span>
            )}
            {filters.hashtagOpeners && (
              <Chip selected onClick={() => set({ hashtagOpeners: false })}>
                {t('filters.hashtags')}
              </Chip>
            )}
            {(isFiltered(filters) ||
              filters.includeImmature !== null ||
              filters.window !== 0 ||
              filters.size !== DEFAULT_FILTERS.size) && (
              <Button variant="quiet" onClick={() => set({ ...DEFAULT_FILTERS })}>
                {t('filters.clear')}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
