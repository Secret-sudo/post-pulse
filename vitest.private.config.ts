import { defineConfig } from 'vitest/config';

// Tests against real exports. The tests and their expected values live in
// docs/data/tests/ (gitignored) next to the exports, because the values describe
// a real profile (SPEC §11.4). Without them nothing runs, so this is safe anywhere.
// Standalone on purpose: merging with vite.config.ts would concatenate the
// `include` lists and run the whole unit suite again.
export default defineConfig({
  test: {
    globals: true,
    include: ['docs/data/tests/**/*.test.ts'],
    passWithNoTests: true,
    environment: 'node',
    testTimeout: 30_000,
  },
});
