import {
  closeSummary,
  dropFile,
  expect,
  expected,
  importBuffer,
  importViaPicker,
  test,
} from './helpers.ts';

type Basic = {
  file: string;
  posts: number;
  rangeStart: string;
  rangeEnd: string;
  earliestPost: string;
};
type Merge = {
  a: { file: string; posts: number };
  b: { file: string };
  aThenB: {
    importB: { postsNew: number; postsUpdated: number; postsUnchanged: number };
    totalPosts: number;
  };
  otherAuthor: { file: string };
};

const basic = expected<Basic>('syn-basic.expected.json');
const merge = expected<Merge>('syn-merge.expected.json');

async function expectSummary(
  page: import('@playwright/test').Page,
  counts: [number, number, number],
) {
  const dialog = page.getByRole('dialog', { name: 'Import complete' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('summary-new')).toContainText(String(counts[0]));
  await expect(dialog.getByTestId('summary-updated')).toContainText(String(counts[1]));
  await expect(dialog.getByTestId('summary-unchanged')).toContainText(String(counts[2]));
  return dialog;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /see what works/i })).toBeVisible();
});

test('TC-E01 sample data loads with a banner and can be removed', async ({ page }) => {
  await page.getByRole('button', { name: 'Try with sample data' }).click();
  await expect(page.getByTestId('sample-banner')).toBeVisible();
  await expect(page.getByTestId('insight-list').locator('li')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Remove sample data' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /see what works/i })).toBeVisible();
  await expect(page.getByText('Sample data removed.')).toBeVisible();
});

test('TC-E02 imports an export through the file picker', async ({ page }) => {
  await importViaPicker(page, basic.file);
  const dialog = await expectSummary(page, [basic.posts, 0, 0]);
  await expect(dialog).toContainText(`Export range: ${basic.rangeStart} to ${basic.rangeEnd}`);
  await expect(dialog).toContainText('Keep a backup');
  await closeSummary(page);
  await expect(page.getByTestId('history-summary')).toHaveText(
    `${basic.posts} posts · ${basic.earliestPost} to ${basic.rangeEnd}`,
  );
});

test('TC-E02 imports an export dropped on the drop zone', async ({ page }) => {
  await dropFile(page, basic.file);
  await expectSummary(page, [basic.posts, 0, 0]);
});

test('TC-E03 merges an overlapping second export', async ({ page }) => {
  await importViaPicker(page, merge.a.file);
  await expectSummary(page, [merge.a.posts, 0, 0]);
  await closeSummary(page);
  await importViaPicker(page, merge.b.file, 'header-file-input');
  const b = merge.aThenB.importB;
  await expectSummary(page, [b.postsNew, b.postsUpdated, b.postsUnchanged]);
  await closeSummary(page);
  await expect(page.getByTestId('history-summary')).toContainText(
    `${merge.aThenB.totalPosts} posts`,
  );
});

test('TC-E04 importing the same file twice says "Already imported"', async ({ page }) => {
  await importViaPicker(page, basic.file);
  await closeSummary(page);
  await importViaPicker(page, basic.file, 'header-file-input');
  await expect(page.getByText(`Already imported: ${basic.file} is in your history.`)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('TC-E05 unknown headers list the columns found and copy the details', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await importViaPicker(page, 'syn-unknown-headers.xlsx');
  const dialog = page.getByRole('dialog', { name: "We don't recognise this export" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('headers-found').locator('li')).toHaveText([
    'Date',
    'Clicks',
    'Likes',
  ]);
  await dialog.getByRole('button', { name: 'Copy details' }).click();
  await expect(dialog.getByRole('button', { name: 'Details copied' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Error: unknown-headers');
  expect(copied).toContain('Columns found: Date | Clicks | Likes');
});

test('TC-E05 empty, CSV and non-xlsx files get their own message', async ({ page }) => {
  const cases: [() => Promise<void>, string][] = [
    [() => importViaPicker(page, 'syn-empty.xlsx'), 'This export is empty'],
    [
      () => importBuffer(page, 'export.csv', Buffer.from('Post URL,Impressions\n')),
      "CSV files aren't supported yet",
    ],
    [() => importBuffer(page, 'notes.txt', Buffer.from('hello')), "This isn't an .xlsx file"],
    [() => importBuffer(page, 'fake.xlsx', Buffer.from('not a zip')), "This file can't be opened"],
  ];
  for (const [doImport, title] of cases) {
    await doImport();
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await expect(page.getByRole('heading', { level: 1, name: /see what works/i })).toBeVisible();
});

test('asks before importing another profile and changes nothing on cancel', async ({ page }) => {
  await importViaPicker(page, merge.a.file);
  await closeSummary(page);
  await importViaPicker(page, merge.otherAuthor.file, 'header-file-input');
  const dialog = page.getByRole('dialog', { name: 'This file seems to be from another profile' });
  await expect(dialog).toContainText('sample');
  await expect(dialog).toContainText('someoneelse');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Import cancelled. Nothing was changed.')).toBeVisible();
  await expect(page.getByTestId('history-summary')).toContainText(`${merge.a.posts} posts`);
});

test('a real import replaces the sample data', async ({ page }) => {
  await page.getByRole('button', { name: 'Try with sample data' }).click();
  await expect(page.getByTestId('sample-banner')).toBeVisible();
  await importViaPicker(page, basic.file, 'header-file-input');
  const dialog = await expectSummary(page, [basic.posts, 0, 0]);
  await expect(dialog).toContainText('The sample data was removed');
  await closeSummary(page);
  await expect(page.getByTestId('sample-banner')).toHaveCount(0);
  await expect(page.getByTestId('history-summary')).toContainText(`${basic.posts} posts`);
});
