// Backup, restore and delete-all (SPEC §5 "Data controls").

import { z } from 'zod';
import { POST_TYPES } from '../import/types.ts';
import { metricsEqual } from './merge.ts';
import { clearAll, getSettings } from './repo.ts';
import type { PostPulseDb } from './schema.ts';
import {
  SETTINGS_KEY,
  type ImportRecord,
  type Post,
  type Settings,
  type Snapshot,
  type Topic,
} from './types.ts';

export const BACKUP_APP = 'post-pulse';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  backupVersion: number;
  exportedAt: string;
  posts: Post[];
  snapshots: Snapshot[];
  imports: ImportRecord[];
  topics: Topic[];
  settings: Settings;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().nonnegative();
const nullableCount = count.nullable();
const pct = z.number().min(0).max(100).nullable();

const metricsSchema = z.object({
  impressions: count,
  inNetworkPct: pct,
  outOfNetworkPct: pct,
  membersReached: nullableCount,
  views: nullableCount,
  watchTimeSec: nullableCount,
  avgWatchTimeSec: nullableCount,
  followersGained: nullableCount,
  profileViewers: nullableCount,
  reactions: count,
  comments: count,
  reposts: count,
  saves: count,
  sends: count,
  customButton: nullableCount,
  linkVisits: nullableCount,
});

const postSchema = z.object({
  postId: z.string().min(1),
  url: z.string(),
  authorSlug: z.string(),
  title: z.string(),
  titleIsHashtags: z.boolean(),
  publishDate: isoDate,
  postType: z.enum(POST_TYPES),
  postTypeRaw: z.string(),
  metrics: metricsSchema,
  metricsAsOf: isoDate,
  topics: z.array(z.string()),
  raw: z.record(z.string(), z.string()).optional(),
  language: z.enum(['en', 'de', 'fr', 'other']).optional(),
});

const snapshotSchema = z.object({
  postId: z.string().min(1),
  importId: z.string().min(1),
  asOf: isoDate,
  metrics: metricsSchema,
});

const importSchema = z.object({
  importId: z.string().min(1),
  fileName: z.string(),
  fileHash: z.string().regex(/^[0-9a-f]{64}$/),
  format: z.enum(['F1', 'F2']),
  headerLanguage: z.enum(['en', 'de', 'fr']),
  importedAt: z.string(),
  rangeStart: isoDate.optional(),
  rangeEnd: isoDate,
  postsNew: count,
  postsUpdated: count,
  postsUnchanged: count,
  warnings: z.array(z.string()),
});

const topicSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string(),
  keywords: z.array(z.string()),
  manualPostIds: z.array(z.string()),
});

const settingsSchema = z.object({
  locale: z.string(),
  theme: z.enum(['system', 'light', 'dark']),
  breakoutMultiplier: z.number().positive(),
  viralMultiplier: z.number().positive(),
  // Added after the first backups; older files fall back to the defaults.
  viralMode: z.enum(['multiplier', 'impressions']).optional(),
  viralImpressions: z.number().int().positive().optional(),
  includeImmature: z.boolean(),
});

const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  backupVersion: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  posts: z.array(postSchema),
  snapshots: z.array(snapshotSchema),
  imports: z.array(importSchema),
  topics: z.array(topicSchema),
  settings: settingsSchema,
});

export function backupFileName(date: Date): string {
  return `postpulse-backup-${date.toISOString().slice(0, 10)}.json`;
}

export async function createBackup(db: PostPulseDb, now: Date = new Date()): Promise<BackupFile> {
  return db.transaction(
    'r',
    [db.posts, db.snapshots, db.imports, db.topics, db.settings],
    async () => ({
      app: BACKUP_APP,
      backupVersion: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      posts: await db.posts.toArray(),
      snapshots: await db.snapshots.toArray(),
      imports: await db.imports.toArray(),
      topics: await db.topics.toArray(),
      settings: await getSettings(db),
    }),
  );
}

export type ParsedBackup = { ok: true; backup: BackupFile } | { ok: false; message: string };

