/* Turns the four company marks into low-resolution ink matrices.

   The source PNGs are full-colour marks on a light disc. On a black, lime,
   monospace page they read as four stickers from someone else's brand book,
   which is exactly the objection. Sampling them down to a coarse grid and
   keeping only coverage — not colour — lets the page draw them in its own
   green, at its own resolution, like a mark rendered on a dot-matrix display.

   Emits src/lib/pixel-logos.ts: one row-string per logo, one character per
   cell, '0'-'9' for how much ink covers that cell. */

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const SRC = '/Users/a1/Desktop/video-template/public/icons';
const OUT = '/Users/a1/meganode/src/lib/pixel-logos.ts';
const GRID = 26;
const BG = { r: 242, g: 242, b: 242 };

/* `keepTop` crops the source before anything else, as a fraction of its height.
   NVIDIA's asset is the eye mark stacked over the NVIDIA wordmark; six-pixel-tall
   letterforms sample down to noise, so only the mark is kept.

   `mode: 'light'` inverts what counts as ink. Tesla's asset is a solid red badge
   with the T knocked out of it — read the normal way it comes back as a filled
   disc, and the one recognisable thing about it disappears. Reading the light
   pixels inside the badge instead draws the T itself. */
const LOGOS = [
  { key: 'NVDA', file: 'nvda.png', name: 'NVIDIA', keepTop: 0.6 },
  { key: 'AAPL', file: 'aapl.png', name: 'Apple' },
  { key: 'TSLA', file: 'tsla.png', name: 'Tesla', mode: 'light' },
  { key: 'AMZN', file: 'amzn.png', name: 'Amazon' },
];

/** Rec. 709 luma, 0..1. */
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const out = [];

for (const logo of LOGOS) {
  // Flatten onto the disc colour first so the alpha edge does not trim as ink.
  let img = sharp(path.join(SRC, logo.file)).flatten({ background: BG });

  if (logo.keepTop) {
    const meta = await img.metadata();
    img = sharp(
      await img
        .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * logo.keepTop) })
        .toBuffer(),
    );
  }

  const { data, info } = await img
    // Crop the uniform border away so every mark fills its grid the same amount.
    .trim({ threshold: 12 })
    .resize(GRID, GRID, { fit: 'contain', background: BG, kernel: 'lanczos3' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ink = [];
  const C = (GRID - 1) / 2;
  for (let i = 0; i < GRID * GRID; i++) {
    const o = i * info.channels;
    const [r, g, b] = [data[o], data[o + 1], data[o + 2]];
    if (logo.mode === 'light') {
      // The knockout is the same white as the canvas around the badge, so it
      // cannot be masked by colour. The badge is circular and trimmed to its
      // own bounding box, so the inscribed circle is the mask.
      const x = i % GRID, y = Math.floor(i / GRID);
      const inside = Math.hypot(x - C, y - C) < GRID * 0.45;
      ink.push(inside && luma(r, g, b) > 0.55 ? 1 : 0);
    } else {
      ink.push(1 - luma(r, g, b));
    }
  }

  // Normalise per logo: Apple is pure black, NVIDIA's green is mid-grey, and
  // without this the NVIDIA tile would come out half as bright as the others.
  const max = Math.max(...ink);
  const rows = [];
  for (let y = 0; y < GRID; y++) {
    let row = '';
    for (let x = 0; x < GRID; x++) {
      const v = max > 0 ? ink[y * GRID + x] / max : 0;
      // Below ~18% coverage is anti-aliasing fringe, not mark.
      row += v < 0.18 ? '0' : String(Math.min(9, Math.max(1, Math.round(v * 9))));
    }
    rows.push(row);
  }

  const lit = rows.join('').split('').filter((c) => c !== '0').length;
  console.log(`${logo.key}: ${lit}/${GRID * GRID} cells lit`);
  out.push({ ...logo, rows });
}

const body = `/* GENERATED — see scratchpad/pixelate-logos.mjs. Do not hand-edit.

   The four company marks sampled down to a ${GRID}x${GRID} ink grid. One character
   per cell, '0' (empty) to '9' (solid). Colour is deliberately discarded: the
   page draws these in its own green, so four foreign brand palettes never land
   on a black monospace layout. */

export const PIXEL_GRID = ${GRID};

export interface PixelLogo {
  /** Ticker of the tokenized stock token. */
  key: string;
  /** Company the token tracks. */
  name: string;
  /** ${GRID} strings of ${GRID} characters, '0'-'9' ink coverage. */
  rows: string[];
}

export const PIXEL_LOGOS: PixelLogo[] = [
${out
  .map(
    (l) =>
      `  {\n    key: ${JSON.stringify(l.key)},\n    name: ${JSON.stringify(l.name)},\n    rows: [\n${l.rows
        .map((r) => `      ${JSON.stringify(r)},`)
        .join('\n')}\n    ],\n  },`,
  )
  .join('\n')}
];
`;

writeFileSync(OUT, body);
console.log('->', OUT);
