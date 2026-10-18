// Main-thread side of the parser worker. Falls back to parsing in place where
// workers don't exist (unit tests), so callers never need to care.
import { wrap, type Remote } from 'comlink';
import { importFile } from './importFile.ts';
import type { ImportResult } from './types.ts';
import type { ParserApi } from './worker.ts';

let remote: Remote<ParserApi> | null = null;

function parser(): Remote<ParserApi> | null {
  if (typeof Worker === 'undefined') return null;
  remote ??= wrap<ParserApi>(
    new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
  );
  return remote;
}

export async function parseExport(bytes: Uint8Array, fileName: string): Promise<ImportResult> {
  const p = parser();
  return p ? p.parse(bytes, fileName) : importFile(bytes, fileName);
}
