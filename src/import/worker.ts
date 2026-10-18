// Parses exports off the main thread (SPEC §9.2). Runs as a module worker.
import { expose } from 'comlink';
import { importFile } from './importFile.ts';

const api = {
  parse: (bytes: Uint8Array, fileName: string) => importFile(bytes, fileName),
};

export type ParserApi = typeof api;

expose(api);
