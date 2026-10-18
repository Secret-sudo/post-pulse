// Settings & data (SPEC §9.2 screen 9, Phase 1 parts).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate, fmtInt, fmtNumber } from '../../app/format.ts';
import { useToasts } from '../../app/toasts.ts';
import type { Navigate } from '../../app/useAppUrl.ts';
import type { Dashboard } from '../../app/useDashboard.ts';
import type { History } from '../../app/useHistory.ts';
import { DEFAULT_FILTERS } from '../../analysis/filters.ts';
import { Button } from '../../components/Button.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { deleteAllData } from '../../db/backup.ts';
import { db } from '../../db/instance.ts';
import { saveSettings } from '../../db/repo.ts';
import type { Settings } from '../../db/types.ts';
import { applyTheme } from '../../app/useTheme.ts';
import { downloadBackup } from './dataActions.ts';
import { RestoreBackup } from './RestoreBackup.tsx';
import {
  BREAKOUT_RANGE,
  parseImpressions,
  parseMultiplier,
  validateThresholds,
  VIRAL_IMPRESSIONS_RANGE,
  VIRAL_RANGE,
} from './thresholds.ts';
import styles from './SettingsView.module.css';

const THEMES: Settings['theme'][] = ['system', 'light', 'dark'];

interface Props {
  history: History;
  dashboard: Dashboard;
  navigate: Navigate;
}

