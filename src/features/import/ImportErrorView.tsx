import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import type { ImportError } from '../../import/types.ts';

/** Text for "Copy details": the error and column names only, never post data (SPEC §4.4). */
export function errorReport(error: ImportError, fileName: string): string {
  return [
    'Post Pulse import report',
    `File name: ${fileName}`,
    `Error: ${error.code}`,
    ...(error.headersFound ? [`Columns found: ${error.headersFound.join(' | ')}`] : []),
  ].join('\n');
}

export function ImportErrorView({ error, fileName }: { error: ImportError; fileName: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <>
      <p>{error.message}</p>
      {error.headersFound && error.headersFound.length > 0 && (
        <>
          <p>
            <strong>{t('import.error.headersFound')}</strong>
          </p>
          <ul data-testid="headers-found">
            {error.headersFound.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          <div>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(errorReport(error, fileName));
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? t('import.error.copied') : t('import.error.copyDetails')}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
