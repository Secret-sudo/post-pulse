import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { closeSummary, expect, expected, importViaPicker, test } from './helpers.ts';

/** Playwright stores downloads without their name; restore needs a .json file name. */
const asBackupFile = (path: string) => ({
  name: 'postpulse-backup.json',
  mimeType: 'application/json',
  buffer: readFileSync(path),
});

type Insights = { insights: { file: string; posts: number; personalMedian: number } };
const fx = expected<Insights>('syn-insights.expected.json').insights;

const openSettings = (page: Page) =>
  page.getByRole('link', { name: 'Settings', exact: true }).click();
const kpiValue = (page: Page, id: string) =>
  page.locator(`[data-kpi="${id}"]`).getByTestId('kpi-value');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await importViaPicker(page, fx.file);
  await closeSummary(page);
});

/** The stored theme, read straight from IndexedDB: a reload must wait for the write. */
const storedTheme = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string | undefined>((resolve) => {
        const open = indexedDB.open('post-pulse');
        open.onsuccess = () => {
          const get = open.result.transaction('settings').objectStore('settings').get('app');
          get.onsuccess = () => {
            resolve((get.result as { theme?: string } | undefined)?.theme);
            open.result.close();
          };
        };
      }),
  );

test('TC-E12 theme switches, applies and survives a reload', async ({ page }) => {
  await openSettings(page);
  const html = page.locator('html');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const dark = await bg();
  await expect.poll(() => storedTheme(page)).toBe('dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('radio', { name: 'Light' }).check();
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect(await bg()).not.toBe(dark);

  await page.getByRole('radio', { name: 'Same as my device' }).check();
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  await expect.poll(() => storedTheme(page)).toBe('system');
  await page.reload();
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
});

test('thresholds change breakouts, with validation', async ({ page }) => {
  // W2 of the insight fixture: 1,200 / 1,000 / 1,200 are breakouts at 3× (900+), none at 5× (1,500+).
  await page.getByTestId('window-1').click();
  await expect(kpiValue(page, 'breakouts')).toHaveText('3');

  await openSettings(page);
  const breakout = page.getByLabel('Breakout at (× your median)');
  await breakout.fill('12');
  await page.getByLabel('Viral at (× your median)').fill('10');
  await expect(page.getByRole('alert')).toContainText('Viral must be higher than breakout.');
  await expect(page.getByRole('button', { name: 'Save thresholds' })).toBeDisabled();

  await breakout.fill('5');
  await expect(
    page.getByText(`5× your median (${fx.personalMedian}) = 1,500+ impressions`),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save thresholds' }).click();
  await expect(page.getByText('Thresholds saved.')).toBeVisible();

  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByTestId('window-1').click();
  await expect(kpiValue(page, 'breakouts')).toHaveText('0');
});

test('include growing posts by default changes the default view only', async ({ page }) => {
  await expect(page.locator('[data-kpi="medianImpressions"]')).toContainText('8 posts vs 8');
  await openSettings(page);
  await page.getByLabel('Include growing posts by default').check();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.locator('[data-kpi="medianImpressions"]')).toContainText('10 posts vs 8');
  await expect(page.getByRole('button', { name: 'Include growing posts' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Switching it off in the view is remembered in the URL, not in Settings.
  await page.getByRole('button', { name: 'Include growing posts' }).click();
  await expect(page).toHaveURL(/growing=0/);
  await expect(page.locator('[data-kpi="medianImpressions"]')).toContainText('8 posts vs 8');
});

test('TC-E09 backup → delete all (in-page confirmation) → restore gives back the same data and view', async ({
  page,
}) => {
  await openSettings(page);
  await page.getByRole('radio', { name: 'Dark' }).check();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  const summary = await page.getByTestId('history-summary').innerText();
  const median = await kpiValue(page, 'medianImpressions').innerText();

  await openSettings(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^postpulse-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = await download.path();
  const backup = JSON.parse(readFileSync(backupPath, 'utf8')) as { app: string; posts: unknown[] };
  expect(backup.app).toBe('post-pulse');
  expect(backup.posts).toHaveLength(fx.posts);

  // window.confirm is never used: the confirmation is an in-page dialog.
  page.on('dialog', () => {
    throw new Error('native dialog shown');
  });
  await page.getByRole('button', { name: 'Delete all data' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete all data?' });
  await expect(confirm).toContainText(`This deletes ${fx.posts} posts`);
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('import-history')).toBeVisible();

  await page.getByRole('button', { name: 'Delete all data' }).click();
  await page
    .getByRole('dialog', { name: 'Delete all data?' })
    .getByRole('button', { name: 'Delete all data' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /see what works/i })).toBeVisible();
  await expect(page.getByText('All data deleted.')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);

  await page.getByTestId('restore-input').setInputFiles(asBackupFile(backupPath));
  await expect(page.getByText(`Backup restored: ${fx.posts} new, 0 updated.`)).toBeVisible();
  await expect(page.getByTestId('history-summary')).toHaveText(summary);
  await expect(kpiValue(page, 'medianImpressions')).toHaveText(median);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('restoring over existing data asks merge or replace; bad files are rejected', async ({
  page,
}) => {
  await openSettings(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);
  await page.getByTestId('restore-input').setInputFiles(asBackupFile(await download.path()));
  const ask = page.getByRole('dialog', { name: 'Restore this backup' });
  await expect(ask).toContainText(`The backup has ${fx.posts} posts`);
  await ask.getByRole('button', { name: 'Merge' }).click();
  await expect(page.getByText('Backup restored: 0 new, 0 updated.')).toBeVisible();

  await page.getByTestId('restore-input').setInputFiles({
    name: 'not-a-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"something-else"}'),
  });
  const err = page.getByRole('dialog', { name: "This backup can't be used" });
  await expect(err).toContainText('This file is not a Post Pulse backup.');
  await err.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('import-history').locator('li')).toHaveCount(1);
});
