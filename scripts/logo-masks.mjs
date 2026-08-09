/* Turns a flat brand PNG into an alpha-only mask.
 *
 * The stock logos ship as artwork on an opaque near-white plate. Dropped onto
 * the page as <img> they bring four brand palettes and four faintly visible
 * grey squares with them. As CSS masks only the alpha channel survives, so the
 * page paints every mark in one grey and the plates disappear.
 *
 * Alpha is distance from the background rather than a threshold on luminance:
 * a threshold hard-clips antialiased edges into staircases at the sizes these
 * render at, and it cannot tell a white counter inside a logo (NVIDIA's eye,
 * which must stay a hole) from the plate around it. Distance handles both —
 * the eye is background-coloured, so it comes out transparent, which is
 * exactly the silhouette wanted.
 *
 *   node scripts/logo-masks.mjs
 */
import path from "node:path";
import sharp from "sharp";

const SRC = "/Users/a1/Desktop/video-template/public/icons";
const OUTS = [
  "/Users/a1/meganode/public/images/logos",
  "/Users/a1/meganode-pink/public/images/logos",
];

const LOGOS = [
  { src: path.join(SRC, "nvda.png"), out: "nvda.png" },
  { src: path.join(SRC, "aapl.png"), out: "aapl.png" },
  { src: path.join(SRC, "tsla.png"), out: "tsla.png" },
  { src: path.join(SRC, "amzn.png"), out: "amzn.png" },
  // Vector source, so it is rasterised big and then trimmed — going through
  // the same pipeline as the bitmaps means one grey and one edge treatment
  // across the whole row instead of two.
  { src: "/Users/a1/meganode/assets/logos/zerox.svg", out: "zerox.png", density: 600 },
];

/* How far a pixel has to sit from the plate colour to count as fully inked.
   Low enough that a pale brand tint still reads, high enough that JPEG-ish
   noise in the plate does not. */
const FULL_INK_DISTANCE = 90;

/** Trim the transparent margin so every mark fills its box the same way. */
async function trimToInk(buf, width, height, alpha) {
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 12) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (right < 0) return buf; // nothing inked — leave it alone
  return sharp(buf)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer();
}

for (const logo of LOGOS) {
  const { data, info } = await sharp(logo.src, { density: logo.density ?? 72 })
    .resize({ height: 400, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  // The plate colour, sampled from a corner rather than assumed to be white —
  // these were exported at different times against different backgrounds.
  const bg = [data[0], data[1], data[2]];

  const rgba = Buffer.alloc(width * height * 4);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const d = Math.sqrt(
      (data[o] - bg[0]) ** 2 + (data[o + 1] - bg[1]) ** 2 + (data[o + 2] - bg[2]) ** 2,
    );
    const a = Math.min(255, Math.round((d / FULL_INK_DISTANCE) * 255));
    alpha[i] = a;
    // White ink, so the mask is unambiguous when inspected on its own.
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = a;
  }

  const flat = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  const trimmed = await trimToInk(flat, width, height, alpha);

  for (const dir of OUTS) {
    await sharp(trimmed).png({ compressionLevel: 9 }).toFile(path.join(dir, logo.out));
  }
  console.log(`${path.basename(logo.src)} -> ${logo.out}`);
}
