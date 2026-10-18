import type { Page } from '@playwright/test';
import { closeSummary, expect, expected, importViaPicker, test } from './helpers.ts';

type Insights = { insights: { file: string; posts: number; eligiblePosts: number } };
const fx = expected<Insights>('syn-insights.expected.json').insights;

const tab = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await importViaPicker(page, fx.file);
  await closeSummary(page);
});

test('ECharts loads only when a chart is shown (SPEC §10.3)', async ({ page }) => {
  const chunks: string[] = [];
  page.on('request', (r) => {
    if (/\/assets\/echarts-[^/]+\.js$/.test(new URL(r.url()).pathname)) chunks.push(r.url());
  });
  await page.reload();
  await expect(page.getByTestId('takeaway')).toBeVisible();
  expect(chunks).toEqual([]);
  await tab(page, 'Timeline');
  await expect(page.getByTestId('timeline-chart')).toHaveAttribute('data-ready', 'true');
  expect(chunks).toHaveLength(1);
});

test('timeline plots every counted post and switches metric and scale via the URL', async ({
  page,
}) => {
  await tab(page, 'Timeline');
  const chart = page.getByTestId('timeline-chart');
  await expect(chart).toHaveAttribute('data-ready', 'true');
  await expect(chart.locator('svg')).toHaveCount(1);
  await expect(chart).toHaveAttribute('aria-label', /Timeline of 24 posts by Impressions/);

  const frame = page.getByTestId('timeline');
  await frame.getByText('Show data').click();
  await expect(frame.locator('details tbody tr')).toHaveCount(fx.eligiblePosts);

  await page.getByRole('button', { name: 'Include growing posts' }).click();
  await expect(frame.locator('details tbody tr')).toHaveCount(fx.posts);

  await page.getByRole('button', { name: 'Members reached' }).click();
  await expect(page).toHaveURL(/metric=reach/);
  await page.getByRole('button', { name: 'Log scale' }).click();
  await expect(page).toHaveURL(/scale=linear/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Members reached' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Log scale' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('breakdowns rank formats, bucket outside-network reach and show the weekly rhythm', async ({
  page,
}) => {
  await tab(page, 'Breakdowns');
  // Hand-derived from syn-insights.expected.json's design: 24 counted posts, overall median 300.
  const tiers = page.getByTestId('format-tiers').locator('tbody tr');
  await expect(tiers).toHaveCount(3);
  await expect(tiers.nth(0)).toContainText('Video');
  await expect(tiers.nth(0)).toContainText('1,200');
  await expect(tiers.nth(0)).toContainText('4×');
  await expect(tiers.nth(1)).toContainText('Image');
  await expect(tiers.nth(1)).toContainText('250');
  await expect(tiers.nth(2)).toContainText('Repost');
  await expect(tiers.nth(2)).toContainText('100');

  const buckets = page.getByTestId('oon-buckets').locator('tbody tr');
  await expect(buckets).toHaveCount(4);
  const cells = async (i: number) =>
    (await buckets.nth(i).locator('th, td').allInnerTexts()).slice(0, 3).join(' | ');
  expect(await cells(0)).toMatch(/^0–40 % \| 17 \| 200$/);
  expect(await cells(1)).toMatch(/^41–60 % \| 6 \| 1,100$/);
  expect(await cells(2)).toMatch(/^61–80 %\s*too few posts \| 0 \| –$/);
  expect(await cells(3)).toMatch(/^81–100 %\s*too few posts \| 1 \| 20,000$/);

  const rhythm = page.getByTestId('rhythm');
  await expect(page.getByTestId('rhythm-chart')).toHaveAttribute('data-ready', 'true');
  await rhythm.getByText('Show data').click();
  // ISO weeks from Mon 2026-07-20 to Mon 2026-10-12, gaps included.
  await expect(rhythm.locator('details tbody tr')).toHaveCount(13);
});

test('TC-E13 no horizontal page scroll at 360 px on any view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const view of [
    '',
    '?size=7',
    '?view=timeline',
    '?view=breakdowns&period=day',
    '?view=posts',
    '?view=settings',
  ]) {
    await page.goto(`/${view}`);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, view || 'overview').toBeLessThanOrEqual(0);
  }
});
