import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { closeSummary, expect, expected, fixturePath, importViaPicker, test } from './helpers.ts';

type Insights = { insights: { file: string; posts: number } };
const fx = expected<Insights>('syn-insights.expected.json').insights;

/** Fails on serious or critical WCAG 2.1 A/AA violations (SPEC §10.3). */
async function noSeriousViolations(page: Page, screen: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const bad = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(bad, `axe on ${screen}`).toEqual([]);
}

async function openView(page: Page, name: string, ready: Locator) {
  await page.getByRole('link', { name, exact: true }).click();
  await expect(ready).toBeVisible();
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`TC-E15 axe finds no serious or critical violations on any screen (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByText('How to export from LinkedIn').click();
    await expect(page.getByTestId('how-to').locator('img').first()).toBeVisible();
    await noSeriousViolations(page, 'welcome');

    await importViaPicker(page, fx.file);
    await expect(page.getByRole('dialog', { name: 'Import complete' })).toBeVisible();
    await noSeriousViolations(page, 'import summary');
    await closeSummary(page);
    await page.getByTestId('insights-toggle').click();
    await noSeriousViolations(page, 'overview with every insight');
    await page.getByTestId('share-open').click();
    await expect(page.getByTestId('share-slide').first()).toBeVisible();
    await noSeriousViolations(page, 'share dialog');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('size-all').click();
    await noSeriousViolations(page, 'overview, all time');
    await openView(page, 'Posts', page.getByTestId('posts-count'));
    await noSeriousViolations(page, 'posts');
    await openView(
      page,
      'Timeline',
      page.locator('[data-testid="timeline-chart"][data-ready="true"]'),
    );
    await noSeriousViolations(page, 'timeline');
    await openView(
      page,
      'Breakdowns',
      page.locator('[data-testid="rhythm-chart"][data-ready="true"]'),
    );
    await noSeriousViolations(page, 'breakdowns');
    await openView(page, 'Settings', page.getByRole('button', { name: 'Delete all data' }));
    await page.getByLabel('a fixed number of impressions').check();
    await noSeriousViolations(page, 'settings');

    await page.getByRole('button', { name: 'Delete all data' }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete all data?' });
    await expect(confirm).toBeVisible();
    await noSeriousViolations(page, 'delete confirmation');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
  });
}

/** Presses Tab until `target` has focus, then checks the focus ring is visible. */
async function tabTo(page: Page, target: Locator, max = 120) {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) {
      const ring = await target.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          visible: el.matches(':focus-visible'),
          style: s.outlineStyle,
          width: parseFloat(s.outlineWidth),
        };
      });
      expect(ring.visible, 'focus is visible').toBe(true);
      expect(ring.style).not.toBe('none');
      expect(ring.width).toBeGreaterThan(0);
      return;
    }
  }
  throw new Error(`Tab never reached ${target.toString()}`);
}

test('TC-E14 keyboard only: import, switch tabs, open an insight, sort the table', async ({
  page,
}) => {
  await page.goto('/');

  // Import: the button opens the file picker.
  await tabTo(page, page.getByRole('button', { name: 'Import LinkedIn export' }).first());
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooser).setFiles(fixturePath(fx.file));
  const summary = page.getByRole('dialog', { name: 'Import complete' });
  await expect(summary).toBeVisible();
  await tabTo(page, summary.getByRole('button', { name: 'Show dashboard' }));
  await page.keyboard.press('Enter');
  await expect(summary).toHaveCount(0);

  // Switch tabs and come back.
  await tabTo(page, page.getByRole('link', { name: 'Timeline', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/view=timeline/);
  await tabTo(page, page.getByRole('link', { name: 'Overview', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/view=/);

  // Show every insight, then open one.
  await tabTo(page, page.getByTestId('insights-toggle'));
  await page.keyboard.press('Enter');
  await tabTo(
    page,
    page
      .locator('[data-insight="weak_format:Repost"]')
      .getByRole('button', { name: 'Show these posts' }),
  );
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/view=posts/);
  await expect(page.getByTestId('posts-count')).toHaveText(`3 of ${fx.posts} posts`);

  // Sort the table.
  await tabTo(page, page.getByRole('button', { name: 'Impressions' }));
  await page.keyboard.press('Enter');
  await expect(page.locator('th', { hasText: 'Impressions' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  await page.keyboard.press('Space');
  await expect(page.locator('th', { hasText: 'Impressions' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
});
