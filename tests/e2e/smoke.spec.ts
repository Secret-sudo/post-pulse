import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { CSP_META_POLICY } from '../../src/security/csp.ts';

test.describe('app shell', () => {
  test('TC-S01 loads without any request to another origin', async ({ page, baseURL }) => {
    const appOrigin = new URL(baseURL ?? 'http://localhost:4173').origin;
    const foreign: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.protocol.startsWith('http') && url.origin !== appOrigin) foreign.push(req.url());
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Not affiliated with LinkedIn Corporation.')).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(foreign).toEqual([]);
  });

  test('TC-S02 production index.html carries the exact CSP meta tag', async ({ page }) => {
    await page.goto('/');
    const content = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(content).toBe(CSP_META_POLICY);
  });

  test('page reports no CSP violations or console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});

test('the export guide shows four redacted screenshots that load', async ({ page }) => {
  await page.goto('/');
  await page.getByText('How to export from LinkedIn').click();
  const shots = page.getByTestId('how-to').locator('img');
  await expect(shots).toHaveCount(4);
  for (const shot of await shots.all()) {
    await shot.scrollIntoViewIfNeeded();
    await expect(shot).toHaveAttribute('alt', /marked/);
    await expect
      .poll(() => shot.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
  }
});

test('TC-N03 SheetJS and ECharts are lazy chunks, not part of the initial load', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const assets = readdirSync('dist/assets');
  const initial = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1] ?? '');
  expect(initial.some((f) => f.startsWith('index-'))).toBe(true);
  for (const lib of ['xlsx', 'echarts']) {
    expect(
      assets.some((f) => f.startsWith(`${lib}-`) && f.endsWith('.js')),
      `${lib} chunk`,
    ).toBe(true);
    expect(
      initial.filter((f) => f.startsWith(`${lib}-`)),
      `${lib} in index.html`,
    ).toEqual([]);
    for (const entry of assets.filter((f) => /^index-.*\.js$/.test(f))) {
      const code = readFileSync(`dist/assets/${entry}`, 'utf8');
      expect(code, `static import of ${lib}`).not.toMatch(new RegExp(`from\\s*"\\./${lib}-`));
    }
  }
});
