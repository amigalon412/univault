/* Render every pixel mark on the site to a PNG.

   The marks live as ink matrices and are drawn as SVG at runtime, which is
   right for the page and useless for anything else -- a banner, a slide, an
   avatar. This writes each one out as a transparent PNG in the site's own
   green, at a size big enough to drop into a 1500x500 header without
   resampling.

   Cells are upscaled with nearest-neighbour on purpose: these are pixel marks,
   and a smooth interpolation turns them into mush.

   Usage:  node scripts/export-icons.mjs
   Output: assets/icons/{flat,solid,glow}/NAME.png
*/

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/a1/meganode';
const OUT = path.join(ROOT, 'assets/icons');
const ACCENT = { r: 0xd6, g: 0xfe, b: 0x51 };
const SIZE = 640; // px per side, divisible by both 16 and 26

/* The matrices are TypeScript, and this is a plain node script, so they are
   read as text and pulled out with a regex rather than imported. Fragile in
   principle; in practice both files are generated or hand-authored in exactly
   this shape, and a miss is loud (zero marks written). */
function matricesFrom(file, re) {
  const src = readFileSync(path.join(ROOT, file), 'utf8');
  const out = [];
  for (const m of src.matchAll(re)) {
    const rows = [...m[2].matchAll(/"([0-9]+)"/g)].map((r) => r[1]);
    if (rows.length) out.push({ name: m[1], rows });
  }
  return out;
}

const logos = matricesFrom(
  'src/lib/pixel-logos.ts',
  /key:\s*"([A-Z]+)"[\s\S]*?rows:\s*\[([\s\S]*?)\]/g,
);
const glyphs = matricesFrom(
  'src/lib/pixel-glyphs.ts',
  /export const ([A-Z_]+) = glyph\([\s\S]*?\[([\s\S]*?)\]/g,
);

const marks = [...logos, ...glyphs];
if (!marks.length) throw new Error('no matrices parsed -- the source shape changed');

mkdirSync(path.join(OUT, 'flat'), { recursive: true });
mkdirSync(path.join(OUT, 'solid'), { recursive: true });
mkdirSync(path.join(OUT, 'glow'), { recursive: true });

for (const mark of marks) {
  const grid = mark.rows.length;
  const raw = Buffer.alloc(grid * grid * 4, 0);

  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const level = Number(mark.rows[y][x] ?? '0');
      if (!level) continue;
      const o = (y * grid + x) * 4;
      raw[o] = ACCENT.r;
      raw[o + 1] = ACCENT.g;
      raw[o + 2] = ACCENT.b;
      /* The same curve PixelLogo uses, not a linear level/9.
         The hand-authored pictograms draw their outline with '1' and reserve
         '9' for one accent detail, so a linear map renders the outline at 11%
         and the mark disappears. The floor of 0.35 is what makes a '1' a
         visible stroke rather than a smudge. */
      raw[o + 3] = Math.round((0.35 + (level / 9) * 0.65) * 255);
    }
  }

  const flat = await sharp(raw, { raw: { width: grid, height: grid, channels: 4 } })
    .resize(SIZE, SIZE, { kernel: 'nearest' })
    .png()
    .toBuffer();
  writeFileSync(path.join(OUT, 'flat', `${mark.name}.png`), flat);

  /* Every lit cell at full strength, shading discarded.
     The faithful version carries the page's 35% floor, which is right at 96px
     inside a bordered node and looks washed out blown up on a banner where the
     mark is the subject rather than a label. */
  const punch = Buffer.from(raw);
  for (let i = 3; i < punch.length; i += 4) if (punch[i]) punch[i] = 255;
  const solid = await sharp(punch, { raw: { width: grid, height: grid, channels: 4 } })
    .resize(SIZE, SIZE, { kernel: 'nearest' })
    .png()
    .toBuffer();
  writeFileSync(path.join(OUT, 'solid', `${mark.name}.png`), solid);

  /* The page puts a phosphor glow on these. Reproduced here rather than left
     to the compositing tool, so a banner assembled from these files matches
     the site instead of merely resembling it.

     Rendered on solid black, not on transparency. Blurring an image with an
     alpha channel bleeds the colour outwards against nothing and the halo
     washes out to white -- a glow is light added to a dark surface, so it only
     means anything over the background it will actually sit on. The site's
     background is black, so that is what these carry. */
  const halo = await sharp(flat).blur(SIZE / 45).toBuffer();
  const glow = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  })
    .composite([
      // Twice, because one pass of an already-faint halo is invisible on black.
      { input: halo, blend: 'screen' },
      { input: halo, blend: 'screen' },
      { input: flat, blend: 'over' },
    ])
    .png()
    .toBuffer();
  writeFileSync(path.join(OUT, 'glow', `${mark.name}.png`), glow);

  console.log(`${mark.name.padEnd(8)} ${grid}x${grid} -> ${SIZE}px`);
}

console.log(`\n${marks.length} marks -> ${OUT}/{flat,solid,glow}`);
