// Fixtures for the import UI (SPEC §11.2). Rules for syn-basic-en, so the
// expectations in syn-basic.expected.json can be worked out by hand:
//   post i (0..39): published 2026-07-18 + 2·i days, impressions 200 + 10·i,
//   type = the 8 known types in turn (5 posts each).

import { EN_HEADERS, f1Row } from '../../tests/builders/f1.ts';
import type { Cell } from '../../src/import/types.ts';

const TYPES = ['Image', 'Video', 'Repost', 'Text', 'Article', 'Document', 'Poll', 'Celebration'];

const usDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${y}`;
};

const addDays = (iso: string, days: number) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};

export function basicEn(): Cell[][] {
  return [
    [...EN_HEADERS],
    ...Array.from({ length: 40 }, (_, i) => {
      const id = 7400000000000007000n + BigInt(i);
      return f1Row({
        'Post URL': `https://www.linkedin.com/posts/sample_a-basic-synthetic-post-ugcPost-${id}-Bas1`,
        'Post Publish Date': usDate(addDays('2026-07-18', 2 * i)),
        'Post type': TYPES[i % TYPES.length],
        Impressions: String(200 + 10 * i),
      });
    }),
  ];
}

export const unknownHeaders = (): Cell[][] => [
  ['Date', 'Clicks', 'Likes'],
  ['10/1/2026', '5', '3'],
];

export const emptyEn = (): Cell[][] => [[...EN_HEADERS]];

export const BASIC_FIXTURES = {
  'syn-basic-en_2026-07-17_2026-10-14.xlsx': basicEn,
  'syn-unknown-headers.xlsx': unknownHeaders,
  'syn-empty.xlsx': emptyEn,
} as const;
