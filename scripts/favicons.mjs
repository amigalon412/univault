/* Renders the UNIVAULT mark into the favicon set.
 *
 * The mark itself (components/icons.tsx, VaultMark) is three concentric
 * outlines: a rounded square, a ring and four ticks, all at stroke 2.5 on a 32
 * grid. That is right in the nav at 28px and unreadable as an icon — at 16px
 * those strokes land on 1.25 device pixels each and the whole thing greys out.
 *
 * So the icon inverts it: the rounded square stops being a stroke and becomes
 * the tile, filled with the accent, and the ring and ticks are knocked out of
 * it in white. Same mark, one figure instead of three, and the contrast comes
 * from a filled shape rather than from hairlines.
 *
 * The 16px face drops the ticks. They sit 12-14 units from centre on a 32
 * grid, so they render about 1.6px long — at that size they are four grey
 * smudges against the tile edge and the ring reads better without them.
 *
 *   node scripts/favicons.mjs
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const ACCENT = "#fc72ff";
const OUT = "/Users/a1/meganode-pink/public";
const ICO = "/Users/a1/meganode-pink/src/app/favicon.ico";

/** @param {{ size: number, ticks: boolean, ring: number, stroke: number, rx: number }} o */
const svg = ({ size, ticks, ring, stroke, rx }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <rect width="32" height="32" rx="${rx}" fill="${ACCENT}"/>
  <circle cx="16" cy="16" r="${ring}" fill="none" stroke="#fff" stroke-width="${stroke}"/>
  ${
    ticks
      ? `<path d="M16 4.6v3.4M16 24v3.4M4.6 16h3.4M24 16h3.4" fill="none"
            stroke="#fff" stroke-width="${stroke}" stroke-linecap="round"/>`
      : ""
  }
</svg>`;

/*
 * Each face is rasterised straight at its target size rather than rendered
 * large and downscaled. Downscaling antialiases twice — once in the
 * rasteriser, once in the resampler — and at 16px the second pass is what
 * turned the ring into a pink blob.
 *
 * Geometry is per-face for the same reason: at 16 the corner radius has to
 * come in and the ring has to grow, or the tile eats the mark.
 */
const FACES = [
  // Apple touch icon, and the general-purpose square mark.
  { file: "seo/favicon.png", size: 900, ticks: true, ring: 7, stroke: 3, rx: 7 },
  { file: "images/logo.png", size: 900, ticks: true, ring: 7, stroke: 3, rx: 7 },
  { file: "seo/favicon-32.png", size: 32, ticks: true, ring: 7, stroke: 3, rx: 7 },
  { file: "seo/favicon-16.png", size: 16, ticks: false, ring: 8.5, stroke: 4, rx: 5 },
];

for (const face of FACES) {
  await sharp(Buffer.from(svg(face)))
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${face.file}`);
  console.log(`${face.file} -> ${face.size}x${face.size}`);
}

/*
 * src/app/favicon.ico — the one Next picks up by convention and links ahead of
 * the PNGs, so leaving it alone would have left the old mark winning in most
 * browsers. It also has to keep existing: plenty of clients fetch /favicon.ico
 * blind and never read the <link> tags at all.
 *
 * Built by hand because sharp neither reads nor writes ICO. Since Vista the
 * container may hold PNG payloads directly, so this is a 6-byte directory
 * header, one 16-byte entry per size, and the PNGs themselves appended — no
 * BMP encoding, no palette.
 */
const icoSizes = [16, 32, 48];
const pngs = await Promise.all(
  icoSizes.map((size) =>
    sharp(
      Buffer.from(
        svg(
          size === 16
            ? { size, ticks: false, ring: 8.5, stroke: 4, rx: 5 }
            : { size, ticks: true, ring: 7, stroke: 3, rx: 7 },
        ),
      ),
    )
      .png({ compressionLevel: 9 })
      .toBuffer(),
  ),
);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(icoSizes.length, 4);

let offset = 6 + 16 * icoSizes.length;
const entries = icoSizes.map((size, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size === 256 ? 0 : size, 0); // width, 0 means 256
  e.writeUInt8(size === 256 ? 0 : size, 1); // height
  e.writeUInt8(0, 2); // palette size, 0 for truecolour
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});

writeFileSync(ICO, Buffer.concat([header, ...entries, ...pngs]));
console.log(`favicon.ico -> ${icoSizes.join(", ")}`);
