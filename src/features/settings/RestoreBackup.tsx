// "Restore a backup" (SPEC §5): validate the file, then merge or replace.
// On an empty history there's nothing to merge with, so it restores directly.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToasts } from '../../app/toasts.ts';
import { Button } from '../../components/Button.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { restoreBackup, type BackupFile } from '../../db/backup.ts';
import { db } from '../../db/instance.ts';
import { readBackupFile } from './dataActions.ts';

export function RestoreBackup({ variant = 'secondary' }: { variant?: 'secondary' | 'quiet' }) {
  const { t } = useTranslation();
  const show = useToasts((s) => s.show);
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restore = async (backup: BackupFile, mode: 'merge' | 'replace') => {
    setPending(null);
    try {
      const r = await restoreBackup(db, backup, mode);
      show(t('settings.restore.done', { new: r.postsNew, updated: r.postsUpdated }), 'success');
    } catch {
      show(t('settings.restore.failed'), 'error');
    }
  };

  const onFile = async (file: File) => {
    const parsed = await readBackupFile(file);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    if ((await db.posts.count()) === 0) await restore(parsed.backup, 'replace');
    else setPending(parsed.backup);
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        data-testid="restore-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onFile(file);
        }}
      />
      <Button variant={variant} onClick={() => input.current?.click()}>
        {t('settings.restore.button')}
      </Button>

      <Dialog
        open={pending !== null}
        title={t('settings.restore.title')}
        onClose={() => setPending(null)}
        actions={
          <>
            <Button variant="quiet" onClick={() => setPending(null)}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={() => pending && void restore(pending, 'replace')}>
              {t('settings.restore.replace')}
            </Button>
            <Button variant="primary" onClick={() => pending && void restore(pending, 'merge')}>
              {t('settings.restore.merge')}
            </Button>
          </>
        }
      >
        <p>{t('settings.restore.text', { count: pending?.posts.length ?? 0 })}</p>
        <ul>
          <li>{t('settings.restore.mergeHint')}</li>
          <li>{t('settings.restore.replaceHint')}</li>
        </ul>
      </Dialog>

      <Dialog
        open={error !== null}
        title={t('settings.restore.errorTitle')}
        onClose={() => setError(null)}
        actions={
          <Button variant="primary" onClick={() => setError(null)}>
            {t('import.error.close')}
          </Button>
        }
      >
        <p>{error}</p>
      </Dialog>
    </>
  );
}
