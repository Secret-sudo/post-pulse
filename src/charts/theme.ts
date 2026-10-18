// Chart colours come from the CSS tokens, so charts follow light/dark mode
// and post types look the same everywhere (SPEC §9.1).
import type { PostType } from '../import/types.ts';

export interface ChartTheme {
  text: string;
  muted: string;
  border: string;
  surface: string;
  accent: string;
  accentSoft: string;
  negative: string;
  types: Record<PostType, string>;
}

const TYPE_TOKENS: Record<PostType, string> = {
  Image: '--type-image',
  Video: '--type-video',
  Repost: '--type-repost',
  Text: '--type-text',
  Article: '--type-article',
  Document: '--type-document',
  Poll: '--type-poll',
  Celebration: '--type-celebration',
  Other: '--type-other',
};

export function readTheme(el: Element = document.documentElement): ChartTheme {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    text: v('--color-text', '#1d2226'),
    muted: v('--color-text-muted', '#5e6670'),
    border: v('--color-border', '#dcdad5'),
    surface: v('--color-surface', '#ffffff'),
    accent: v('--color-accent', '#0a66c2'),
    accentSoft: v('--color-accent-soft', '#e8f1fb'),
    negative: v('--color-negative', '#b42318'),
    types: Object.fromEntries(
      Object.entries(TYPE_TOKENS).map(([type, token]) => [type, v(token, '#888888')]),
    ) as Record<PostType, string>,
  };
}
