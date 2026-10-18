// Modal built on the native <dialog>: focus trapping, Escape and the top layer
// come from the browser (SPEC §9.3 keyboard navigation).
import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  /** Wide dialogs hold previews, e.g. the share carousel. */
  wide?: boolean;
}

export function Dialog({ open, title, onClose, children, actions, wide = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    }
    if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${wide ? styles.wide : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </dialog>
  );
}
