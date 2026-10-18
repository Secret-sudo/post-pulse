import type { Page } from '@playwright/test';
import { closeSummary, expect, expected, importViaPicker, test } from './helpers.ts';

type Insights = { insights: { file: string; posts: number } };
type Basic = { file: string; posts: number };
const fx = expected<Insights>('syn-insights.expected.json').insights;
const basic = expected<Basic>('syn-basic.expected.json');

/** Waits until a service worker is active and controls the page. */
async function controlledBySw(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))))
    await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

test('TC-E11 the app is installable: manifest, icons and an active service worker', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(href ?? '');
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(manifest).toMatchObject({
    name: 'Post Pulse',
    short_name: 'Post Pulse',
    start_url: '/',
    display: 'standalone',
  });
  expect(manifest.name).not.toMatch(/linkedin/i);

  for (const icon of manifest.icons) {
    const img = await request.get(icon.src);
    expect(img.headers()['content-type'], icon.src).toContain('image/png');
    const bytes = await img.body();
    const [w, h] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
  }
  expect(manifest.icons.map((i) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);

  await controlledBySw(page);
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.getRegistration())?.scope,
  );
  expect(new URL(scope ?? '').pathname).toBe('/');
});

test('TC-E10 after the first visit the whole app works offline', async ({ page, context }) => {
  await page.goto('/');
  await importViaPicker(page, fx.file);
  await closeSummary(page);
  await controlledBySw(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('history-summary')).toContainText(`${fx.posts} posts`);

  // Lazy chunks come from the cache too: charts, the posts table, and the parser worker.
  await page.getByRole('link', { name: 'Timeline', exact: true }).click();
  await expect(page.getByTestId('timeline-chart')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  await expect(page.getByTestId('posts-count')).toHaveText(`${fx.posts} of ${fx.posts} posts`);

  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await importViaPicker(page, basic.file, 'header-file-input');
  await expect(page.getByRole('dialog', { name: 'Import complete' })).toBeVisible();
  await expect(page.getByTestId('summary-new')).toContainText(String(basic.posts));

  // A deep link that was never visited still opens offline.
  await page.goto('/?view=breakdowns');
  await expect(page.getByRole('heading', { level: 1, name: 'Breakdowns' })).toBeVisible();
  await context.setOffline(false);
});
