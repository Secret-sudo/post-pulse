import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { EN_HEADERS, f1Row, toXlsx } from '../builders/f1.ts';
import { XSS_IDS } from '../../scripts/fixtures/security.ts';
import { closeSummary, expect, expected, importBuffer, importViaPicker, test } from './helpers.ts';

type Insights = { insights: { file: string; posts: number } };
const fx = expected<Insights>('syn-insights.expected.json').insights;

const openPosts = (page: Page) => page.getByRole('link', { name: 'Posts', exact: true }).click();
const rows = (page: Page) => page.locator('tbody tr[data-post]');

function largeExport(n: number): { name: string; buffer: Buffer; oldestId: string } {
  const start = Date.UTC(2019, 0, 1);
  const day = (i: number) => new Date(start + Math.floor(i / 3) * 86_400_000);
  const us = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const id = (i: number) => String(7410000000000000000n + BigInt(i));
  const data = Array.from({ length: n }, (_, i) =>
    f1Row({
      'Post URL': `https://www.linkedin.com/posts/sample_large-post-${i}-ugcPost-${id(i)}-Lrg`,
      'Post Publish Date': us(day(i)),
      Impressions: String(100 + ((i * 7919) % 5000)),
    }),
  );
  const end = day(n - 1);
  return {
    name: `syn-large-${n}_${iso(new Date(start))}_${iso(end)}.xlsx`,
    buffer: Buffer.from(toXlsx([[...EN_HEADERS], ...data])),
    oldestId: id(0),
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('TC-E07 posts table sorts, searches and exports exactly what it shows', async ({ page }) => {
  await importViaPicker(page, fx.file);
  await closeSummary(page);
  await openPosts(page);
  await expect(page.getByTestId('posts-count')).toHaveText(`${fx.posts} of ${fx.posts} posts`);

  await page.getByRole('button', { name: 'Impressions' }).click();
  await expect(page.locator('th', { hasText: 'Impressions' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  await expect(rows(page).first()).toContainText('20,000');
  await expect(rows(page).first()).toContainText('Viral');
  await page.getByRole('button', { name: 'Impressions' }).click();
  await expect(page.locator('th', { hasText: 'Impressions' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await expect(rows(page).first()).toContainText('100');

  await page.getByTestId('posts-search').fill('aiagents');
  await expect(page.getByTestId('posts-count')).toHaveText(`3 of ${fx.posts} posts`);
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).first()).toContainText('Hashtag opener');
  await expect(page).toHaveURL(/q=aiagents/);
  await expect(page).toHaveURL(/sort=impressions&dir=asc/);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^postpulse-posts-\d{4}-\d{2}-\d{2}\.csv$/);
  const lines = readFileSync(await download.path(), 'utf8')
    .trimEnd()
    .split('\r\n');
  expect(lines[0]).toBe(
    'Publish date,Post type,Title,Impressions,Outside network %,Reactions,Comments,Reposts,Saves,Engagement rate %,Status,Post URL',
  );
  expect(lines).toHaveLength(4);
  expect(lines.slice(1).every((l) => l.includes('aiagents enterpriseai leadership'))).toBe(true);

  await page.reload();
  await expect(page.getByTestId('posts-search')).toHaveValue('aiagents');
  await expect(rows(page)).toHaveCount(3);
});

test('TC-S04 hostile titles, types and links stay plain text', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  await importViaPicker(page, 'syn-xss_2026-07-17_2026-10-14.xlsx');
  await closeSummary(page);
  await openPosts(page);

  const html = page.locator(`tr[data-post="${XSS_IDS.html}"]`);
  await expect(html).toContainText('<img src=x onerror=alert(1)>');
  await expect(html).toContainText('Other');
  await expect(page.locator('main img')).toHaveCount(0);
  await expect(page.locator('main b')).toHaveCount(0);

  const script = page.locator(`tr[data-post="${XSS_IDS.script}"]`);
  await expect(script).toBeVisible();
  await expect(script.locator('a')).toHaveCount(0);
  await expect(page.locator('a[href^="javascript"]')).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  const csv = readFileSync(await download.path(), 'utf8');
  expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"",""click"")"`);
  expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  expect(dialogs).toEqual([]);
});

test('TC-N01 a 1,000-post export imports quickly', async ({ page }) => {
  const big = largeExport(1000);
  const start = Date.now();
  await importBuffer(page, big.name, big.buffer);
  await expect(page.getByRole('dialog', { name: 'Import complete' })).toBeVisible({
    timeout: 10_000,
  });
  const ms = Date.now() - start;
  // SPEC §10.3: < 2 s on a mid-range laptop; CI runners get twice the budget (SPEC §11.6).
  expect(ms).toBeLessThan(process.env.CI ? 4000 : 2000);
  await expect(page.getByTestId('summary-new')).toContainText('1,000');
});

test('TC-N02 5,000 posts render fewer than 100 rows and scroll to the end', async ({ page }) => {
  const big = largeExport(5000);
  await importBuffer(page, big.name, big.buffer);
  await expect(page.getByRole('dialog', { name: 'Import complete' })).toBeVisible({
    timeout: 20_000,
  });
  await closeSummary(page);
  await openPosts(page);
  await expect(page.getByTestId('posts-count')).toHaveText('5,000 of 5,000 posts');
  expect(await rows(page).count()).toBeLessThan(100);

  await page.getByTestId('posts-scroller').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.locator(`tr[data-post="${big.oldestId}"]`)).toBeVisible();
  expect(await rows(page).count()).toBeLessThan(100);
});
