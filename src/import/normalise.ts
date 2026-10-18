// Value parsers for export cells (SPEC §4.3). Pure, never throw: a value that
// can't be read becomes `null` with a `problem` the caller turns into a warning.

import type { Cell } from './types.ts';

export interface Parsed<T> {
  value: T | null;
  problem?: string;
}

const ok = <T>(value: T): Parsed<T> => ({ value });
const none = <T>(): Parsed<T> => ({ value: null });
const bad = <T>(problem: string): Parsed<T> => ({ value: null, problem });

/** `""`, whitespace, `-` and `–` mean "no value". */
export function isEmptyCell(cell: Cell): boolean {
  if (cell === null || cell === undefined) return true;
  if (typeof cell !== 'string') return false;
  const t = cell.trim();
  return t === '' || t === '-' || t === '–';
}

export function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).trim();
}

const SPACES = /[\s\u00A0\u202F]/g;
const THOUSANDS = /[,'\u2019.]/g;

export function parseInteger(cell: Cell): Parsed<number> {
  if (isEmptyCell(cell)) return none();
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? ok(Math.round(cell)) : bad(`not a number: ${cell}`);
  }
  if (typeof cell !== 'string') return bad(`not a number: ${cellText(cell)}`);
  const digits = cell.replace(SPACES, '').replace(THOUSANDS, '');
  if (!/^\d+$/.test(digits)) return bad(`not a whole number: "${cell}"`);
  return ok(Number(digits));
}

export function parsePercent(cell: Cell): Parsed<number> {
  if (isEmptyCell(cell)) return none();
  let n: number;
  if (typeof cell === 'number') {
    n = cell <= 1 ? cell * 100 : cell;
  } else if (typeof cell === 'string') {
    const t = cell.replace(SPACES, '').replace(/%$/, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(t)) return bad(`not a percentage: "${cell}"`);
    n = Number(t);
  } else {
    return bad(`not a percentage: ${cellText(cell)}`);
  }
  if (n > 100) return { value: 100, problem: `percentage above 100: "${cellText(cell)}"` };
  return ok(Math.round(n * 1e6) / 1e6);
}

const UNIT_SECONDS: Record<string, number> = { d: 86_400, h: 3_600, m: 60, s: 1 };

/** `13s`, `10m 1s`, `1h 3m`, `1d 13h` → seconds. */
export function parseDuration(cell: Cell): Parsed<number> {
  if (isEmptyCell(cell)) return none();
  if (typeof cell === 'number')
    return Number.isFinite(cell) ? ok(Math.round(cell)) : bad('bad duration');
  if (typeof cell !== 'string') return bad(`not a duration: ${cellText(cell)}`);
  let total = 0;
  let matched = false;
  const leftover = cell.replace(/(\d+)\s*([dhms])(?![a-z])/gi, (_m, n: string, unit: string) => {
    total += Number(n) * (UNIT_SECONDS[unit.toLowerCase()] ?? 0);
    matched = true;
    return ' ';
  });
  if (!matched || leftover.trim() !== '') return bad(`not a duration: "${cell}"`);
  return ok(total);
}

export type SlashOrder = 'MDY' | 'DMY';

const pad = (n: number) => String(n).padStart(2, '0');

function isoIfValid(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

/** Parse a `M/D/YYYY` or `D/M/YYYY` string under one order; null if invalid. */
export function parseSlashDate(text: string, order: SlashOrder): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return order === 'MDY' ? isoIfValid(y, a, b) : isoIfValid(y, b, a);
}

export function isSlashDate(cell: Cell): cell is string {
  return typeof cell === 'string' && /^\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/.test(cell);
}

/**
 * Dates in the order of SPEC §4.3: native Date, Excel serial number, ISO,
 * `D.M.YYYY`, then slash dates in the given order.
 */
export function parseDate(cell: Cell, order: SlashOrder): Parsed<string> {
  if (isEmptyCell(cell)) return none();
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return bad('invalid date');
    return ok(`${cell.getFullYear()}-${pad(cell.getMonth() + 1)}-${pad(cell.getDate())}`);
  }
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell) || cell < 1) return bad(`not a date: ${cell}`);
    const d = new Date(EXCEL_EPOCH_MS + Math.floor(cell) * DAY_MS);
    return ok(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  if (typeof cell !== 'string') return bad(`not a date: ${cellText(cell)}`);
  const t = cell.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return orBad(isoIfValid(Number(m[1]), Number(m[2]), Number(m[3])), cell);
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return orBad(isoIfValid(Number(m[3]), Number(m[2]), Number(m[1])), cell);
  if (isSlashDate(t)) return orBad(parseSlashDate(t, order), cell);
  return bad(`not a date: "${cell}"`);
}

function orBad(iso: string | null, cell: string): Parsed<string> {
  return iso ? ok(iso) : bad(`not a valid date: "${cell}"`);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}
