import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';

/** Every test fails if the page talks to any other origin (TC-S01, SPEC §10.2). */
export const test = base.extend<{ foreignRequests: string[] }>({
  foreignRequests: [
    async ({ page, baseURL }, use) => {
      const appOrigin = new URL(baseURL ?? 'http://localhost:4173').origin;
      const foreign: string[] = [];
      page.on('request', (req) => {
        const url = new URL(req.url());
        if (url.protocol.startsWith('http') && url.origin !== appOrigin) foreign.push(req.url());
      });
      await use(foreign);
      expect(foreign, 'requests to other origins').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const fixturePath = (name: string) => `fixtures/synthetic/${name}`;

export function expected<T = Record<string, unknown>>(name: string): T {
  return JSON.parse(readFileSync(fixturePath(name), 'utf8')) as T;
}

export async function importViaPicker(page: Page, file: string, input = 'file-input') {
  await page.getByTestId(input).setInputFiles(fixturePath(file));
}

export async function importBuffer(page: Page, name: string, buffer: Buffer, input = 'file-input') {
  await page
    .getByTestId(input)
    .setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
}

/** Simulates dropping a file on the drop zone, as a user dragging from Finder would. */
export async function dropFile(page: Page, file: string) {
  const bytes = readFileSync(fixturePath(file)).toString('base64');
  const name = file.split('/').at(-1) ?? file;
  const dataTransfer = await page.evaluateHandle(
    ({ b64, fileName }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bin], fileName));
      return dt;
    },
    { b64: bytes, fileName: name },
  );
  const zone = page.getByTestId('drop-zone');
  await zone.dispatchEvent('dragover', { dataTransfer });
  await zone.dispatchEvent('drop', { dataTransfer });
}

export async function closeSummary(page: Page) {
  await page.getByRole('button', { name: 'Show dashboard' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
