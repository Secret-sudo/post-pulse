// Writes the committed synthetic fixtures to fixtures/synthetic/ (SPEC §11.2).
// Run with `npm run fixtures`. Output is deterministic; commit the result.

import { writeFileSync } from 'node:fs';
import { toXlsx } from '../tests/builders/f1.ts';
import { BASIC_FIXTURES } from './fixtures/basic.ts';
import { INSIGHT_FIXTURES } from './fixtures/insights.ts';
import { MERGE_FIXTURES } from './fixtures/merge.ts';
import { SECURITY_FIXTURES } from './fixtures/security.ts';

const OUT = 'fixtures/synthetic';

for (const [name, build] of Object.entries({
  ...BASIC_FIXTURES,
  ...MERGE_FIXTURES,
  ...INSIGHT_FIXTURES,
  ...SECURITY_FIXTURES,
})) {
  writeFileSync(`${OUT}/${name}`, toXlsx(build()));
  console.log(`wrote ${OUT}/${name}`);
}
