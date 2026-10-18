// Applies the theme setting (SPEC §9.1): "system" follows the OS, light/dark
// override it via data-theme, which tokens.css reads.
import { useEffect } from 'react';
import type { Settings } from '../db/types.ts';

export function applyTheme(
  theme: Settings['theme'],
  root: HTMLElement = document.documentElement,
): void {
  if (theme === 'system') {
    delete root.dataset.theme;
    root.style.colorScheme = 'light dark';
  } else {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }
}

export function useTheme(theme: Settings['theme'] | undefined): void {
  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);
}
