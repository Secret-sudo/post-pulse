// Post URLs come from the spreadsheet, so they are untrusted (SPEC §10.2).
// Only real LinkedIn https links become clickable; anything else (javascript:,
// data:, other hosts) is shown as text.

const ALLOWED_HOST = /(^|\.)linkedin\.com$/i;

export function safeLinkedInHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED_HOST.test(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}