/** Validate backup text. Never throws; the message is shown to the user as is. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, message: 'This file is not a Post Pulse backup (it is not valid JSON).' };
  }
  if (typeof json !== 'object' || json === null || (json as { app?: unknown }).app !== BACKUP_APP) {
    return { ok: false, message: 'This file is not a Post Pulse backup.' };
  }
  const version = (json as { backupVersion?: unknown }).backupVersion;
  if (typeof version === 'number' && version > BACKUP_VERSION) {
    return {
      ok: false,
      message:
        'This backup was made by a newer version of Post Pulse. Reload the app to update it, then try again.',
    };
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join('.') ?? '';
    return {
      ok: false,
      message: `This backup is damaged or incomplete${where ? ` (problem at ${where})` : ''}. Nothing was changed.`,
    };
  }
  return { ok: true, backup: result.data as BackupFile };
}

export interface RestoreSummary {
  postsNew: number;
  postsUpdated: number;
  postsUnchanged: number;
}

/**
 * Restore a validated backup. `replace` wipes the history first; `merge` applies
 * the import merge rules (SPEC §5): newer-or-equal metrics win, snapshots and
 * imports are unioned, existing topics and settings are kept.
 */
export async function restoreBackup(
  db: PostPulseDb,
  backup: BackupFile,
  mode: 'replace' | 'merge',
): Promise<RestoreSummary> {
  return db.transaction(
    'rw',
    [db.posts, db.snapshots, db.imports, db.topics, db.settings],
    async () => {
      if (mode === 'replace') {
        await clearAll(db);
        await db.posts.bulkAdd(backup.posts);
        await db.snapshots.bulkAdd(backup.snapshots);
        await db.imports.bulkAdd(backup.imports);
        await db.topics.bulkAdd(backup.topics);
        await db.settings.put({ key: SETTINGS_KEY, ...backup.settings });
        return { postsNew: backup.posts.length, postsUpdated: 0, postsUnchanged: 0 };
      }

      const current = await db.posts.bulkGet(backup.posts.map((p) => p.postId));
      const toPut: Post[] = [];
      const summary: RestoreSummary = { postsNew: 0, postsUpdated: 0, postsUnchanged: 0 };
      backup.posts.forEach((incoming, i) => {
        const existing = current[i];
        if (!existing) {
          summary.postsNew += 1;
          toPut.push(incoming);
          return;
        }
        if (
          incoming.metricsAsOf >= existing.metricsAsOf &&
          !metricsEqual(existing.metrics, incoming.metrics)
        ) {
          summary.postsUpdated += 1;
        } else {
          summary.postsUnchanged += 1;
        }
        if (incoming.metricsAsOf >= existing.metricsAsOf) {
          toPut.push({
            ...existing,
            ...incoming,
            topics: [...new Set([...existing.topics, ...incoming.topics])],
          });
        }
      });
      await db.posts.bulkPut(toPut);

      // The same file imported on both sides has two import IDs: keep ours and
      // point the backup's snapshots at it, so history isn't duplicated.
      const importIdByHash = new Map(
        (await db.imports.toArray()).map((r) => [r.fileHash, r.importId]),
      );
      const importIdMap = new Map(
        backup.imports.map((r) => [r.importId, importIdByHash.get(r.fileHash) ?? r.importId]),
      );
      await db.snapshots.bulkPut(
        backup.snapshots.map((snap) => ({
          ...snap,
          importId: importIdMap.get(snap.importId) ?? snap.importId,
        })),
      );
      await db.imports.bulkPut(backup.imports.filter((r) => !importIdByHash.has(r.fileHash)));

      const knownTopics = new Set((await db.topics.toArray()).map((t) => t.id));
      await db.topics.bulkAdd(backup.topics.filter((t) => !knownTopics.has(t.id)));
      return summary;
    },
  );
}

/** Delete every post, snapshot, import, topic and setting (SPEC §5). */
export async function deleteAllData(db: PostPulseDb): Promise<void> {
  await clearAll(db);
}
