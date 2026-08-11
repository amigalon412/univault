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
/* Square brand tiles kept alongside the other project; the only artwork on
   hand for the tickers added after the original four. */
const INDEX_TILES = (sym) => `/Users/a1/theindex/public/images/stocks/${sym}.webp`;
/** Vector sources, checked in beside zerox.svg. */
const VEC = "/Users/a1/meganode-pink/assets/logos";
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

  /* Badge-sized variants. The marquee runs these marks at a 46px cap where
     the full lockups are exactly right; <BrandMark /> runs them at 15-22px
     inside a round badge, where the same two files fail in opposite ways —
     NVIDIA's wordmark turns to mush under a 7px cap, and Tesla's plate is a
     filled disc that becomes a grey blob sitting in a white circle. Both are
     recoverable from the same sources, so neither needs new artwork. */
  { src: path.join(SRC, "nvda.png"), out: "nvda-mark.png", topBlockOnly: true },
  { src: path.join(SRC, "tsla.png"), out: "tsla-mark.png", knockout: true },

  /* The 2026-08 additions. Sources are the square tiles from ../theindex,
     which are the only artwork on hand for these four.

     Two of them sit on a dark plate rather than a near-white one. The corner
     sample already handles that — the plate colour is read, not assumed — but
     the ink distance cannot stay at 90: white on black is ~441 apart, so every
     edge pixel saturates at the first step and the antialiased ramp collapses
     into a staircase. A wider distance keeps the ramp. */
  /* Microsoft stays on the tile: its mark is four solid squares, which the
     bitmap carries perfectly and no vector would improve. */
  { src: INDEX_TILES("MSFT"), out: "msft.png" },

  /* The rest come from vector now. The tiles were the only artwork on hand
     in the first pass and two of them were the wrong thing entirely: the
     SpaceX tile is the SPACEX wordmark at roughly 9:1, which is a smear in a
     round badge, and Palantir's came off a gradient plate. Vector sources are
     one rasterise away from a clean silhouette at any size, and they go
     through the same pipeline as zerox.svg — one grey, one edge treatment. */
  { src: `${VEC}/google.svg`, out: "googl.png", density: 600 },
  { src: `${VEC}/palantir.svg`, out: "pltr.png", density: 600 },
  { src: `${VEC}/spacex.svg`, out: "spcx.png", density: 600 },

  /* Badge variant. The full mark is the X plus a swoosh that trails off to
     about three times the X's width — at a 15px cap the swoosh is a hairline
     that disappears and the X is left tiny and off-centre in its badge. This
     keeps the square block at the left, which is the X itself. */
  { src: `${VEC}/spacex.svg`, out: "spcx-mark.png", density: 600, leftSquare: true },
];

/* How far a pixel has to sit from the plate colour to count as fully inked.
   Low enough that a pale brand tint still reads, high enough that JPEG-ish
   noise in the plate does not. */
const FULL_INK_DISTANCE = 90;

/** Bounding box of everything inked, or null if nothing is. */
function inkBounds(width, height, alpha) {
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
  return right < 0 ? null : { left, top, right, bottom };
}

/** Trim the transparent margin so every mark fills its box the same way. */
async function trimToInk(buf, width, height, alpha) {
  const b = inkBounds(width, height, alpha);
  if (!b) return buf; // nothing inked — leave it alone
  return sharp(buf)
    .extract({
      left: b.left,
      top: b.top,
      width: b.right - b.left + 1,
      height: b.bottom - b.top + 1,
    })
    .png()
    .toBuffer();
}

/**
 * Keep only the mark above the wordmark.
 *
 * A logo-over-name lockup always has a clear band of empty rows between the
 * two, so the cut is the first such gap rather than a fraction measured off
 * this one file — retracing the artwork later cannot silently move it.
 */
function keepTopBlock(width, height, alpha) {
  const b = inkBounds(width, height, alpha);
  if (!b) return;
  const inked = (y) => {
    for (let x = b.left; x <= b.right; x++) if (alpha[y * width + x] > 12) return true;
    return false;
  };
  const GAP = Math.max(3, Math.round((b.bottom - b.top) * 0.03));
  let run = 0;
  for (let y = b.top; y <= b.bottom; y++) {
    run = inked(y) ? 0 : run + 1;
    if (run < GAP) continue;
    alpha.fill(0, (y - run + 1) * width); // everything from the gap down
    return;
  }
}

/**
 * Keep the square block at the left edge of the ink.
 *
 * For a symbol-plus-flourish lockup laid out horizontally — SpaceX's X and the
 * swoosh that trails off it — the symbol occupies a roughly square area at the
 * left and the flourish everything after. Cutting at one ink-height from the
 * left takes the symbol without measuring this one file: the box follows the
 * artwork's own height, so redrawing it later cannot silently move the cut.
 */
function keepLeftSquare(width, height, alpha) {
  const b = inkBounds(width, height, alpha);
  if (!b) return;
  const side = b.bottom - b.top + 1;
  const cut = b.left + side;
  if (cut >= b.right) return; // already square or narrower — nothing to trim
  for (let y = 0; y < height; y++) alpha.fill(0, y * width + cut, y * width + width);
}

/**
 * Swap ink and plate inside a round badge.
 *
 * Tesla's artwork is a filled disc with the T knocked out of it, which as a
 * mask paints a solid grey coin. What is wanted at badge size is the bare T,
 * so the alpha is inverted — clipped to just inside the disc, or the corners
 * the disc never covered would come back as ink.
 */
function knockOut(width, height, alpha) {
  const b = inkBounds(width, height, alpha);
  if (!b) return;
  const cx = (b.left + b.right) / 2;
  const cy = (b.top + b.bottom) / 2;
  const r = Math.min(b.right - b.left, b.bottom - b.top) / 2 - 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      alpha[i] = (x - cx) ** 2 + (y - cy) ** 2 <= r * r ? 255 - alpha[i] : 0;
    }
  }
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

  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const d = Math.sqrt(
      (data[o] - bg[0]) ** 2 + (data[o + 1] - bg[1]) ** 2 + (data[o + 2] - bg[2]) ** 2,
    );
    /* Everything within `plateFloor` of the corner sample is plate, not ink.
       Needed for artwork whose background is a gradient rather than a flat
       fill: without it the whole tile registers a few units of distance, never
       trims, and the mask paints a faint grey square around the mark. */
    const inked = Math.max(0, d - (logo.plateFloor ?? 0));
    alpha[i] = Math.min(255, Math.round((inked / (logo.inkDistance ?? FULL_INK_DISTANCE)) * 255));
  }

  if (logo.knockout) knockOut(width, height, alpha);
  if (logo.topBlockOnly) keepTopBlock(width, height, alpha);
  if (logo.leftSquare) keepLeftSquare(width, height, alpha);

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    // White ink, so the mask is unambiguous when inspected on its own.
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = alpha[i];
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
