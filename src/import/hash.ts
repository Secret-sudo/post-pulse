/** SHA-256 of the file bytes as hex: identifies a file for "Already imported" (SPEC §5). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a plain ArrayBuffer-backed view: Web Crypto rejects SharedArrayBuffer views.
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
