// Sheet format detection (SPEC §4.4).

import {
  F1_FIELDS,
  F1_MIN_MATCH_SHARE,
  F1_REQUIRED,
  lookupHeader,
  type F1Field,
} from './headers.ts';
import { cellText } from './normalise.ts';
import type { Cell, HeaderLanguage } from './types.ts';

export interface F1Detection {
  isF1: boolean;
  /** Column index per matched field (first match wins). */
  columns: Partial<Record<F1Field, number>>;
  /** Columns not in the registry, kept in `raw`. */
  extraColumns: { index: number; header: string }[];
  language: HeaderLanguage;
  matchShare: number;
  missingRequired: F1Field[];
  headersFound: string[];
}

export function detectF1(headerRow: readonly Cell[]): F1Detection {
  const headersFound = headerRow.map(cellText);
  const columns: Partial<Record<F1Field, number>> = {};
  const extraColumns: { index: number; header: string }[] = [];
  const votes: Record<HeaderLanguage, number> = { en: 0, de: 0, fr: 0 };

  headersFound.forEach((header, index) => {
    if (header === '') return;
    const matches = lookupHeader(header);
    const first = matches[0];
    if (!first) {
      extraColumns.push({ index, header });
      return;
    }
    if (columns[first.field] === undefined) columns[first.field] = index;
    for (const m of matches) votes[m.language] += 1;
  });

  const matched = F1_FIELDS.filter((f) => columns[f] !== undefined).length;
  const matchShare = matched / F1_FIELDS.length;
  const missingRequired = F1_REQUIRED.filter((f) => columns[f] === undefined);
  const language = (['en', 'de', 'fr'] as const).reduce((best, l) =>
    votes[l] > votes[best] ? l : best,
  );

  return {
    isF1: missingRequired.length === 0 && matchShare >= F1_MIN_MATCH_SHARE,
    columns,
    extraColumns,
    language,
    matchShare,
    missingRequired,
    headersFound,
  };
}
