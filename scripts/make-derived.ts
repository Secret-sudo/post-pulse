// Local only (SPEC §11.4, TC-M08): derive a plausible "next export" from a real
// export in docs/data/. Drops the 10 oldest posts, raises impressions of the 20
// newest by 10 % and adds 3 new posts after the original range end.
// Usage: npm run fixtures:derived

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';
import { toXlsx } from '../tests/builders/f1.ts';
import type { Cell } from '../src/import/types.ts';

export const SOURCE = 'docs/data/PostPerformance_2026-07-17_2026-10-14.xlsx';
export const DERIVED_NAME = 'PostPerformance_2026-07-22_2026-10-21.xlsx';

export function readRows(bytes: Uint8Array): Cell[][] {
  const wb = XLSX.read(bytes, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ''];
  if (!sheet) throw new Error('no sheet');
  return XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: '' });
}

const usToKey = (d: Cell) => {
  const [m, day, y] = String(d).split('/').map(Number);
  return (y ?? 0) * 10_000 + (m ?? 0) * 100 + (day ?? 0);
};

export function deriveNextExport(rows: Cell[][]): Cell[][] {
  const [header, ...data] = rows;
  if (!header) throw new Error('no header row');
  const col = (name: string) => header.findIndex((h) => h === name);
  const urlCol = col('Post URL');
  const dateCol = col('Post Publish Date');
  const impCol = col('Impressions');

  const byAge = data
    .map((row, i) => ({ row, i }))
    .sort((a, b) => usToKey(a.row[dateCol]) - usToKey(b.row[dateCol]) || a.i - b.i);
  const kept = byAge.slice(10);
  const newestFirst = [...kept].sort(
    (a, b) => usToKey(b.row[dateCol]) - usToKey(a.row[dateCol]) || b.i - a.i,
  );
  const raise = new Set(newestFirst.slice(0, 20).map((k) => k.i));

  const out = kept.map(({ row, i }) => {
    const copy = [...row];
    if (raise.has(i)) copy[impCol] = String(Math.round(Number(copy[impCol]) * 1.1));
    return copy;
  });

  const author = String(data[0]?.[urlCol] ?? '').match(/\/posts\/([^_]+)_/)?.[1] ?? 'sample';
  ['10/15/2026', '10/17/2026', '10/20/2026'].forEach((date, k) => {
    const row = [...(kept[0]?.row ?? [])];
    row[urlCol] =
      `https://www.linkedin.com/posts/${author}_derived-test-post-${k}-ugcPost-74000000000000090${k}0-Drv${k}`;
    row[dateCol] = date;
    row[impCol] = String(150 + 10 * k);
    out.push(row);
  });
  return [header, ...out];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const rows = readRows(new Uint8Array(readFileSync(SOURCE)));
  mkdirSync('docs/data/derived', { recursive: true });
  writeFileSync(`docs/data/derived/${DERIVED_NAME}`, toXlsx(deriveNextExport(rows)));
  console.log(`wrote docs/data/derived/${DERIVED_NAME}`);
}