export function SettingsView({ history, dashboard, navigate }: Props) {
  const { t } = useTranslation();
  const show = useToasts((s) => s.show);
  const s = history.settings;
  const [breakout, setBreakout] = useState(String(s.breakoutMultiplier));
  const [viral, setViral] = useState(String(s.viralMultiplier));
  const [viralMode, setViralMode] = useState(s.viralMode);
  const [viralImpressions, setViralImpressions] = useState(fmtInt(s.viralImpressions));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const b = parseMultiplier(breakout);
  const v = parseMultiplier(viral);
  const vi = parseImpressions(viralImpressions);
  const fixed = viralMode === 'impressions';
  const errors = validateThresholds(b, v, fixed ? vi : undefined);
  const median = dashboard.headline.thresholds.personalMedian;
  const changed =
    b !== s.breakoutMultiplier ||
    viralMode !== s.viralMode ||
    (fixed ? vi !== s.viralImpressions : v !== s.viralMultiplier);

  const saveThresholds = async () => {
    if (errors.length > 0) return;
    await saveSettings(db, {
      breakoutMultiplier: b,
      viralMode,
      ...(fixed ? { viralImpressions: vi } : { viralMultiplier: v }),
    });
    show(t('settings.thresholds.saved'), 'success');
  };

  const deleteEverything = async () => {
    setConfirmDelete(false);
    await deleteAllData(db);
    navigate(
      { view: 'overview', filters: { ...DEFAULT_FILTERS }, table: { query: '' } },
      'replace',
    );
    show(t('settings.delete.done'), 'success');
  };

  return (
    <section className={styles.view} aria-labelledby="settings-title">
      <h1 id="settings-title">{t('settings.title')}</h1>

      <section className={styles.card} aria-labelledby="appearance-title">
        <h2 id="appearance-title">{t('settings.appearance.title')}</h2>
        {/* Uncontrolled, keyed by the stored value: a click shows at once, and a
            change from elsewhere (restore, another tab) resets the inputs. */}
        <fieldset className={styles.fieldset} key={s.theme}>
          <legend>{t('settings.appearance.theme')}</legend>
          <div className={styles.options}>
            {THEMES.map((theme) => (
              <label key={theme} className={styles.option}>
                <input
                  type="radio"
                  name="theme"
                  value={theme}
                  defaultChecked={s.theme === theme}
                  onChange={() => {
                    applyTheme(theme);
                    void saveSettings(db, { theme });
                  }}
                />
                {t(`settings.appearance.${theme}`)}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className={styles.card} aria-labelledby="analysis-title">
        <h2 id="analysis-title">{t('settings.thresholds.title')}</h2>
        <p className={styles.muted}>{t('settings.thresholds.intro')}</p>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void saveThresholds();
          }}
        >
          <label className={styles.field}>
            <span>{t('settings.thresholds.breakout')}</span>
            <input
              inputMode="decimal"
              value={breakout}
              onChange={(e) => setBreakout(e.target.value)}
              aria-describedby="breakout-hint"
              aria-invalid={errors.includes('breakout-range') || errors.includes('not-a-number')}
            />
            <small id="breakout-hint" className={styles.muted}>
              {median === null || !Number.isFinite(b)
                ? t('settings.thresholds.range', BREAKOUT_RANGE)
                : t('settings.thresholds.resolved', {
                    multiplier: fmtNumber(b),
                    median: fmtNumber(median),
                    value: fmtInt(Math.ceil(b * median)),
                  })}
            </small>
          </label>
          <fieldset className={styles.fieldset}>
            <legend>{t('settings.thresholds.viralMode')}</legend>
            <label className={styles.option}>
              <input
                type="radio"
                name="viral-mode"
                checked={!fixed}
                onChange={() => setViralMode('multiplier')}
              />
              {t('settings.thresholds.modeMultiplier')}
            </label>
            <label className={styles.option}>
              <input
                type="radio"
                name="viral-mode"
                checked={fixed}
                onChange={() => setViralMode('impressions')}
              />
              {t('settings.thresholds.modeImpressions')}
            </label>
          </fieldset>
          {fixed ? (
            <label className={styles.field}>
              <span>{t('settings.thresholds.viralImpressions')}</span>
              <input
                inputMode="numeric"
                value={viralImpressions}
                onChange={(e) => setViralImpressions(e.target.value)}
                aria-describedby="viral-impressions-hint"
                aria-invalid={
                  errors.includes('impressions-range') || errors.includes('not-a-number')
                }
              />
              <small id="viral-impressions-hint" className={styles.muted}>
                {t('settings.thresholds.impressionsSource')}
              </small>
            </label>
          ) : (
            <label className={styles.field}>
              <span>{t('settings.thresholds.viral')}</span>
              <input
                inputMode="decimal"
                value={viral}
                onChange={(e) => setViral(e.target.value)}
                aria-describedby="viral-hint"
                aria-invalid={errors.some((x) => x !== 'breakout-range')}
              />
              <small id="viral-hint" className={styles.muted}>
                {median === null || !Number.isFinite(v)
                  ? t('settings.thresholds.range', VIRAL_RANGE)
                  : t('settings.thresholds.resolved', {
                      multiplier: fmtNumber(v),
                      median: fmtNumber(median),
                      value: fmtInt(Math.ceil(v * median)),
                    })}
              </small>
            </label>
          )}
          {errors.length > 0 && (
            <ul className={styles.errors} role="alert">
              {errors.map((e) => (
                <li key={e}>
                  {t(`settings.thresholds.error.${e}`, {
                    ...BREAKOUT_RANGE,
                    vmin: VIRAL_RANGE.min,
                    vmax: VIRAL_RANGE.max,
                    imin: fmtInt(VIRAL_IMPRESSIONS_RANGE.min),
                    imax: fmtInt(VIRAL_IMPRESSIONS_RANGE.max),
                  })}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.row}>
            <Button type="submit" variant="primary" disabled={errors.length > 0 || !changed}>
              {t('settings.thresholds.save')}
            </Button>
          </div>
        </form>
        <label className={styles.check} key={String(s.includeImmature)}>
          <input
            type="checkbox"
            defaultChecked={s.includeImmature}
            onChange={(e) => void saveSettings(db, { includeImmature: e.target.checked })}
          />
          <span>
            {t('settings.growing.label')}
            <small className={styles.muted}>{t('settings.growing.hint')}</small>
          </span>
        </label>
      </section>

      <section className={styles.card} aria-labelledby="data-title">
        <h2 id="data-title">{t('settings.data.title')}</h2>
        <p className={styles.muted}>{t('settings.data.intro')}</p>
        <div className={styles.row}>
          <Button onClick={() => void downloadBackup()}>{t('settings.data.backup')}</Button>
          <RestoreBackup />
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            {t('settings.delete.button')}
          </Button>
        </div>

        <h3 className={styles.subTitle}>{t('settings.imports.title')}</h3>
        <ul className={styles.imports} data-testid="import-history">
          {[...history.imports]
            .sort((x, y) => (x.importedAt < y.importedAt ? 1 : -1))
            .map((i) => (
              <li key={i.importId}>
                <strong>{i.fileName}</strong>
                <span className={styles.muted}>
                  {t('settings.imports.line', {
                    range: i.rangeStart
                      ? `${fmtDate(i.rangeStart)} – ${fmtDate(i.rangeEnd)}`
                      : fmtDate(i.rangeEnd),
                    new: fmtInt(i.postsNew),
                    updated: fmtInt(i.postsUpdated),
                    unchanged: fmtInt(i.postsUnchanged),
                  })}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <Dialog
        open={confirmDelete}
        title={t('settings.delete.title')}
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={() => void downloadBackup()}>
              {t('settings.delete.backupFirst')}
            </Button>
            <Button variant="danger" onClick={() => void deleteEverything()}>
              {t('settings.delete.confirm')}
            </Button>
          </>
        }
      >
        <p>
          {t('settings.delete.text', {
            count: history.posts.length,
            formatted: fmtInt(history.posts.length),
          })}
        </p>
      </Dialog>
    </section>
  );
}
