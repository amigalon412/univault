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
/* What the vault actually touches on BNB Chain: the five names in the basket,
   the stable it takes, the venue it trades on, the chain and the explorer.
   Ratios match BRAND_MASKS so a mark is the same size wherever it appears.

   IT USED TO RUN NVIDIA, AMAZON, TESLA, APPLE, PALANTIR AND SPACEX. Those are
   the Robinhood basket and none of them exists as a bStock -- the row was
   showing six companies the vault cannot hold, on the same page whose picker
   lists the five it does. The ecosystem grid was cut short for exactly this
   reason during the port; this row was missed. */
const LOGOS = [
  { name: "BNB Chain", src: "/images/logos/bnb.png", ratio: 1 },
  { name: "S&P 500", src: "/images/logos/spy.png", ratio: 1 },
  { name: "Nasdaq 100", src: "/images/logos/qqq.png", ratio: 1 },
  { name: "Google", src: "/images/logos/googl.png", ratio: 0.98 },
  { name: "Microsoft", src: "/images/logos/msft.png", ratio: 1 },
  { name: "Meta", src: "/images/logos/meta.png", ratio: 1.506 },
  { name: "Tether", src: "/images/logos/usdt.png", ratio: 1.148 },
  { name: "PancakeSwap", src: "/images/logos/pancakeswap.png", ratio: 1 },
  { name: "BscScan", src: "/images/logos/bscscan.png", ratio: 1 },
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
