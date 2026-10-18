// Backup download and backup file reading, shared by Settings and the import summary.
import { backupFileName, createBackup, parseBackup, type ParsedBackup } from '../../db/backup.ts';
import { db } from '../../db/instance.ts';

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export async function downloadBackup(): Promise<void> {
  const backup = await createBackup(db);
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName(new Date());
  a.click();
  URL.revokeObjectURL(url);
}

export async function readBackupFile(file: File): Promise<ParsedBackup> {
  if (!/\.json$/i.test(file.name))
    return { ok: false, message: 'Choose a Post Pulse backup file (.json).' };
  if (file.size > MAX_BACKUP_BYTES)
    return { ok: false, message: 'This file is too large to be a Post Pulse backup.' };
  return parseBackup(await file.text());
}
