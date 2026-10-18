import { applyTheme } from './useTheme.ts';

describe('theme setting (SPEC §9.1)', () => {
  it('sets data-theme for light and dark and removes it for system', () => {
    const root = document.createElement('html');
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    applyTheme('light', root);
    expect(root.dataset.theme).toBe('light');
    applyTheme('system', root);
    expect(root.dataset.theme).toBeUndefined();
    expect(root.style.colorScheme).toBe('light dark');
  });
});
