/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { CSP_META_POLICY } from './src/security/csp.ts';

// Vite's dev server relies on inline scripts for HMR, so the CSP meta tag is
// added to production builds only (SPEC §10.2).
function cspMeta(): Plugin {
  return {
    name: 'post-pulse-csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP_META_POLICY },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    cspMeta(),
    // Installable and offline after the first visit (SPEC §10.3). Updates wait
    // for the user to reload, so an import is never interrupted.
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      filename: 'sw.js',
      includeAssets: [
        'icons/favicon.svg',
        'icons/apple-touch-icon-180.png',
        'icons/favicon-32.png',
      ],
      manifest: {
        name: 'Post Pulse',
        short_name: 'Post Pulse',
        description:
          'A private performance dashboard for your LinkedIn analytics export. Your data never leaves your device.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f4f2ee',
        theme_color: '#0a66c2',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Everything the app needs offline, including the lazy chunks and the parser worker.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    // ECharts (~570 KB raw) and SheetJS load lazily, outside the initial budget
    // that size-limit enforces (SPEC §10.3), so their size isn't a warning.
    chunkSizeWarningLimit: 700,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    alias: {
      // The service worker module only exists in a real build.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./tests/unit/pwa-register-stub.ts', import.meta.url),
      ),
    },
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}', 'tests/node/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx'],
      reporter: ['text-summary', 'html'],
      thresholds: {
        'src/import/**': { lines: 90 },
        'src/db/**': { lines: 90 },
        'src/analysis/**': { lines: 90 },
        'src/insights/**': { lines: 90 },
      },
    },
  },
});
