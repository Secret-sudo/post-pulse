// Number and date formatting for the UI (SPEC §10: Intl). English for now.

const LOCALE = 'en-US';
const int = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const upTo1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const one = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const day = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayYear = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export const fmtInt = (n: number) => int.format(n);
/** Medians can be x.5: show one decimal only when there is one. */
export const fmtNumber = (n: number) => upTo1.format(n);
/** 0.0192 → "1.9 %" */
export const fmtRate = (ratio: number) => `${one.format(ratio * 100)} %`;
/** −0.2135 → "▼ 21.3 %", with an accessible word for screen readers in `words`. */
export function fmtChange(ratio: number): {
  text: string;
  words: string;
  direction: 'up' | 'down' | 'none';
} {
  const pct = `${one.format(Math.abs(ratio) * 100)} %`;
  if (Math.round(ratio * 1000) === 0)
    return { text: `± 0.0 %`, words: 'no change', direction: 'none' };
  return ratio > 0
    ? { text: `▲ ${pct}`, words: `up ${pct}`, direction: 'up' }
    : { text: `▼ ${pct}`, words: `down ${pct}`, direction: 'down' };
}

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const fmtDay = (iso: string) => day.format(asDate(iso));
export const fmtDate = (iso: string) => dayYear.format(asDate(iso));
export const fmtRange = (start: string, end: string) => `${fmtDay(start)} – ${fmtDate(end)}`;
