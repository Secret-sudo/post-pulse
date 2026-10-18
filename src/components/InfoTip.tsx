// Small "i" button that explains a number (SPEC §9.3: every number has a
// tooltip). Shown on hover and keyboard focus; the text is its accessible name.
import { useId } from 'react';
import styles from './InfoTip.module.css';

export function InfoTip({ text, label = 'Definition' }: { text: string; label?: string }) {
  const id = useId();
  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.button} aria-describedby={id} aria-label={label}>
        i
      </button>
      <span role="tooltip" id={id} className={styles.tip}>
        {text}
      </span>
    </span>
  );
}
