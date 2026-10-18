// Draws the app icon (SPEC §9.1: neutral, no LinkedIn marks) as PNGs without
// any image library: a blue rounded square with a white pulse line.
// Usage: npm run icons. Output is deterministic; commit public/icons/.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const [R, G, B] = [10, 102, 194] as const;
// Pulse polyline in a 0..1 box.
const PULSE: [number, number][] = [
  [0.16, 0.55],
  [0.36, 0.55],
  [0.45, 0.32],
  [0.55, 0.74],
  [0.64, 0.45],
  [0.7, 0.55],
  [0.84, 0.55],
];

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}

function segDist(px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** `inset` shrinks the artwork for maskable icons (safe zone = inner 80 %). */
function draw(size: number, { rounded, inset }: { rounded: boolean; inset: number }): Buffer {
  const out = new Uint8Array(size * size * 4);
  const r = rounded ? 0.22 : 0;
  const stroke = 0.075 * (1 - 2 * inset);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      // Rounded-square coverage with a 1 px soft edge.
      const qx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0);
      const qy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
      const edge = Math.hypot(qx, qy) - r;
      const bg = Math.max(0, Math.min(1, 0.5 - edge * size));
      // Pulse line in the (inset) art box.
      const au = (u - inset) / (1 - 2 * inset);
      const av = (v - inset) / (1 - 2 * inset);
      let d = Infinity;
      PULSE.slice(1).forEach((b, i) => {
        d = Math.min(d, segDist(au, av, PULSE[i] ?? b, b));
      });
      const line = Math.max(0, Math.min(1, (stroke / 2 - d) * size * (1 - 2 * inset) + 0.5));
      const o = (y * size + x) * 4;
      out[o] = Math.round(R + (255 - R) * line);
      out[o + 1] = Math.round(G + (255 - G) * line);
      out[o + 2] = Math.round(B + (255 - B) * line);
      out[o + 3] = Math.round(255 * bg);
    }
  }
  return png(size, out);
}

const OUT = 'public/icons';
const icons: [string, number, { rounded: boolean; inset: number }][] = [
  ['icon-192.png', 192, { rounded: true, inset: 0 }],
  ['icon-512.png', 512, { rounded: true, inset: 0 }],
  ['maskable-512.png', 512, { rounded: false, inset: 0.1 }],
  ['apple-touch-icon-180.png', 180, { rounded: false, inset: 0.06 }],
  ['favicon-32.png', 32, { rounded: true, inset: 0 }],
];
for (const [name, size, opts] of icons) {
  writeFileSync(`${OUT}/${name}`, draw(size, opts));
  console.log(`wrote ${OUT}/${name}`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#0a66c2"/><polyline points="${PULSE.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}" fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`;
writeFileSync(`${OUT}/favicon.svg`, svg);
console.log(`wrote ${OUT}/favicon.svg`);
