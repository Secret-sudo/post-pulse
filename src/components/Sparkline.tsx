// Trend line inside the selected window (days or weeks, oldest first). Gaps
// (no posts) break the line. Hover, or focus and the arrow keys, show the
// dates and value of a point; screen readers get every point in the label.
import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import styles from './Sparkline.module.css';

export interface SparkDatum {
  value: number | null;
  /** "15 Sep – 21 Sep 2026: 240 (3 posts)" */
  text: string;
}

const W = 200;
const H = 36;
const PAD = 4;

export function Sparkline({ points, label }: { points: SparkDatum[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const known = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (known.length < 2) return null;
  const min = Math.min(...known);
  const max = Math.max(...known);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);

  const segments: string[] = [];
  let current = '';
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (current) segments.push(current);

  const last = points.length - 1;
  const shown = active ?? null;
  const dot = (i: number) => {
    const v = points[i]?.value;
    return v === null || v === undefined ? null : { left: (x(i) / W) * 100, top: (y(v) / H) * 100 };
  };
  const lastDot = dot(last);
  const activeDot = shown === null ? null : dot(shown);

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((rel - PAD) / (W - 2 * PAD)) * (points.length - 1));
    setActive(Math.max(0, Math.min(last, i)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.key === 'ArrowLeft' ? -1 : 1;
    setActive((a) => Math.max(0, Math.min(last, (a ?? last) + step)));
  };

  return (
    <div
      className={styles.spark}
      role="img"
      aria-label={label}
      tabIndex={0}
      onPointerMove={pick}
      onPointerLeave={() => setActive(null)}
      onFocus={() => setActive(last)}
      onBlur={() => setActive(null)}
      onKeyDown={onKey}
      data-testid="sparkline"
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {segments.map((d, i) => (
          <path key={i} d={d} className={styles.line} />
        ))}
      </svg>
      {lastDot && shown === null && (
        <span className={styles.dot} style={{ left: `${lastDot.left}%`, top: `${lastDot.top}%` }} />
      )}
      {shown !== null && (
        <>
          <span className={styles.cursor} style={{ left: `${(x(shown) / W) * 100}%` }} />
          {activeDot && (
            <span
              className={`${styles.dot} ${styles.active}`}
              style={{ left: `${activeDot.left}%`, top: `${activeDot.top}%` }}
            />
          )}
          <span
            className={styles.tip}
            style={{ left: `${Math.min(80, Math.max(20, (x(shown) / W) * 100))}%` }}
            aria-hidden="true"
            data-testid="sparkline-tip"
          >
            {points[shown]?.text}
          </span>
        </>
      )}
    </div>
  );
}
