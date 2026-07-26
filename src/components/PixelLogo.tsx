import { pixelLevels } from "@/lib/pixel-grid";
import { PIXEL_GRID, type PixelLogo as PixelLogoData } from "@/lib/pixel-logos";

interface PixelLogoProps {
  logo: PixelLogoData;
  /** Rendered size in px. The grid is square, so this is both dimensions. */
  size?: number;
  /**
   * Cells per side. Defaults to the 26 the company marks were sampled at; the
   * hand-authored pictograms in pixel-glyphs.ts are 16 and would render at the
   * wrong scale without this.
   */
  grid?: number;
  className?: string;
  /** For the caller to stagger a reveal — see .pixel-draw in globals.css. */
  style?: React.CSSProperties;
}

/**
 * A mark drawn as an LED matrix in the site's own green.
 *
 * The alternative was dropping the four brand PNGs onto the page, which puts
 * NVIDIA green, Amazon orange and Tesla red on a black monospace layout and
 * makes the section look like a partner logo strip. Rendering coverage instead
 * of colour keeps the marks recognisable while letting them belong here.
 *
 * Cells are grouped by ink level into one path each, so a mark that lights 370
 * cells ships as nine paths. Static SVG: it costs nothing after paint.
 */
export function PixelLogo({
  logo,
  size = 96,
  grid = PIXEL_GRID,
  className = "",
  style,
}: PixelLogoProps) {
  const levels = pixelLevels(logo.rows);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      role="img"
      aria-label={`${logo.name} (${logo.key})`}
      className={className}
      style={style}
      shapeRendering="crispEdges"
    >
      {levels.map((l) => (
        <path
          key={l.level}
          d={l.d}
          fill="currentColor"
          opacity={0.35 + (l.level / 9) * 0.65}
        />
      ))}
    </svg>
  );
}
