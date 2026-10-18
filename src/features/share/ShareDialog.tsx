// Share carousel dialog (SPEC §9.2 screen 8, Alpha): pick a theme and whether
// absolute numbers show, preview the slides, download them as one PDF.
// Everything is drawn and saved in the browser; nothing is uploaded.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Dashboard } from '../../app/useDashboard.ts';
import type { History } from '../../app/useHistory.ts';
import { Button } from '../../components/Button.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { buildCarousel, type Slide } from '../../share/carousel.ts';
import { buildPdf } from '../../share/pdf.ts';
import { drawSlide, readPalette, SLIDE_H, SLIDE_W, type ShareTheme } from '../../share/render.ts';
import styles from './ShareDialog.module.css';

const JPEG_QUALITY = 0.92;

function SlideCanvas({
  slide,
  n,
  total,
  theme,
}: {
  slide: Slide;
  n: number;
  total: number;
  theme: ShareTheme;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawSlide(ctx, slide, n, total, readPalette(theme));
  }, [slide, n, total, theme]);
  return (
    <canvas
      ref={ref}
      width={SLIDE_W}
      height={SLIDE_H}
      className={styles.slide}
      data-testid="share-slide"
      data-kind={slide.kind}
      aria-hidden="true"
    />
  );
}

async function slideJpeg(
  slide: Slide,
  n: number,
  total: number,
  theme: ShareTheme,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = SLIDE_W;
  canvas.height = SLIDE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  drawSlide(ctx, slide, n, total, readPalette(theme));
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new Error('Could not create the image');
  return new Uint8Array(await blob.arrayBuffer());
}

interface Props {
  open: boolean;
  onClose: () => void;
  history: History;
  dashboard: Dashboard;
}

export function ShareDialog({ open, onClose, history, dashboard }: Props) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<ShareTheme>('light');
  const [absolute, setAbsolute] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  /** Slides left out of the PDF, by position; every slide is in by default.
      The closing slide is the owner's signature with the app's URL: always in. */
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());

  const carousel = useMemo(
    () =>
      buildCarousel(
        { posts: history.posts, latestExportDate: dashboard.latestExportDate },
        dashboard.settings,
        dashboard.insights,
        { absolute, sample: history.isSample },
      ),
    [history.posts, history.isSample, dashboard, absolute],
  );
  // Page numbers count only the slides that go into the PDF.
  const chosen = carousel.slides.filter((_, i) => !excluded.has(i));
  const numberOf = (i: number) =>
    excluded.has(i)
      ? i + 1
      : carousel.slides.slice(0, i).filter((_, j) => !excluded.has(j)).length + 1;
  const toggle = (i: number) => {
    setError(false);
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const download = async () => {
    setBusy(true);
    setError(false);
    try {
      const pages = [];
      for (const [i, slide] of chosen.entries()) {
        pages.push({
          jpeg: await slideJpeg(slide, i + 1, chosen.length, theme),
          width: SLIDE_W,
          height: SLIDE_H,
        });
      }
      const blob = new Blob([buildPdf(pages, 'My LinkedIn with Post Pulse')], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `post-pulse-carousel-${dashboard.latestExportDate}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Creating the carousel failed', e);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={t('share.title')}
      onClose={onClose}
      wide
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('share.close')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void download()}
            disabled={busy}
            data-testid="share-download"
          >
            {busy ? t('share.working') : t('share.download')}
          </Button>
        </>
      }
    >
      <p className={styles.alpha}>
        <span className={styles.badge}>{t('share.alpha')}</span> {t('share.alphaHint')}
      </p>
      <div className={styles.options}>
        <fieldset className={styles.fieldset}>
          <legend>{t('share.theme')}</legend>
          {(['light', 'dark'] as const).map((th) => (
            <label key={th} className={styles.option}>
              <input
                type="radio"
                name="share-theme"
                checked={theme === th}
                onChange={() => setTheme(th)}
              />
              {t(`share.${th}`)}
            </label>
          ))}
        </fieldset>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={absolute}
            onChange={(e) => setAbsolute(e.target.checked)}
            aria-describedby="share-absolute-hint"
          />
          <span>
            {t('share.absolute')}
            <small id="share-absolute-hint" className={styles.muted}>
              {t('share.absoluteHint')}
            </small>
          </span>
        </label>
      </div>
      <p className={styles.muted}>{t('share.pickHint')}</p>
      <ul
        className={styles.slides}
        aria-label={t('share.previewLabel', { count: carousel.slides.length })}
      >
        {carousel.slides.map((slide, i) => {
          const included = !excluded.has(i);
          return (
            <li key={`${slide.kind}-${i}`} className={included ? undefined : styles.excluded}>
              <SlideCanvas
                slide={slide}
                n={numberOf(i)}
                total={included ? chosen.length : carousel.slides.length}
                theme={theme}
              />
              {slide.kind === 'closing' ? (
                <p className={styles.pick} data-testid="share-closing-always">
                  {t('share.slide.closing')} · {t('share.alwaysIncluded')}
                </p>
              ) : (
                <label className={styles.pick}>
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={() => toggle(i)}
                    data-testid={`share-include-${slide.kind}`}
                  />
                  {t(`share.slide.${slide.kind}`)}
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.muted}>{t('share.privacy')}</p>
      {error && (
        <p role="alert" className={styles.error}>
          {t('share.failed')}
        </p>
      )}
    </Dialog>
  );
}
