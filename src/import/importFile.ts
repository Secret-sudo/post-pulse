// Entry point: file bytes → parsed F1 export or a friendly error (SPEC §4, §10.2).
// SheetJS is loaded on demand so it stays out of the initial bundle (SPEC §10.3).

import { detectF1 } from './detect.ts';
import { parseF1 } from './parseF1.ts';
import type { Cell, ImportError, ImportResult } from './types.ts';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
/** Encrypted (password-protected) OOXML files are OLE compound files. */
const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);

const fail = (error: ImportError): ImportResult => ({ ok: false, error });

/** Checks that need only the name and size, so they can run before reading the file. */
export function checkFile(fileName: string, size: number): ImportError | null {
  const ext = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? '';
  if (ext === 'xlsm') {
    return {
      code: 'macro-enabled',
      message:
        'Macro-enabled Excel files (.xlsm) are not accepted. Use the .xlsx file LinkedIn gives you.',
    };
  }
  if (ext === 'csv') {
    return {
      code: 'csv-not-supported',
      message: 'CSV files are not supported yet. Export the .xlsx file from LinkedIn instead.',
    };
  }
  if (ext !== 'xlsx') {
    return {
      code: 'unsupported-type',
      message: 'This is not an .xlsx file. Choose the export file you downloaded from LinkedIn.',
    };
  }
  if (size > MAX_FILE_BYTES) {
    return {
      code: 'too-large',
      message: 'This file is larger than 20 MB, which is far more than a LinkedIn export.',
    };
  }
  return null;
}

export async function importFile(bytes: Uint8Array, fileName: string): Promise<ImportResult> {
  const precheck = checkFile(fileName, bytes.byteLength);
  if (precheck) return fail(precheck);

  if (startsWith(bytes, CFB_SIGNATURE)) {
    return fail({
      code: 'password-protected',
      message: 'This file is password-protected. Remove the password in Excel and try again.',
    });
  }
  if (!startsWith(bytes, ZIP_SIGNATURE)) {
    return fail({ code: 'not-xlsx', message: 'This file is not a valid .xlsx workbook.' });
  }

  const XLSX = await import('xlsx');
  let workbook: ReturnType<typeof XLSX.read>;
  try {
    workbook = XLSX.read(bytes, { type: 'array', cellDates: true, dense: true });
  } catch {
    return fail({
      code: 'not-xlsx',
      message: 'This file could not be opened as an .xlsx workbook.',
    });
  }

  let firstHeaders: string[] | undefined;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    });
    const headerRow = rows[0];
    if (!headerRow) continue;
    const detection = detectF1(headerRow);
    firstHeaders ??= detection.headersFound.filter((h) => h !== '');
    if (detection.isF1) return parseF1(rows, detection, fileName, sheetName);
  }

  if (!firstHeaders) {
    return fail({ code: 'empty', message: 'This file is empty.' });
  }
  return fail({
    code: 'unknown-headers',
    message:
      "This doesn't look like a LinkedIn post performance export. If it is one, copy the details and report it so we can add this format.",
    headersFound: firstHeaders,
  });
}
