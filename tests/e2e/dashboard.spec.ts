import { closeSummary, expect, expected, importViaPicker, test } from './helpers.ts';
import type { Page } from '@playwright/test';

type Insights = { insights: { file: string; posts: number } };
const fx = expected<Insights>('syn-insights.expected.json').insights;

const kpi = (page: Page, id: string) => page.locator(`[data-kpi="${id}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await importViaPicker(page, fx.file);
  await closeSummary(page);
});

test('overview shows KPI tiles for the last 30 days against the 30 before', async ({ page }) => {
  // Hand-derived (syn-insights.expected.json): W3 median 200 vs W2 300, 0 breakouts vs 3.
  const imp = kpi(page, 'medianImpressions');
  await expect(imp.getByTestId('kpi-value')).toHaveText('200');
  await expect(imp.getByTestId('kpi-change')).toContainText('▼ 33.3 %');
  await expect(imp.getByTestId('kpi-status')).toHaveText('Down sharply');
  await expect(imp).toContainText('8 posts vs 8');
  await expect(kpi(page, 'breakouts').getByTestId('kpi-value')).toHaveText('0');
  await expect(kpi(page, 'engagementRate').getByTestId('kpi-value')).toHaveText('2.0 %');
  await expect(kpi(page, 'engagementRate').getByTestId('kpi-status')).toHaveText('Flat');
  await expect(page.getByTestId('takeaway')).toContainText(
    'Your typical post reaches fewer people: 300 → 200',
  );
  await expect(page.getByTestId('best-0')).toContainText('600 impressions');
});

test('TC-E06 window, post type and growing posts survive a reload via the URL', async ({
  page,
}) => {
  await page.getByTestId('window-1').click();
  await page.getByRole('button', { name: 'Repost', exact: true }).click();
  await page.getByRole('button', { name: 'Include growing posts' }).click();
  await expect(page).toHaveURL(/w=1/);

  const url = new URL(page.url());
  expect([...url.searchParams.keys()].sort()).toEqual(['growing', 'types', 'w']);
  expect(url.search).not.toMatch(/linkedin|ugcPost|sample_/i);

  await page.reload();
  await expect(page.getByTestId('window-1')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Repost', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Include growing posts' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // W2 has a single repost with 100 impressions.
  await expect(kpi(page, 'medianImpressions').getByTestId('kpi-value')).toHaveText('100');
  await expect(page.getByTestId('filtered-count')).toHaveText(`Showing 3 of ${fx.posts} posts.`);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('TC-E08 clicking an insight applies its filter', async ({ page }) => {
  // The overview shows five; the rest are one click away (SPEC §7 "Prioritising").
  const list = page.getByTestId('insight-list');
  await expect(list.locator('li')).toHaveCount(5);
  await expect(page.getByRole('link', { name: 'Insights' })).toHaveCount(0);
  const toggle = page.getByTestId('insights-toggle');
  await expect(toggle).toHaveText('Show 8 more');
  await toggle.click();
  await expect(list.locator('li')).toHaveCount(13);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const card = page.locator('[data-insight="weak_format:Repost"]');
  await expect(card).toContainText('Reposts reach 67 % fewer people than your typical post.');
  await card.getByRole('button', { name: 'Show these posts' }).click();

  // A post-type insight opens the posts table filtered to that type.
  await expect(page).toHaveURL(/view=posts/);
  await expect(page).toHaveURL(/types=Repost/);
  await expect(page.getByRole('button', { name: 'Repost', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('posts-count')).toHaveText(`3 of ${fx.posts} posts`);

  // A window-level insight opens the overview.
  await page.goBack();
  await page
    .locator('[data-insight="reach_decline"]')
    .getByRole('button', { name: 'Show these posts' })
    .click();
  await expect(page).not.toHaveURL(/view=/);
  await expect(page.getByTestId('takeaway')).toBeVisible();
});
