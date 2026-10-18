// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { parse } from 'smol-toml';
import { CSP_HEADER_POLICY, CSP_META_POLICY } from '../../src/security/csp.ts';

type NetlifyConfig = {
  headers: { for: string; values: Record<string, string> }[];
};

describe('security configuration (SPEC §10.2)', () => {
  const netlify = parse(readFileSync('netlify.toml', 'utf8')) as unknown as NetlifyConfig;
  const rootHeaders = netlify.headers.find((h) => h.for === '/*')?.values ?? {};

  it('TC-S03 netlify.toml sends the CSP header equal to the meta policy plus frame-ancestors', () => {
    expect(rootHeaders['Content-Security-Policy']).toBe(CSP_HEADER_POLICY);
    expect(CSP_HEADER_POLICY).toBe(`${CSP_META_POLICY}; frame-ancestors 'none'`);
  });

  it('TC-S03 netlify.toml sends the other required security headers', () => {
    expect(rootHeaders).toMatchObject({
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
    const sw = netlify.headers.find((h) => h.for === '/sw.js')?.values ?? {};
    expect(sw['Cache-Control']).toBe('no-cache');
  });

  it('TC-S05 no real export data is tracked by git', () => {
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
    const offending = tracked.filter(
      (f) =>
        f.startsWith('docs/data/') ||
        (/\.(xlsx|xls|xlsm|csv)$/i.test(f) && !f.startsWith('fixtures/synthetic/')),
    );
    expect(offending).toEqual([]);
  });

  it('TC-S05 docs/data/ and stray spreadsheets are gitignored', () => {
    const probe = ['docs/data/x.xlsx', 'fixtures/private/x.xlsx', 'src/x.csv', '~$lock.xlsx'];
    const ignored = execFileSync('git', ['check-ignore', ...probe], { encoding: 'utf8' })
      .trim()
      .split('\n');
    expect(ignored).toEqual(probe);
  });

  it('TC-S05 synthetic fixtures stay committable', () => {
    const res = spawnSync('git', ['check-ignore', '-q', 'fixtures/synthetic/syn-basic-en.xlsx']);
    expect(res.status).toBe(1); // 1 = not ignored
  });

  describe('TC-S06 lint rules block HTML and code injection', () => {
    const eslint = new ESLint();
    const cases: [string, string][] = [
      [
        'dangerouslySetInnerHTML',
        'export const A = () => <div dangerouslySetInnerHTML={{ __html: "x" }} />;',
      ],
      ['innerHTML', 'export function f(el: HTMLElement, s: string) { el.innerHTML = s; }'],
      [
        'insertAdjacentHTML',
        'export function f(el: HTMLElement, s: string) { el.insertAdjacentHTML("beforeend", s); }',
      ],
      ['eval', 'export function f(s: string) { return eval(s); }'],
      ['new Function', 'export function f(s: string) { return new Function(s); }'],
    ];
    it.each(cases)('rejects %s', async (_name, code) => {
      const [result] = await eslint.lintText(code, { filePath: 'src/probe.tsx' });
      expect(result?.errorCount).toBeGreaterThan(0);
    });
  });
});
