// TC-SC08 (SPEC §11.5): the share carousel dialog. For the insight fixture all
// five slides show, the falling momentum (−33 %) too; the user unticks slides
// they don't want, and the PDF holds only the ticked ones.
import { readFileSync } from 'node:fs';
import { closeSummary, expect, expected, importViaPicker, test } from './helpers.ts';

type Insights = { insights: { file: string } };
const fx = expected<Insights>('syn-insights.expected.json').insights;

test('TC-SC08 Share (Alpha): preview, theme, numbers choice and PDF download', async ({ page }) => {
  await page.goto('/');
  await importViaPicker(page, fx.file);
  await closeSummary(page);

  const open = page.getByRole('button', { name: 'Share Alpha' });
  await expect(open).toContainText('Alpha');
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Share your LinkedIn story' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('An early version');

  const slides = dialog.getByTestId('share-slide');
  await expect(slides).toHaveCount(5);
  expect(await slides.evaluateAll((cs) => cs.map((c) => (c as HTMLElement).dataset.kind))).toEqual([
    'cover',
    'lesson',
    'momentum',
    'recap',
    'closing',
  ]);
  await expect(dialog).toContainText('Every slide is included, good news and bad');

  // The slide background follows the chosen theme, not the app's.
  const corner = () =>
    slides
      .first()
      .evaluate((c) =>
        Array.from(
          (c as HTMLCanvasElement).getContext('2d')?.getImageData(5, 5, 1, 1).data ?? [],
        ).slice(0, 3),
      );
  await expect.poll(corner).toEqual([246, 245, 242]);
  await dialog.getByRole('radio', { name: 'Dark' }).check();
  await expect.poll(corner).toEqual([17, 20, 24]);

  await dialog.getByLabel('Show absolute numbers').uncheck();
  await dialog.getByTestId('share-include-momentum').uncheck();
  await expect(dialog.getByTestId('share-include-momentum')).not.toBeChecked();
  // The closing slide (app address) can't be left out.
  await expect(dialog.getByTestId('share-include-closing')).toHaveCount(0);
  await expect(dialog.getByTestId('share-closing-always')).toHaveText('Closing · always included');
  const downloading = page.waitForEvent('download');
  await dialog.getByTestId('share-download').click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe('post-pulse-carousel-2026-10-14.pdf');
  const pdf = readFileSync((await file.path()) ?? '').toString('latin1');
  expect(pdf.startsWith('%PDF-1.4')).toBe(true);
  expect(pdf).toContain('/Type /Pages /Count 4');
  expect(pdf.match(/\/Filter \/DCTDecode/g)).toHaveLength(4);

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});
