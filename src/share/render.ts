// Draws carousel slides on a canvas (SPEC §9.2 screen 8): 1080 × 1350 px, the
// portrait size LinkedIn shows document posts in. Colours come from the
// --share-* tokens in tokens.css; the text from carousel.ts.

import { APP_URL, type Slide, type Stat } from './carousel.ts';

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
const M = 96;

export type ShareTheme = 'light' | 'dark';

export interface SharePalette {
  bg: string;
  card: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  positive: string;
  negative: string;
  bar: string;
  font: string;
}

const KEYS = [
  'bg',
  'card',
  'text',
  'muted',
  'line',
  'accent',
  'positive',
  'negative',
  'bar',
] as const;

/** The carousel palette for a theme, independent of the app's own theme. */
export function readPalette(
  theme: ShareTheme,
  el: Element = document.documentElement,
): SharePalette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const p = Object.fromEntries(KEYS.map((k) => [k, v(`--share-${theme}-${k}`) || '#888888']));
  return {
    ...(p as Omit<SharePalette, 'font'>),
    font: v('--font-sans') || 'system-ui, sans-serif',
  };
}

type Ctx = CanvasRenderingContext2D;
type Weight = 400 | 500 | 600 | 700;

function font(ctx: Ctx, p: SharePalette, size: number, weight: Weight = 400) {
  ctx.font = `${weight} ${size}px ${p.font}`;
}

function wrap(ctx: Ctx, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  // Split on plain spaces only: non-breaking spaces keep "66 %" together.
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  return line ? [...lines, line] : lines;
}

/** Wrapped text from (x, y) top-left; returns the y below the last line. */
function para(
  ctx: Ctx,
  p: SharePalette,
  text: string,
  x: number,
  y: number,
  opts: { size: number; weight?: Weight; color: string; width?: number; leading?: number },
): number {
  font(ctx, p, opts.size, opts.weight);
  ctx.fillStyle = opts.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  let yy = y;
  for (const line of wrap(ctx, text, opts.width ?? SLIDE_W - 2 * M)) {
    ctx.fillText(line, x, yy);
    yy += opts.size * (opts.leading ?? 1.18);
  }
  return yy;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function chrome(ctx: Ctx, p: SharePalette, n: number, total: number) {
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
  ctx.textBaseline = 'top';
  font(ctx, p, 30, 600);
  ctx.fillStyle = p.accent;
  ctx.textAlign = 'left';
  ctx.fillText('Post Pulse', M, 72);
  font(ctx, p, 26);
  ctx.fillStyle = p.muted;
  ctx.textAlign = 'right';
  ctx.fillText(`${n} / ${total}`, SLIDE_W - M, 72);
  ctx.fillStyle = p.line;
  ctx.fillRect(M, SLIDE_H - 120, SLIDE_W - 2 * M, 2);
  font(ctx, p, 26, 500);
  ctx.fillStyle = p.muted;
  ctx.textAlign = 'left';
  ctx.fillText(APP_URL, M, SLIDE_H - 96);
  if (n < total) {
    ctx.textAlign = 'right';
    ctx.fillText('Swipe for more', SLIDE_W - M, SLIDE_H - 96);
  }
  ctx.textAlign = 'left';
}

function kicker(ctx: Ctx, p: SharePalette, text: string, y: number): number {
  return para(ctx, p, text.toUpperCase(), M, y, { size: 26, weight: 600, color: p.muted }) + 24;
}

function stat(ctx: Ctx, p: SharePalette, s: Stat, x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, 20, p.card);
  para(ctx, p, s.big, x + 28, y + 26, { size: 54, weight: 700, color: p.text, width: w - 56 });
  para(ctx, p, s.small, x + 28, y + 100, { size: 26, color: p.muted, width: w - 56 });
}

function statGrid(ctx: Ctx, p: SharePalette, stats: Stat[], y: number, rowH: number): number {
  const cw = (SLIDE_W - 2 * M - 30) / 2;
  stats.forEach((s, i) =>
    stat(ctx, p, s, M + (i % 2) * (cw + 30), y + Math.floor(i / 2) * (rowH + 30), cw, rowH),
  );
  return y + Math.ceil(stats.length / 2) * (rowH + 30);
}

