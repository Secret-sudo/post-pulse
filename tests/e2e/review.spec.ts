// Review list of 17 Oct 2026: window sizes, labelled filters, sparkline details,
// full-screen timeline, rhythm by day/week/month, table bars, fixed viral threshold.
import type { Page } from '@playwright/test';
import { closeSummary, expect, expected, importViaPicker, test } from './helpers.ts';

type Insights = { insights: { file: string; posts: number } };
const fx = expected<Insights>('syn-insights.expected.json').insights;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await importViaPicker(page, fx.file);
  await closeSummary(page);
});

const kpi = (page: Page, id: string) => page.locator(`[data-kpi="${id}"]`);

test('says it is a beta for post performance only', async ({ page }) => {
  await expect(page.getByRole('banner')).toContainText('Beta');
  await expect(page.getByTestId('beta-note')).toContainText(
    'Post Pulse analyses your post performance export only',
  );
});

test('window length 7/30/90 days or all time, with labelled filter rows', async ({ page }) => {
  for (const label of ['Window length', 'Time window', 'Post types', 'Options']) {
    await expect(page.getByRole('group', { name: label })).toBeVisible();
  }
  await expect(page.getByTestId('window-0')).toContainText('Last 30 days');
  await expect(page.getByTestId('window-1')).toContainText('Previous 30 days');
  await expect(page.getByTestId('window-explain')).toContainText(
    'blocks of 30 days, counted back from your latest export (Oct 14, 2026)',
  );

  await page.getByTestId('size-7').click();
  await expect(page).toHaveURL(/size=7/);
  await expect(page.getByTestId('window-0')).toContainText('Last 7 days');
  // 20 Jul to 14 Oct is 13 weeks: 4 chips and the other 9 in a menu.
  await expect(page.getByTestId('window-older').locator('option')).toHaveCount(10);
  await page.getByTestId('window-older').selectOption({ index: 1 });
  await expect(page).toHaveURL(/w=4/);

  await page.getByTestId('size-all').click();
  await expect(page).toHaveURL(/size=all/);
  await expect(page.getByRole('group', { name: 'Time window' })).toHaveCount(0);
  // Median of all 24 mature posts.
  await expect(kpi(page, 'medianImpressions').getByTestId('kpi-value')).toHaveText('300');
  await expect(kpi(page, 'medianImpressions')).toContainText('No earlier window');

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).not.toHaveURL(/size=/);
});

test('"Include growing posts" explains itself', async ({ page }) => {
  const help = page.getByRole('button', { name: 'What are growing posts?' });
  await help.hover();
  await expect(page.getByRole('tooltip', { name: /still collecting impressions/ })).toBeVisible();
});

test('sparklines show dates and values for each week of the window', async ({ page }) => {
  const spark = kpi(page, 'medianImpressions').getByTestId('sparkline');
  await spark.scrollIntoViewIfNeeded();
  const box = await spark.boundingBox();
  if (!box) throw new Error('no sparkline');
  // Left end: 15–16 Sep, one mature post (200). Right end: 8–14 Oct, only growing posts.
  await spark.hover({ position: { x: 2, y: box.height / 2 } });
  await expect(spark.getByTestId('sparkline-tip')).toHaveText(
    'Sep 15 – Sep 16, 2026: 200 (1 post)',
  );
  await spark.hover({ position: { x: box.width - 2, y: box.height / 2 } });
  await expect(spark.getByTestId('sparkline-tip')).toHaveText('Oct 8 – Oct 14, 2026: – (0 posts)');
});

test('the timeline chart can fill the window and go back', async ({ page }) => {
  await page.getByRole('link', { name: 'Timeline', exact: true }).click();
  const chart = page.getByTestId('timeline-chart');
  await expect(chart).toHaveAttribute('data-ready', 'true');
  await page.getByTestId('chart-expand').click();
  await expect(page.getByTestId('timeline')).toHaveAttribute('data-expanded', 'true');
  await expect(page.getByTestId('chart-expand')).toHaveText(/Exit full screen/);
  expect((await page.getByTestId('timeline-chart').boundingBox())?.height).toBeGreaterThan(400);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('timeline')).not.toHaveAttribute('data-expanded', 'true');
  expect((await page.getByTestId('timeline-chart').boundingBox())?.height).toBe(380);
});

test('posting rhythm by day, week or month', async ({ page }) => {
  await page.getByRole('link', { name: 'Breakdowns', exact: true }).click();
  const rhythm = page.getByTestId('rhythm');
  await rhythm.getByText('Show data').click();
  await expect(rhythm.locator('details tbody tr')).toHaveCount(13);
  await page.getByTestId('period-month').click();
  await expect(page).toHaveURL(/period=month/);
  // July to October.
  await expect(rhythm.locator('details tbody tr')).toHaveCount(4);
  await expect(rhythm.locator('details thead')).toContainText('Posts per month');
  await expect(rhythm.locator('details tbody tr').first()).toContainText('Jul 2026');
  await page.getByTestId('period-day').click();
  // 20 Jul to 13 Oct: 12 + 31 + 30 + 13 days.
  await expect(rhythm.locator('details tbody tr')).toHaveCount(86);
});

test('reactions and comments have bars like impressions', async ({ page }) => {
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  await page.getByRole('button', { name: 'Impressions' }).click();
  // The 20,000-impression post has the most reactions (398) and comments (2).
  const top = page.locator('tbody tr[data-post]', { hasText: '20,000' });
  for (const col of ['impressions', 'reactions', 'comments']) {
    await expect(top.getByTestId(`bar-${col}`)).toHaveAttribute('style', /width: 100%/);
  }
  const other = page.locator('tbody tr[data-post]').filter({ hasNotText: '20,000' }).first();
  await expect(other.getByTestId('bar-comments')).toHaveAttribute('style', /width: (0|50)%/);
});

test('viral can be a fixed number of impressions, prefilled with 15,000', async ({ page }) => {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('a fixed number of impressions').check();
  const field = page.getByLabel('Viral at (impressions per post)');
  await expect(field).toHaveValue('15,000');
  await expect(page.getByText(/476,465 posts/)).toBeVisible();
  // 100 is the lowest allowed value; nothing is saved yet.
  await field.fill('100');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await field.fill('99');
  await expect(page.getByRole('alert')).toContainText('between 100 and 10,000,000');
  await field.fill('1,000');
  await page.getByRole('button', { name: 'Save thresholds' }).click();
  await expect(page.getByText('Thresholds saved.')).toBeVisible();

  // 1,000+ impressions: the 1,000, three 1,200 and the 20,000 post.
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  await page.getByRole('button', { name: 'Impressions' }).click();
  const rows = page.locator('tbody tr[data-post]');
  for (let i = 0; i < 5; i += 1) await expect(rows.nth(i)).toContainText('Viral');
  await expect(rows.nth(5)).not.toContainText('Viral');

  await page.reload();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('a fixed number of impressions')).toBeChecked();
  await expect(page.getByLabel('Viral at (impressions per post)')).toHaveValue('1,000');
});
