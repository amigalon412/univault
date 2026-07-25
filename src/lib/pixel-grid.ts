/**
 * Turns an ink matrix ('0'-'9' per cell) into one SVG path per ink level.
 *
 * The obvious rendering is a <rect> per lit cell, which is what this started
 * as — but a mark that lights 370 cells is 370 SVG elements, and there are
 * four of them. Cells that share an ink level also share an opacity, so they
 * can share a path: nine paths instead of hundreds of rects, identical output.
 *
 * Each cell is drawn at 0.8 of its slot, leaving a gutter — that gap is what
 * makes the result read as a display rather than as a low-resolution image.
 */
export interface PixelLevel {
  /** Ink level 1-9, mapped to opacity by the caller. */
  level: number;
  /** Path data in grid units. */
  d: string;
}

const INSET = 0.1;
const SIZE = 0.8;

export function pixelLevels(rows: string[]): PixelLevel[] {
  const byLevel = new Map<number, string[]>();

  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const level = row.charCodeAt(x) - 48;
      if (level <= 0) continue;
      const parts = byLevel.get(level) ?? [];
      parts.push(`M${x + INSET} ${y + INSET}h${SIZE}v${SIZE}h-${SIZE}z`);
      byLevel.set(level, parts);
    }
  });

  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, parts]) => ({ level, d: parts.join("") }));
}
