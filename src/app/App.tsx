import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button.tsx';
import { Toasts } from '../components/Toasts.tsx';
import { ImportProvider, useImport } from '../features/import/ImportProvider.tsx';
import { Overview } from '../features/overview/Overview.tsx';
import { PostsView } from '../features/posts/PostsView.tsx';
import { BreakdownsView } from '../features/breakdowns/BreakdownsView.tsx';
import { TimelineView } from '../features/timeline/TimelineView.tsx';
import { SettingsView } from '../features/settings/SettingsView.tsx';
import { Welcome } from '../features/welcome/Welcome.tsx';
import { toSearch, VIEWS, type View } from './url.ts';
import { useAppUrl, type Navigate } from './useAppUrl.ts';
import { useDashboard } from './useDashboard.ts';
import { useHistory, type History } from './useHistory.ts';
import { UpdatePrompt } from './UpdatePrompt.tsx';
import { useTheme } from './useTheme.ts';
import styles from './App.module.css';

function HeaderImport() {
  const { t } = useTranslation();
  const { importFile, busy } = useImport();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".xlsx"
        hidden
        data-testid="header-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void importFile(file);
        }}
      />
      <Button variant="primary" onClick={() => input.current?.click()} disabled={busy}>
        {t('app.import')}
      </Button>
    </>
  );
}

function SampleBanner() {
  const { t } = useTranslation();
  const { removeSampleData } = useImport();
  return (
    <div className={styles.banner} role="note" data-testid="sample-banner">
      <span>{t('sample.banner')}</span>
      <Button variant="quiet" onClick={() => void removeSampleData()}>
        {t('sample.remove')}
      </Button>
    </div>
  );
}

function Tabs({ view, navigate }: { view: View; navigate: Navigate }) {
  const { t } = useTranslation();
  const [state] = useAppUrl();
  return (
    <nav className={styles.tabs} aria-label={t('nav.label')}>
      {VIEWS.map((v) => (
        <a
          key={v}
          href={toSearch({ ...state, view: v }) || '?'}
          className={styles.tab}
          aria-current={v === view ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate({ view: v });
          }}
        >
          {t(`nav.${v}`)}
        </a>
      ))}
    </nav>
  );
}

function DashboardViews({ history }: { history: History }) {
  const [{ view, filters, table, chart }, navigate] = useAppUrl();
  const dashboard = useDashboard(history, filters);
  if (!dashboard) return null;
  return (
    <>
      {history.isSample && <SampleBanner />}
      <Tabs view={view} navigate={navigate} />
      {view === 'timeline' ? (
        <TimelineView
          history={history}
          dashboard={dashboard}
          filters={filters}
          chart={chart}
          navigate={navigate}
        />
      ) : view === 'breakdowns' ? (
        <BreakdownsView
          history={history}
          dashboard={dashboard}
          filters={filters}
          chart={chart}
          navigate={navigate}
        />
      ) : view === 'settings' ? (
        <SettingsView history={history} dashboard={dashboard} navigate={navigate} />
      ) : view === 'posts' ? (
        <PostsView
          history={history}
          dashboard={dashboard}
          filters={filters}
          table={table}
          navigate={navigate}
        />
      ) : (
        <Overview history={history} dashboard={dashboard} filters={filters} navigate={navigate} />
      )}
    </>
  );
}

function Main() {
  const history = useHistory();
  if (history === undefined) return <div className={styles.loading} aria-hidden="true" />;
  if (history.posts.length === 0) return <Welcome />;
  return <DashboardViews history={history} />;
}

export function App() {
  const { t } = useTranslation();
  const history = useHistory();
  useTheme(history?.settings.theme);
  return (
    <ImportProvider>
      <div className={styles.shell}>
        <a className={styles.skip} href="#main">
          {t('app.skipToContent')}
        </a>
        <header className={styles.header}>
          <span className={styles.brand}>{t('app.name')}</span>
          <span className={styles.beta} title={t('app.betaHint')}>
            {t('app.beta')}
          </span>
          <span className={styles.tagline}>{t('app.tagline')}</span>
          {history && history.posts.length > 0 && (
            <span className={styles.headerActions}>
              <HeaderImport />
            </span>
          )}
        </header>

        <main id="main" className={styles.main}>
          <Main />
        </main>

        <footer className={styles.footer}>
          <p data-testid="beta-note">{t('app.betaNote')}</p>
          <p>{t('app.footer')}</p>
        </footer>
      </div>
      <Toasts />
      <UpdatePrompt />
    </ImportProvider>
  );
}
