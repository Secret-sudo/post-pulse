// Owns the import flow UI: progress, other-profile question, summary, errors
// (SPEC §9.2). Any part of the app can start an import through useImport().
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useToasts } from '../../app/toasts.ts';
import { Button } from '../../components/Button.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { db } from '../../db/instance.ts';
import type { AuthorConflict } from '../../db/merge.ts';
import type { ImportRecord } from '../../db/types.ts';
import { parseExport } from '../../import/client.ts';
import type { ImportError } from '../../import/types.ts';
import { loadSample, removeSample } from '../../sample/sampleData.ts';
import { downloadBackup } from '../settings/dataActions.ts';
import { ImportErrorView } from './ImportErrorView.tsx';
import { ImportSummary } from './ImportSummary.tsx';
import { requestPersistentStorage, runImport, type Stage } from './runImport.ts';
import styles from './ImportProvider.module.css';

interface ImportApi {
  importFile: (file: File) => Promise<void>;
  loadSampleData: () => Promise<void>;
  removeSampleData: () => Promise<void>;
  busy: boolean;
}

const Ctx = createContext<ImportApi | null>(null);

export function useImport(): ImportApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useImport must be used inside <ImportProvider>');
  return api;
}

type View =
  | { kind: 'idle' }
  | { kind: 'working'; stage: Stage; fileName: string }
  | { kind: 'author'; conflict: AuthorConflict }
  | { kind: 'summary'; record: ImportRecord; replacedSample: boolean }
  | { kind: 'error'; error: ImportError; fileName: string };

export function ImportProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const show = useToasts((s) => s.show);
  const [view, setView] = useState<View>({ kind: 'idle' });
  const authorAnswer = useRef<((ok: boolean) => void) | null>(null);
  const persisted = useRef(false);

  const importFile = useCallback(
    async (file: File) => {
      try {
        const result = await runImport(
          {
            name: file.name,
            size: file.size,
            read: async () => new Uint8Array(await file.arrayBuffer()),
          },
          {
            db,
            parse: parseExport,
            onStage: (stage) => setView({ kind: 'working', stage, fileName: file.name }),
            confirmOtherAuthor: (conflict) =>
              new Promise<boolean>((resolve) => {
                authorAnswer.current = resolve;
                setView({ kind: 'author', conflict });
              }),
          },
        );
        if (result.kind === 'error') {
          setView({ kind: 'error', error: result.error, fileName: file.name });
        } else if (result.kind === 'already-imported') {
          setView({ kind: 'idle' });
          show(t('import.already', { file: file.name }));
        } else if (result.kind === 'cancelled') {
          setView({ kind: 'idle' });
          show(t('import.cancelled'));
        } else {
          setView({
            kind: 'summary',
            record: result.record,
            replacedSample: result.replacedSample,
          });
          if (!persisted.current) {
            persisted.current = true;
            void requestPersistentStorage();
          }
        }
      } catch {
        setView({ kind: 'idle' });
        show(t('import.error.unexpected'), 'error');
      }
    },
    [show, t],
  );

  const api = useMemo<ImportApi>(
    () => ({
      importFile,
      // Storage can fail (blocked site data, private modes, quota): say so instead of doing nothing.
      loadSampleData: async () => {
        try {
          await loadSample(db);
        } catch (e) {
          console.error('Loading sample data failed', e);
          show(t('sample.failed', { reason: storageReason(e) }), 'error');
        }
      },
      removeSampleData: async () => {
        try {
          await removeSample(db);
          show(t('sample.removed'), 'success');
        } catch (e) {
          console.error('Removing sample data failed', e);
          show(t('sample.failed', { reason: storageReason(e) }), 'error');
        }
      },
      busy: view.kind === 'working' || view.kind === 'author',
    }),
    [importFile, show, t, view.kind],
  );

  const answerAuthor = (ok: boolean) => {
    authorAnswer.current?.(ok);
    authorAnswer.current = null;
  };

  return (
    <Ctx.Provider value={api}>
      {children}

      {view.kind === 'working' && (
        <div
          className={styles.progress}
          role="status"
          aria-live="polite"
          data-testid="import-progress"
        >
          <span className={styles.bar} aria-hidden="true" />
          {t(`import.stage.${view.stage}`, { file: view.fileName })}
        </div>
      )}

      <Dialog
        open={view.kind === 'author'}
        title={t('import.otherAuthor.title')}
        onClose={() => answerAuthor(false)}
        actions={
          <>
            <Button variant="quiet" onClick={() => answerAuthor(false)}>
              {t('import.otherAuthor.cancel')}
            </Button>
            <Button variant="primary" onClick={() => answerAuthor(true)}>
              {t('import.otherAuthor.importAnyway')}
            </Button>
          </>
        }
      >
        {view.kind === 'author' && (
          <p>
            {t('import.otherAuthor.text', {
              existing: view.conflict.existing.join(', '),
              incoming: view.conflict.incoming.join(', '),
            })}
          </p>
        )}
      </Dialog>

      <Dialog
        open={view.kind === 'summary'}
        title={t('import.summary.title')}
        onClose={() => setView({ kind: 'idle' })}
        actions={
          <>
            <Button onClick={() => void downloadBackup()}>
              {t('import.summary.backupButton')}
            </Button>
            <Button variant="primary" onClick={() => setView({ kind: 'idle' })}>
              {t('import.summary.done')}
            </Button>
          </>
        }
      >
        {view.kind === 'summary' && (
          <ImportSummary record={view.record} replacedSample={view.replacedSample} />
        )}
      </Dialog>

      <Dialog
        open={view.kind === 'error'}
        title={view.kind === 'error' ? t(`import.error.title.${view.error.code}`) : ''}
        onClose={() => setView({ kind: 'idle' })}
        actions={
          <Button variant="primary" onClick={() => setView({ kind: 'idle' })}>
            {t('import.error.close')}
          </Button>
        }
      >
        {view.kind === 'error' && <ImportErrorView error={view.error} fileName={view.fileName} />}
      </Dialog>
    </Ctx.Provider>
  );
}

/** Short, user-facing reason for a storage error (Dexie / IndexedDB names). */
function storageReason(e: unknown): string {
  const name = e instanceof Error ? e.name : '';
  if (/QuotaExceeded/i.test(name)) return 'The browser has no storage space left for this site.';
  if (/(Security|InvalidState|Open|MissingAPI|DatabaseClosed)/i.test(name))
    return 'The browser blocks storage for this site, for example in some private windows or when website data is blocked.';
  return e instanceof Error && e.message ? e.message : 'Unknown error.';
}
