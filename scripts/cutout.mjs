/* Lifts a product render off its backdrop.
 *
 * Different job from logo-masks.mjs, which throws colour away and keeps only
 * an alpha silhouette. This keeps the pixels — the mark is a full-colour 3D
 * render — and only removes what it was photographed against.
 *
 * Two thresholds rather than one. The source has a soft contact shadow under
 * the safe, and a single cut either keeps it as a grey haze on transparency or
 * eats the object's antialiased edge along with it. Everything nearer the
 * backdrop than LO goes (that is the shadow), everything past HI is solid, and
 * the band between them ramps, which is where the edge pixels live.
 *
 * The edge is then unpremultiplied: a half-transparent edge pixel still holds
 * backdrop mixed into its colour, and left alone it prints as a white fringe
 * the moment the logo sits on anything dark. Solving for the original colour
 * costs four lines and makes the cutout background-independent.
 *
 *   node scripts/cutout.mjs
 */
import sharp from "sharp";

const SRC = "/Users/a1/Desktop/unilogo.png";
const OUT = "/Users/a1/meganode-pink/public/images/unilogo.png";

/* Distance from the backdrop colour, in RGB units. Below LO is backdrop or its
   shadow; above HI is object. Measured off this render: the shadow tops out
   around 30 and the palest pink on the safe is past 90. */
const LO = 42;
const HI = 78;

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

// Sampled, not assumed white — renders come out on whatever the tool defaulted to.
const bg = [data[0], data[1], data[2]];

const out = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  const o = i * channels;
  const r = data[o];
  const g = data[o + 1];
  const b = data[o + 2];
  const d = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);

  const a = Math.max(0, Math.min(1, (d - LO) / (HI - LO)));
  const q = i * 4;
  if (a <= 0) {
    out[q] = out[q + 1] = out[q + 2] = out[q + 3] = 0;
    continue;
  }
  // c = bg + (observed - bg) / a, clamped. At a = 1 this is the pixel itself.
  out[q] = Math.max(0, Math.min(255, Math.round(bg[0] + (r - bg[0]) / a)));
  out[q + 1] = Math.max(0, Math.min(255, Math.round(bg[1] + (g - bg[1]) / a)));
  out[q + 2] = Math.max(0, Math.min(255, Math.round(bg[2] + (b - bg[2]) / a)));
  out[q + 3] = Math.round(a * 255);
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .trim({ threshold: 1 }) // drop the now-empty margin so the nav can size it by cap height
  .resize({ height: 512, fit: "inside", withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(OUT);

const m = await sharp(OUT).metadata();
console.log(`unilogo.png -> ${m.width}x${m.height}, alpha: ${m.hasAlpha}`);
