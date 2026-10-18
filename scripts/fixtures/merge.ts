// Synthetic merge fixtures (SPEC §11.2). Every value follows a simple rule so
// the expectations in fixtures/synthetic/*.expected.json can be worked out by hand:
//   post i (0..29): published 2026-07-01 + 3·i days, impressions 100 + 10·i,
//   comments 1, ID 7400000000000001000 + i.
// b drops posts 0–4, adds 50 impressions and 1 comment to posts 5–14, keeps
// posts 15–29 unchanged and adds 4 new posts (IDs …1100–…1103).

import { f1Row } from '../../tests/builders/f1.ts';
import { EN_HEADERS, type EnHeader } from '../../tests/builders/f1.ts';
import type { Cell } from '../../src/import/types.ts';

const usDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${y}`;
};

const addDays = (iso: string, days: number) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};

function post(
  id: bigint,
  publishIso: string,
  impressions: number,
  comments: number,
  author = 'sample',
  extra: Partial<Record<EnHeader, Cell>> = {},
): Cell[] {
  return f1Row({
    'Post URL': `https://www.linkedin.com/posts/${author}_synthetic-post-number-${id % 10000n}-ugcPost-${id}-Syn1`,
    'Post Publish Date': usDate(publishIso),
    Impressions: String(impressions),
    Comments: String(comments),
    ...extra,
  });
}

const BASE_ID = 7400000000000001000n;
const basePost = (i: number, bump = 0) =>
  post(BASE_ID + BigInt(i), addDays('2026-07-01', 3 * i), 100 + 10 * i + bump, bump ? 2 : 1);

export function mergeA(): Cell[][] {
  return [[...EN_HEADERS], ...Array.from({ length: 30 }, (_, i) => basePost(i))];
}

export function mergeB(): Cell[][] {
  const kept = Array.from({ length: 25 }, (_, k) => {
    const i = k + 5;
    return basePost(i, i <= 14 ? 50 : 0);
  });
  const added = ['2026-10-01', '2026-10-04', '2026-10-08', '2026-10-12'].map((d, k) =>
    post(BASE_ID + 100n + BigInt(k), d, 500 + 100 * k, 0),
  );
  return [[...EN_HEADERS], ...kept, ...added];
}

export function otherAuthor(): Cell[][] {
  return [
    [...EN_HEADERS],
    ...Array.from({ length: 5 }, (_, i) =>
      post(7400000000000002000n + BigInt(i), addDays('2026-09-01', 7 * i), 300, 1, 'someoneelse'),
    ),
  ];
}

export const MERGE_FIXTURES = {
  'syn-merge-a_2026-07-01_2026-09-30.xlsx': mergeA,
  'syn-merge-b_2026-07-15_2026-10-14.xlsx': mergeB,
  'syn-other-author_2026-09-01_2026-10-14.xlsx': otherAuthor,
} as const;
