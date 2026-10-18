// @vitest-environment node
import { EN_HEADERS, f1Rows, toXlsx } from '../../tests/builders/f1.ts';
import { checkFile, importFile, MAX_FILE_BYTES } from './importFile.ts';

const FILE = 'PostPerformance_2026-07-17_2026-10-14.xlsx';

const errorCode = async (bytes: Uint8Array, name = FILE) => {
  const r = await importFile(bytes, name);
  return r.ok ? 'ok' : r.error.code;
};

describe('file guards and workbook reading (SPEC §10.2, §9.2)', () => {
  it('reads a synthetic export end to end', async () => {
    const r = await importFile(toXlsx(f1Rows([{}, { 'Post type': 'Video' }])), FILE);
    expect(r.ok && r.posts.map((p) => p.postType)).toEqual(['Image', 'Video']);
    expect(r.ok && r.sheetName).toBe('POST PERFORMANCE');
  });

  it('TC-P16 rejects files over 20 MB before reading them', async () => {
    expect(checkFile(FILE, MAX_FILE_BYTES)).toBeNull();
    expect(checkFile(FILE, MAX_FILE_BYTES + 1)?.code).toBe('too-large');
    expect(await errorCode(new Uint8Array(MAX_FILE_BYTES + 1))).toBe('too-large');
  });

  it('TC-P16 rejects .xlsm, .csv and other extensions with their own message', () => {
    const codes = ['export.xlsm', 'export.csv', 'export.xls', 'export.txt', 'export'].map(
      (n) => checkFile(n, 100)?.code,
    );
    expect(codes).toEqual([
      'macro-enabled',
      'csv-not-supported',
      'unsupported-type',
      'unsupported-type',
      'unsupported-type',
    ]);
    expect(checkFile('EXPORT.XLSX', 100)).toBeNull();
  });

  it('TC-P16 rejects an .xlsx that is not a ZIP workbook', async () => {
    expect(await errorCode(new TextEncoder().encode('Post URL,Impressions\n'))).toBe('not-xlsx');
    expect(await errorCode(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]))).toBe('not-xlsx');
  });

  it('TC-P16 recognises password-protected workbooks', async () => {
    const cfb = new Uint8Array(512);
    cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(await errorCode(cfb)).toBe('password-protected');
  });

  it('TC-P16 reports a header-only export as empty', async () => {
    expect(await errorCode(toXlsx([[...EN_HEADERS]]))).toBe('empty');
  });

  it('TC-P13 lists the headers it found when the format is unknown', async () => {
    const r = await importFile(
      toXlsx(
        [
          ['Date', 'Clicks'],
          ['10/1/2026', '5'],
        ],
        'Sheet1',
      ),
      FILE,
    );
    expect(r).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'unknown-headers', headersFound: ['Date', 'Clicks'] }),
    });
  });

  it('picks the first F1 sheet, whatever its name', async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Notes'], ['hello']]), 'Readme');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(f1Rows([{}])), 'Data');
    const bytes = new Uint8Array(
      XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer,
    );
    const r = await importFile(bytes, FILE);
    expect(r.ok && r.sheetName).toBe('Data');
  });

  it('TC-P05 accepts native numbers and dates in cells', async () => {
    const r = await importFile(
      toXlsx(
        f1Rows([
          {
            'Post Publish Date': new Date(2026, 9, 1),
            Impressions: 1234,
            'Impressions (out-of-network)': 0.25,
          },
        ]),
      ),
      FILE,
    );
    expect(r.ok && r.posts[0]).toMatchObject({
      publishDate: '2026-10-01',
      metrics: { impressions: 1234, outOfNetworkPct: 25 },
    });
  });
});