export function drawSlide(ctx: Ctx, slide: Slide, n: number, total: number, p: SharePalette) {
  chrome(ctx, p, n, total);
  const W = SLIDE_W - 2 * M;
  switch (slide.kind) {
    case 'cover': {
      let y = 300;
      if (slide.sample) {
        font(ctx, p, 30, 700);
        const label = 'SAMPLE DATA';
        const w = ctx.measureText(label).width + 48;
        roundRect(ctx, M, 200, w, 56, 28, p.negative);
        ctx.fillStyle = p.bg;
        ctx.fillText(label, M + 24, 212);
      }
      y = kicker(ctx, p, slide.kicker, y);
      y = para(ctx, p, slide.headline, M, y + 10, {
        size: 92,
        weight: 700,
        color: p.text,
        leading: 1.12,
      });
      para(ctx, p, slide.sub, M, y + 40, { size: 38, color: p.muted });
      break;
    }
    case 'lesson': {
      let y = kicker(ctx, p, 'The lesson', 200);
      y =
        para(ctx, p, slide.headline, M, y, {
          size: 64,
          weight: 700,
          color: p.text,
          leading: 1.15,
        }) + 40;
      y = para(ctx, p, slide.caption, M, y, { size: 28, weight: 500, color: p.muted }) + 24;
      const max = Math.max(...slide.bars.map((b) => b.value), slide.typical.value, 1);
      const x0 = M + 200;
      const bw = W - 300;
      const top = y;
      // Rows shrink so up to 9 formats fit between the caption and the note.
      const row = Math.min(100, (SLIDE_H - 330 - top) / Math.max(1, slide.bars.length));
      const bar = Math.min(52, row - 28);
      const highlight =
        slide.tone === 'positive' ? p.positive : slide.tone === 'negative' ? p.negative : p.accent;
      if (slide.bars.length === 0) {
        para(ctx, p, slide.note, M, SLIDE_H - 250, { size: 24, color: p.muted });
        break;
      }
      // The typical-post line goes first, so bars and labels sit on top of it.
      const tx = x0 + (bw * slide.typical.value) / max;
      ctx.fillStyle = p.line;
      ctx.fillRect(tx - 1.5, top, 3, row * slide.bars.length);
      for (const b of slide.bars) {
        para(ctx, p, b.label, M, y + 2, { size: 30, weight: 500, color: p.text, width: 190 });
        para(ctx, p, `${b.posts} posts`, M, y + 38, { size: 22, color: p.muted, width: 190 });
        const len = Math.max(4, (bw * b.value) / max);
        roundRect(ctx, x0, y + 6, len, bar, 10, b.highlight ? highlight : p.bar);
        para(ctx, p, b.display, x0 + len + 16, y + 6 + bar / 2 - 17, {
          size: 30,
          weight: 600,
          color: p.text,
          width: 200,
        });
        y += row;
      }
      font(ctx, p, 22, 500);
      ctx.fillStyle = p.muted;
      ctx.textAlign = 'center';
      ctx.fillText(slide.typical.label, tx, y + 8);
      ctx.textAlign = 'left';
      para(ctx, p, slide.note, M, SLIDE_H - 250, { size: 24, color: p.muted });
      break;
    }
    case 'momentum': {
      let y = kicker(ctx, p, slide.kicker, 200);
      y = para(ctx, p, slide.label, M, y, { size: 36, weight: 500, color: p.muted }) + 10;
      const changeColor =
        slide.trend === 'up' ? p.positive : slide.trend === 'down' ? p.negative : p.text;
      y =
        para(ctx, p, slide.change, M, y, {
          size: 130,
          weight: 700,
          color: changeColor,
          leading: 1.1,
        }) + 6;
      y = para(ctx, p, slide.summary, M, y, { size: 32, weight: 500, color: p.text }) + 10;
      if (slide.detail) y = para(ctx, p, slide.detail, M, y, { size: 30, color: p.muted }) + 6;
      if (slide.note) y = para(ctx, p, slide.note, M, y, { size: 26, color: p.muted }) + 6;
      const known = slide.series.filter((v): v is number => v !== null);
      const yt = y + 20;
      const yb = y + 200;
      if (known.length >= 2) {
        const lo = Math.min(...known);
        const span = Math.max(...known) - lo || 1;
        const xs = (i: number) => M + (i * W) / Math.max(1, slide.series.length - 1);
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        let started = false;
        let last: [number, number] | null = null;
        slide.series.forEach((v, i) => {
          if (v === null) return;
          const pt: [number, number] = [xs(i), yb - ((v - lo) / span) * (yb - yt)];
          if (started) ctx.lineTo(...pt);
          else ctx.moveTo(...pt);
          started = true;
          last = pt;
        });
        ctx.stroke();
        const end = last as [number, number] | null;
        if (end) {
          ctx.fillStyle = p.accent;
          ctx.beginPath();
          ctx.arc(end[0], end[1], 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      para(ctx, p, slide.seriesLabel, M, yb + 16, { size: 22, color: p.muted });
      statGrid(ctx, p, slide.stats, yb + 90, 210);
      break;
    }
    case 'recap': {
      let y = kicker(ctx, p, slide.kicker, 200);
      y = para(ctx, p, slide.headline, M, y, { size: 64, weight: 700, color: p.text }) + 30;
      y = statGrid(ctx, p, slide.stats, y, 180) + 10;
      y = para(ctx, p, slide.topLabel, M, y, { size: 28, weight: 600, color: p.muted }) + 14;
      y = para(ctx, p, slide.topTitle, M, y, { size: 40, weight: 600, color: p.text });
      y = para(ctx, p, slide.topDetail, M, y + 10, { size: 28, color: p.muted }) + 30;
      para(ctx, p, slide.thanks, M, y, { size: 32, weight: 500, color: p.text });
      break;
    }
    case 'closing': {
      let y = para(ctx, p, slide.headline, M, 420, { size: 72, weight: 700, color: p.text });
      y = para(ctx, p, slide.url, M, y + 20, { size: 44, weight: 600, color: p.accent });
      para(ctx, p, slide.privacy, M, y + 50, { size: 36, color: p.muted });
      para(ctx, p, slide.disclaimer, M, SLIDE_H - 220, { size: 22, color: p.muted });
      break;
    }
  }
}
