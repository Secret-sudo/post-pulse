// @vitest-environment node
// TC-SC06: the PDF writer produces a valid file: header, page count, and a
// cross-reference table whose offsets point at the right objects.
import { buildPdf } from './pdf.ts';

const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

describe('PDF writer', () => {
  it('TC-SC06 writes one image page per slide with a correct xref table', () => {
    const jpeg = (n: number) => new Uint8Array([0xff, 0xd8, n, 0xff, 0xd9]);
    const pdf = text(
      buildPdf(
        [
          { jpeg: jpeg(1), width: 1080, height: 1350 },
          { jpeg: jpeg(2), width: 1080, height: 1350 },
        ],
        'My (title)',
      ),
    );
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf).toContain('/Type /Pages /Count 2 /Kids [4 0 R 7 0 R]');
    expect(pdf).toContain('/MediaBox [0 0 1080 1350]');
    expect(pdf).toContain('/Title (My title)');
    expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(2);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);

    const startxref = Number(/startxref\n(\d+)\n/.exec(pdf)?.[1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
    const entries = pdf
      .slice(startxref)
      .split('\n')
      .slice(3, 3 + 9);
    entries.forEach((entry, i) => {
      const offset = Number(entry.slice(0, 10));
      const header = `${i + 1} 0 obj\n`;
      expect(pdf.slice(offset, offset + header.length), `object ${i + 1}`).toBe(header);
    });
  });
});
