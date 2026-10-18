// Fresh fake IndexedDB databases and fixture imports for storage tests.
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { sha256Hex } from '../../src/import/hash.ts';
import { importFile } from '../../src/import/importFile.ts';
import { mergeImport, type MergeOptions } from '../../src/db/merge.ts';
import { createDb, type PostPulseDb } from '../../src/db/schema.ts';
import { createBackup } from '../../src/db/backup.ts';

let counter = 0;

export function freshDb(): PostPulseDb {
  counter += 1;
  return createDb(`test-${process.pid}-${counter}-${Math.random().toString(36).slice(2)}`);
}

export async function importBytes(
  db: PostPulseDb,
  bytes: Uint8Array,
  fileName: string,
  options?: MergeOptions,
) {
  const parsed = await importFile(bytes, fileName);
  if (!parsed.ok) throw new Error(`fixture failed to parse: ${parsed.error.code}`);
  return mergeImport(db, parsed, { fileName, fileHash: await sha256Hex(bytes) }, options);
}

export function readFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`fixtures/synthetic/${name}`));
}

export async function importFixture(db: PostPulseDb, name: string, options?: MergeOptions) {
  return importBytes(db, readFixture(name), name, options);
}

/** Everything in the DB except the backup timestamp, for equality checks. */
export async function dbContents(db: PostPulseDb) {
  const { exportedAt: _ignored, ...rest } = await createBackup(db);
  const byKey = <T>(rows: T[], key: (r: T) => string) =>
    [...rows].sort((a, b) => key(a).localeCompare(key(b)));
  return {
    ...rest,
    posts: byKey(rest.posts, (p) => p.postId),
    snapshots: byKey(rest.snapshots, (s) => `${s.postId}|${s.importId}`),
    imports: byKey(rest.imports, (i) => i.importId),
  };
}
