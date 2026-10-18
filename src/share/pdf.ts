// A minimal PDF writer: one JPEG per page, nothing else (SPEC §9.2 screen 8).
// LinkedIn shows an uploaded PDF as a carousel, one page per slide. No library:
// the format needed here is a handful of objects and a cross-reference table.

const enc = new TextEncoder();

export interface PdfPage {
  /** Baseline JPEG bytes (canvas.toBlob('image/jpeg')). */
  jpeg: Uint8Array;
  width: number;
  height: number;
}

/** PDF with one full-page image per page; the page size is the image size in points. */
export function buildPdf(pages: readonly PdfPage[], title = 'Post Pulse'): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: (string | Uint8Array)[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body.forEach(push);
    push('\nendobj\n');
  };

  // 1 catalog, 2 page tree, 3 info, then per page: page, content stream, image.
  const pageIds = pages.map((_, i) => 4 + i * 3);
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  object(2, [
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
  ]);
  object(3, [`<< /Title (${title.replace(/[()\\]/g, '')}) /Producer (Post Pulse) >>`]);
  pages.forEach((page, i) => {
    const [pageId, contentId, imageId] = [
      pageIds[i] as number,
      (pageIds[i] as number) + 1,
      (pageIds[i] as number) + 2,
    ];
    const draw = `q ${page.width} 0 0 ${page.height} 0 0 cm /Im${i} Do Q`;
    object(pageId, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
        `/Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    ]);
    object(contentId, [`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`]);
    object(imageId, [
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      '\nendstream',
    ]);
  });

  const count = 4 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id += 1) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
