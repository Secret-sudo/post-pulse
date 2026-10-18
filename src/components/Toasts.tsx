import { useToasts } from '../app/toasts.ts';
import styles from './Toasts.module.css';

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.tone]}`}>
          <span>{t.text}</span>
          <button
            type="button"
            className={styles.close}
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
