// Merge a parsed export into the history (SPEC §5, merge rules 1–7).

import type { F1Result, ParseWarning, PostMetrics } from '../import/types.ts';
import { knownAuthors } from './repo.ts';
import type { PostPulseDb } from './schema.ts';
import type { ImportRecord, Post, Snapshot } from './types.ts';

export interface FileMeta {
  fileName: string;
  fileHash: string;
}

export interface AuthorConflict {
  existing: string[];
  incoming: string[];
}

export type ImportOutcome =
  | { status: 'already-imported'; record: ImportRecord }
  | { status: 'cancelled'; reason: 'other-author' }
  | { status: 'imported'; record: ImportRecord };

export interface MergeOptions {
  /** Asked before anything is written when the file's author differs (rule 5). No answer = cancel. */
  confirmOtherAuthor?: (conflict: AuthorConflict) => boolean | Promise<boolean>;
  now?: () => Date;
  newId?: () => string;
}

export function metricsEqual(a: PostMetrics, b: PostMetrics): boolean {
  return (Object.keys(a) as (keyof PostMetrics)[]).every((k) => a[k] === b[k]);
}

export function formatWarning(w: ParseWarning): string {
  const where = [w.row !== undefined ? `Row ${w.row}` : '', w.column ?? '']
    .filter(Boolean)
    .join(', ');
  return where ? `${where}: ${w.message}` : w.message;
}

export async function mergeImport(
  db: PostPulseDb,
  parsed: F1Result,
  file: FileMeta,
  options: MergeOptions = {},
): Promise<ImportOutcome> {
  const { now = () => new Date(), newId = () => crypto.randomUUID() } = options;

  const previous = await db.imports.where('fileHash').equals(file.fileHash).first();
  if (previous) return { status: 'already-imported', record: previous };

  const existingAuthors = await knownAuthors(db);
  const incoming = [...new Set(parsed.posts.map((p) => p.authorSlug).filter((a) => a !== ''))];
  if (existingAuthors.size > 0 && incoming.some((a) => !existingAuthors.has(a))) {
    const conflict = { existing: [...existingAuthors].sort(), incoming: incoming.sort() };
    const proceed = (await options.confirmOtherAuthor?.(conflict)) ?? false;
    if (!proceed) return { status: 'cancelled', reason: 'other-author' };
  }

  const importId = newId();
  const asOf = parsed.rangeEnd;

  return db.transaction('rw', [db.posts, db.snapshots, db.imports], async () => {
    const current = await db.posts.bulkGet(parsed.posts.map((p) => p.postId));
    const posts: Post[] = [];
    const snapshots: Snapshot[] = [];
    let postsNew = 0;
    let postsUpdated = 0;
    let postsUnchanged = 0;

    parsed.posts.forEach((incomingPost, i) => {
      snapshots.push({
        postId: incomingPost.postId,
        importId,
        asOf,
        metrics: incomingPost.metrics,
      });
      const existing = current[i];
      if (!existing) {
        postsNew += 1;
        posts.push({ ...incomingPost, metricsAsOf: asOf, topics: [] });
        return;
      }
      if (asOf < existing.metricsAsOf) {
        // An older export imported later only adds history (rule 2).
        postsUnchanged += 1;
        return;
      }
      if (metricsEqual(existing.metrics, incomingPost.metrics)) postsUnchanged += 1;
      else postsUpdated += 1;
      posts.push({ ...existing, ...incomingPost, metricsAsOf: asOf, topics: existing.topics });
    });

    const record: ImportRecord = {
      importId,
      fileName: file.fileName,
      fileHash: file.fileHash,
      format: parsed.format,
      headerLanguage: parsed.headerLanguage,
      importedAt: now().toISOString(),
      rangeEnd: parsed.rangeEnd,
      postsNew,
      postsUpdated,
      postsUnchanged,
      warnings: parsed.warnings.map(formatWarning),
    };
    if (parsed.rangeStart) record.rangeStart = parsed.rangeStart;

    await db.posts.bulkPut(posts);
    await db.snapshots.bulkAdd(snapshots);
    await db.imports.add(record);
    return { status: 'imported', record } as const;
  });
}
