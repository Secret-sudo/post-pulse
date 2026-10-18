// TC-S07: checks that a deployed site sends the security headers from
// netlify.toml, and that its CSP equals src/security/csp.ts.
// Usage: node scripts/check-deploy-headers.ts https://deploy-preview-12--site.netlify.app
import { readFileSync } from 'node:fs';
import { CSP_HEADER_POLICY } from '../src/security/csp.ts';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/check-deploy-headers.ts <url>');
  process.exit(2);
}

// The first [headers.values] block in netlify.toml is the one for "/*".
const toml = readFileSync('netlify.toml', 'utf8');
const block = toml.split('[headers.values]')[1]?.split('[[')[0] ?? '';
const expected = new Map<string, string>();
for (const m of block.matchAll(/^\s*([\w-]+)\s*=\s*"(.*)"\s*$/gm)) {
  if (m[1] && m[2] !== undefined) expected.set(m[1].toLowerCase(), m[2]);
}
expected.set('content-security-policy', CSP_HEADER_POLICY);

const res = await fetch(url, { redirect: 'follow' });
const problems: string[] = [];
if (!res.ok) problems.push(`HTTP ${res.status}`);
for (const [name, value] of expected) {
  const got = res.headers.get(name);
  if (got !== value)
    problems.push(`${name}: expected "${value}", got ${got === null ? 'nothing' : `"${got}"`}`);
}

if (problems.length > 0) {
  console.error(`TC-S07 failed for ${url}:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`TC-S07 passed for ${url}: ${expected.size} headers match.`);
