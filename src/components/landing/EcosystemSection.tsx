import type { CSSProperties } from "react";
import { ECOSYSTEM_LOGOS } from "@/lib/landing";

/**
 * The rails the vault runs on, as a mask grid.
 *
 * The PNGs are used as CSS masks rather than drawn as images, so only their
 * alpha survives and every mark sits in the page's ink until you hover it —
 * then it takes its own brand colour. Six foreign palettes rendered straight
 * would be the loudest thing on a page built from two greys.
 *
 * `data-stagger` is read by <ScrollEffects />, which adds `.reveal` and a
 * per-cell delay so the grid resolves left to right.
 */
export function EcosystemSection() {
  return (
    <section id="ecosystem" className="eco-band">
      <div className="wrap">
        <div className="eco">
          <div className="eco-head reveal">
            <span className="eyebrow">{"// Ecosystem"}</span>
            <h2>Built on rails you already use</h2>
            <p>
              SAFEX does not run a chain, mint a stablecoin or custody a share. It
              reads the same rails everything else on BNB Chain reads — the
              stablecoin, the venues, the explorer and the wallet you already have.
            </p>
          </div>

          <div className="eco-grid" data-stagger="70">
            {ECOSYSTEM_LOGOS.map((logo) => (
              <div
                className="eco-cell"
                key={logo.name}
                style={{ "--bc": logo.accent } as CSSProperties}
              >
                <span
                  className="eco-logo"
                  role="img"
                  aria-label={logo.name}
                  style={
                    {
                      WebkitMaskImage: `url(${logo.mask})`,
                      maskImage: `url(${logo.mask})`,
                    } as CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
