// The import pipeline behind the import button (SPEC §5, §9.2), free of UI so
// it can be tested on its own: checks → read → parse → (drop sample) → merge.

import { deleteAllData } from '../../db/backup.ts';
import { mergeImport, type AuthorConflict } from '../../db/merge.ts';
import type { PostPulseDb } from '../../db/schema.ts';
import type { ImportRecord } from '../../db/types.ts';
import { sha256Hex } from '../../import/hash.ts';
import { checkFile } from '../../import/importFile.ts';
import type { ImportError, ImportResult } from '../../import/types.ts';
import { isSampleLoaded } from '../../sample/sampleData.ts';

export interface ImportInput {
  name: string;
  size: number;
  read: () => Promise<Uint8Array>;
}

export type Stage = 'reading' | 'parsing' | 'saving';

export interface ImportDeps {
  db: PostPulseDb;
  parse: (bytes: Uint8Array, fileName: string) => Promise<ImportResult>;
  confirmOtherAuthor: (conflict: AuthorConflict) => Promise<boolean>;
  onStage?: (stage: Stage) => void;
}

export type ImportFlowResult =
  | { kind: 'imported'; record: ImportRecord; replacedSample: boolean }
  | { kind: 'already-imported'; record: ImportRecord }
  | { kind: 'cancelled' }
  | { kind: 'error'; error: ImportError };

export async function runImport(input: ImportInput, deps: ImportDeps): Promise<ImportFlowResult> {
  const precheck = checkFile(input.name, input.size);
  if (precheck) return { kind: 'error', error: precheck };

  deps.onStage?.('reading');
  const bytes = await input.read();
  const fileHash = await sha256Hex(bytes);

  deps.onStage?.('parsing');
  const parsed = await deps.parse(bytes, input.name);
  if (!parsed.ok) return { kind: 'error', error: parsed.error };

  deps.onStage?.('saving');
  // Sample data is only a demo: a real import replaces it instead of mixing with it.
  const replacedSample = await isSampleLoaded(deps.db);
  if (replacedSample) await deleteAllData(deps.db);

  const outcome = await mergeImport(
    deps.db,
    parsed,
    { fileName: input.name, fileHash },
    {
      confirmOtherAuthor: deps.confirmOtherAuthor,
    },
  );
  if (outcome.status === 'already-imported')
    return { kind: 'already-imported', record: outcome.record };
  if (outcome.status === 'cancelled') return { kind: 'cancelled' };
  return { kind: 'imported', record: outcome.record, replacedSample };
}

/** Ask the browser to keep our data when it clears storage (SPEC §13 #8). Best effort. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported or denied: the backup reminder covers it.
  }
}
