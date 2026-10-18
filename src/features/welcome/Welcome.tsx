import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { DropZone } from '../../components/DropZone.tsx';
import { RestoreBackup } from '../settings/RestoreBackup.tsx';
import { useImport } from '../import/ImportProvider.tsx';
import styles from './Welcome.module.css';

// Redacted LinkedIn screenshots in public/howto/, click areas framed in red.
const STEPS = [
  { key: 'step1', width: 526, height: 884 },
  { key: 'step2', width: 1000, height: 862 },
  { key: 'step3', width: 1000, height: 686 },
  { key: 'step4', width: 1000, height: 158 },
] as const;

export function Welcome() {
  const { t } = useTranslation();
  const { importFile, loadSampleData, busy } = useImport();
  return (
    <section className={styles.welcome} aria-labelledby="welcome-title">
      <h1 id="welcome-title">{t('welcome.title')}</h1>
      <p className={styles.promise}>{t('welcome.promise')}</p>

      <DropZone
        onFile={(f) => void importFile(f)}
        disabled={busy}
        buttonLabel={t('welcome.importButton')}
        hint={t('welcome.dropHint')}
        activeHint={t('welcome.dropActive')}
      />

      <details className={styles.howTo} data-testid="how-to">
        <summary>{t('welcome.howTo.summary')}</summary>
        <ol>
          {STEPS.map(({ key, width, height }) => (
            <li key={key}>
              <p>{t(`welcome.howTo.${key}`)}</p>
              <img
                className={styles.shot}
                src={`/howto/${key}.webp`}
                alt={t(`welcome.howTo.${key}Alt`)}
                width={width}
                height={height}
                loading="lazy"
                decoding="async"
              />
            </li>
          ))}
        </ol>
        <p>{t('welcome.howTo.after')}</p>
        <p className={styles.muted}>{t('welcome.howTo.redacted')}</p>
      </details>

      <div className={styles.sample}>
        <Button onClick={() => void loadSampleData()} disabled={busy}>
          {t('welcome.sampleButton')}
        </Button>
        <span className={styles.muted}>{t('welcome.sampleHint')}</span>
      </div>
      <div className={styles.sample}>
        <RestoreBackup variant="quiet" />
        <span className={styles.muted}>{t('welcome.restoreHint')}</span>
      </div>
    </section>
  );
}
