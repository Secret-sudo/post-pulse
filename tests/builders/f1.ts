// Builders for synthetic F1 exports (SPEC §4.2). Values are made up.
import * as XLSX from 'xlsx';
import type { Cell } from '../../src/import/types.ts';

export const EN_HEADERS = [
  'Post URL',
  'Post Publish Date',
  'Post type',
  'Impressions',
  'Impressions (in-network)',
  'Impressions (out-of-network)',
  'Members reached',
  'Views',
  'Watch time',
  'Avg watch time',
  'Followers gained',
  'Profile viewers',
  'Reactions',
  'Comments',
  'Reposts',
  'Saves',
  'Sends',
  'Custom button engagements',
  'Visits to links',
] as const;

export type EnHeader = (typeof EN_HEADERS)[number];

let nextId = 7400000000000000000n;

export function sampleUrl(slug = 'a-sample-post-title', kind = 'ugcPost'): string {
  nextId += 1n;
  return `https://www.linkedin.com/posts/sample_${slug}-${kind}-${nextId}-AbCd`;
}

const DEFAULTS: Record<EnHeader, string> = {
  'Post URL': '',
  'Post Publish Date': '10/1/2026',
  'Post type': 'Image',
  Impressions: '200',
  'Impressions (in-network)': '70%',
  'Impressions (out-of-network)': '30%',
  'Members reached': '120',
  Views: '',
  'Watch time': '',
  'Avg watch time': '',
  'Followers gained': '0',
  'Profile viewers': '0',
  Reactions: '5',
  Comments: '1',
  Reposts: '0',
  Saves: '0',
  Sends: '0',
  'Custom button engagements': '0',
  'Visits to links': '',
};

/** One data row in EN header order; unspecified cells get plausible text defaults. */
export function f1Row(values: Partial<Record<EnHeader, Cell>> = {}): Cell[] {
  const row: Partial<Record<EnHeader, Cell>> = { ...DEFAULTS, 'Post URL': sampleUrl(), ...values };
  return EN_HEADERS.map((h) => row[h]);
}

export function f1Rows(
  rows: Partial<Record<EnHeader, Cell>>[],
  headers: readonly string[] = EN_HEADERS,
): Cell[][] {
  return [[...headers], ...rows.map((r) => f1Row(r))];
}

/** Write rows to .xlsx bytes, as LinkedIn does: every value as text unless given natively. */
export function toXlsx(rows: Cell[][], sheetName = 'POST PERFORMANCE'): Uint8Array {
  const wb = XLSX.utils.book_new();
  // Fixed document dates keep committed fixtures byte-identical across regenerations.
  wb.Props = {
    CreatedDate: new Date('2026-01-01T00:00:00Z'),
    ModifiedDate: new Date('2026-01-01T00:00:00Z'),
  };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), sheetName);
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}
