// File picker + drag-and-drop target (SPEC §9.2). The visible button opens the
// picker, so it works with keyboard and screen readers; dropping is a shortcut.
import { useRef, useState } from 'react';
import { Button } from './Button.tsx';
import styles from './DropZone.module.css';

interface Props {
  onFile: (file: File) => void;
  buttonLabel: string;
  hint: string;
  activeHint: string;
  disabled?: boolean;
}

export function DropZone({ onFile, buttonLabel, hint, activeHint, disabled = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ''}`}
      data-testid="drop-zone"
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && !disabled) onFile(file);
      }}
    >
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className={styles.input}
        data-testid="file-input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
      <Button variant="primary" onClick={() => input.current?.click()} disabled={disabled}>
        {buttonLabel}
      </Button>
      <span className={styles.hint}>{dragging ? activeHint : hint}</span>
    </div>
  );
}
