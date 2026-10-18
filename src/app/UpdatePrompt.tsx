// Tells the user when a new version is ready, instead of reloading under them.
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../components/Button.tsx';
import styles from './UpdatePrompt.module.css';

export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className={styles.prompt} role="status" data-testid="pwa-prompt">
      <span>{needRefresh ? t('pwa.update') : t('pwa.offlineReady')}</span>
      {needRefresh && (
        <Button variant="primary" onClick={() => void updateServiceWorker(true)}>
          {t('pwa.reload')}
        </Button>
      )}
      <Button
        variant="quiet"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        {t('pwa.dismiss')}
      </Button>
    </div>
  );
}
