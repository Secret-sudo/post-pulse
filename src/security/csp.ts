// Single source of truth for the Content Security Policy (SPEC §10.2).
// Injected as <meta> into the production index.html by vite.config.ts and
// mirrored as an HTTP header in netlify.toml (checked by TC-S02 / TC-S03).

export const CSP_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
] as const;

/** Directives browsers ignore in <meta>; sent only as an HTTP header. */
export const CSP_HEADER_ONLY_DIRECTIVES = ["frame-ancestors 'none'"] as const;

export const CSP_META_POLICY = CSP_DIRECTIVES.join('; ');

export const CSP_HEADER_POLICY = [...CSP_DIRECTIVES, ...CSP_HEADER_ONLY_DIRECTIVES].join('; ');
