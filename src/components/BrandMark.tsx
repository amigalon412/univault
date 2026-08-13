import type { CSSProperties } from "react";

/**
 * A holding's real mark, small.
 *
 * <PixelLogo /> is the house treatment and it is the right one at 96px, where
 * a 26-cell grid still has cells. Below roughly 28px the cells fall under a
 * device pixel each and every mark collapses into the same dark smudge — the
 * orbit badges and the holdings rows were four indistinguishable blobs.
 *
 * So under that size the mark comes from the same alpha masks the marquee
 * uses: one grey, crisp at any size, no brand palette and no export plate.
 * Regenerate them with `node scripts/logo-masks.mjs`.
 */
/*
 * `k` is optical, not geometric. Cap height alone lines the marks up by a
 * measurement nobody sees: the NVIDIA eye is short and very wide, so at the
 * same cap as the Apple silhouette it carries visibly more ink. The factor
 * evens out the weight.
 */
export interface BrandMask {
  src: string;
  /** Source aspect ratio, width / height. */
  ratio: number;
  /** Optical size correction — see above. */
  k: number;
}

export const BRAND_MASKS: Record<string, BrandMask> = {
  NVDA: { src: "/images/logos/nvda-mark.png", ratio: 1.506, k: 0.88 },
  AAPL: { src: "/images/logos/aapl.png", ratio: 0.808, k: 1 },
  TSLA: { src: "/images/logos/tsla-mark.png", ratio: 1.049, k: 1 },
  AMZN: { src: "/images/logos/amzn.png", ratio: 1, k: 0.94 },
  /* The stablecoin, for rows about the lending leg. Its artwork is a filled
     disc with the G knocked out, so as a mask it paints a solid coin with the
     letter showing the surface underneath — which is the logo, not a defect.
     A disc reads heavier than a silhouette at the same cap, hence the k. */
  USDG: { src: "/images/logos/usdg.png", ratio: 0.999, k: 0.88 },

  /* Added with the basket expansion. Ratios are the generated files' own
     dimensions, so they follow the artwork rather than being eyeballed.
     Google's G and Microsoft's grid both fill their box solidly, hence the
     lighter k; Palantir's is a thin outline and carries less ink, so it keeps
     the full cap. */
  GOOGL: { src: "/images/logos/googl.png", ratio: 0.98, k: 0.92 },
  MSFT: { src: "/images/logos/msft.png", ratio: 1, k: 0.9 },
  PLTR: { src: "/images/logos/pltr.png", ratio: 0.8, k: 1 },

  /* Its own file, not the one the marquee uses. The full SpaceX mark is the X
     with a swoosh trailing about twice as far again; at a badge cap the swoosh
     is a vanishing hairline that only pushes the X off-centre. spcx-mark.png
     is the X alone. Before it existed this key was absent and the component
     fell back to printing the ticker, which collided with the row label
     beside it. */
  SPCX: { src: "/images/logos/spcx-mark.png", ratio: 1.529, k: 0.86 },

  /* ── the BNB Chain basket ────────────────────────────────────────────
     Binance's bStocks carry a B, and the mark belongs to the company rather
     than to the wrapper, so GOOGLB reuses Alphabet's own G. Missing keys are
     the bug this whole block prevents: without them the component printed the
     ticker over the row label, which is exactly what happened to SpaceX and
     then to all five of these. */
  GOOGLB: { src: "/images/logos/googl.png", ratio: 0.98, k: 0.92 },
  MSFTB: { src: "/images/logos/msft.png", ratio: 1, k: 0.9 },
  METAB: { src: "/images/logos/meta.png", ratio: 1.506, k: 0.9 },

  /* SPY and QQQ are index ETFs, and neither SPDR nor Invesco publishes a mark
     reachable without an account. They are known by the ticker anyway -- the
     lettermark IS the identity. Drawn as type and run through the same alpha
     pipeline as the brand masks, so the row keeps one grey and one edge
     treatment rather than two. Square canvas, because the same mark has to sit
     in a row AND inside a circular orbit badge -- a 2.5:1 wordmark spills
     straight out of the badge. */
  SPYB: { src: "/images/logos/spy.png", ratio: 1, k: 1 },
  QQQB: { src: "/images/logos/qqq.png", ratio: 1, k: 1 },

  /* The stable, for rows about the lending leg. */
  USDT: { src: "/images/logos/usdt.png", ratio: 1.148, k: 0.88 },
};

interface BrandMarkProps {
  /** Ticker. Falls back to rendering the ticker itself if it has no mask. */
  sym: string;
  /** Cap height in px; the width follows from the source aspect ratio. */
  size?: number;
  className?: string;
}

export function BrandMark({ sym, size = 22, className = "" }: BrandMarkProps) {
  const mask = BRAND_MASKS[sym];
  /* A missing key used to print the raw ticker into a slot sized for a mark,
     where it overlapped whatever label sat beside it. It now renders as a
     contained lettermark instead: still obviously a fallback, but one that
     cannot break a layout while nobody is looking. */
  if (!mask) {
    return (
      <span
        className={`brandmark-fallback ${className}`.trim()}
        role="img"
        aria-label={sym}
        style={{ "--cap": `${size}px` } as CSSProperties}
      >
        {sym}
      </span>
    );
  }

  return (
    <span
      className={`brandmark ${className}`.trim()}
      role="img"
      aria-label={sym}
      style={
        {
          "--cap": `${size * mask.k}px`,
          "--ratio": mask.ratio,
          WebkitMaskImage: `url(${mask.src})`,
          maskImage: `url(${mask.src})`,
        } as CSSProperties
      }
    />
  );
}
