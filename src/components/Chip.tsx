import type { ButtonHTMLAttributes } from 'react';
import styles from './Chip.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

/** Pill-shaped toggle (SPEC §9.1). */
export function Chip({ selected, className, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[styles.chip, selected ? styles.selected : '', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}
