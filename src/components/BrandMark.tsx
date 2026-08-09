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
  if (!mask) return <span className={className}>{sym}</span>;

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
