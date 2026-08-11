import type { CSSProperties } from "react";

/**
 * Marks the vault touches, running past on a loop.
 *
 * Every one is a CSS mask, not an image: the alpha channel is all that
 * survives, so six brand palettes arrive as one grey and none of them brings
 * the pale plate its artwork was exported on.
 *
 * A masked span has no intrinsic size, so each carries its source aspect
 * ratio and the CSS multiplies it by one shared cap height (--cap). Sizing the
 * row is then one number in one place, and the ratios never have to be
 * recomputed by hand when it changes.
 *
 * Regenerate the masks with `node scripts/logo-masks.mjs`.
 */
const LOGOS = [
  { name: "0x", src: "/images/logos/zerox.png", ratio: 1.632 },
  { name: "Robinhood", src: "/images/logos/robinhood.png", ratio: 0.8 },
  { name: "NVIDIA", src: "/images/logos/nvda.png", ratio: 1.293 },
  { name: "Amazon", src: "/images/logos/amzn.png", ratio: 1 },
  { name: "Tesla", src: "/images/logos/tsla.png", ratio: 1 },
  { name: "Apple", src: "/images/logos/aapl.png", ratio: 0.808 },
  { name: "Google", src: "/images/logos/googl.png", ratio: 0.98 },
  { name: "Microsoft", src: "/images/logos/msft.png", ratio: 1 },
  { name: "Palantir", src: "/images/logos/pltr.png", ratio: 0.8 },
  /* The full SpaceX mark, swoosh included — this row has the width for it and
     0x already sits at 1.63. The badges use spcx-mark.png instead, which is
     the X on its own; see BRAND_MASKS. */
  { name: "SpaceX", src: "/images/logos/spcx.png", ratio: 2.564 },
] as const;

/**
 * One pass of the row.
 *
 * Rendered twice inside the track, because the animation translates by exactly
 * -50%: at the halfway point the second copy sits precisely where the first
 * started, so the loop has no seam and no jump at any viewport width. The
 * duplicate is decoration, so it is hidden from readers — otherwise every
 * logo is announced twice.
 */
function Run({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="marquee-run" aria-hidden={hidden || undefined}>
      {LOGOS.map((logo) => (
        <span
          key={logo.name}
          className="marquee-logo"
          role={hidden ? undefined : "img"}
          aria-label={hidden ? undefined : logo.name}
          style={
            {
              "--ratio": logo.ratio,
              WebkitMaskImage: `url(${logo.src})`,
              maskImage: `url(${logo.src})`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function LogoMarquee() {
  return (
    <div className="logo-marquee">
      <div className="marquee-track">
        <Run />
        <Run hidden />
      </div>
    </div>
  );
}
