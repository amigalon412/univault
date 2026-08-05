import { cn } from "@/lib/utils";

/**
 * The UNIVAULT wordmark, drawn as a pixel grid.
 *
 * SVG rather than text, and that is the whole point of this file. The mark this
 * replaces was built the way the old BLUR one was — half-block characters in a
 * monospace face — and it did not survive the rename. Two reasons, both fatal:
 *
 *   1. The figlet alphabet draws each letter as a solid body plus a drop shadow
 *      made of box-drawing glyphs (╔ ╗ ╚ ═ ║). Those are hairlines. In UNIVAULT
 *      every stroke that distinguishes one letter from the next is one of them
 *      — the diagonal of the N, the join of the V, the crossbar of the A — so
 *      under the neon they disappeared and the mark read as a row of bars.
 *   2. Even with solid blocks only, the geometry is at the mercy of the font:
 *      U+2588 does not fill the em box in every face, so rows separate, columns
 *      drift, and the letterforms come apart at exactly the sizes that matter.
 *
 * A grid of rects has neither problem. It is pixel-exact at any size, it scales
 * with its container instead of with a font size, and it renders identically
 * everywhere. It also puts the wordmark in the same visual language as the
 * company marks in pixel-logos.ts, which are drawn the same way.
 *
 * The figlet LOOK is reproduced rather than borrowed: solid body, plus the
 * one-cell offset hairline outline that gave the BLUR mark its depth. Here that
 * outline is derived from the letterforms instead of being a second alphabet,
 * so it can never contradict them.
 */

/** 5 wide by 7 tall per letter. '1' is ink. */
const GLYPHS: Record<string, string[]> = {
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
};

const WORD = "UNIVAULT";
const GLYPH_W = 5;
const GLYPH_H = 7;
const GAP = 1;

/** How far down and right the hairline shadow sits, in grid cells. */
const SHADOW = 0.5;

const GRID_W = WORD.length * GLYPH_W + (WORD.length - 1) * GAP;
const VIEW_W = GRID_W + SHADOW;
const VIEW_H = GLYPH_H + SHADOW;

/** Every lit cell in the word, as [x, y] on the grid. */
const CELLS: [number, number][] = WORD.split("").flatMap((ch, i) => {
  const rows = GLYPHS[ch];
  const originX = i * (GLYPH_W + GAP);
  const out: [number, number][] = [];
  for (let y = 0; y < GLYPH_H; y++) {
    for (let x = 0; x < GLYPH_W; x++) {
      if (rows[y][x] === "1") out.push([originX + x, y]);
    }
  }
  return out;
});

/**
 * The silhouette of the lit cells, as one path.
 *
 * Every cell contributes its four edges; an edge shared by two neighbouring
 * cells is emitted twice and cancels, because the second insert deletes the
 * first. What survives is exactly the boundary — no interior grid lines, which
 * is what separates a drop shadow from a wireframe.
 */
const OUTLINE = (() => {
  const edges = new Map<string, string>();
  for (const [x, y] of CELLS) {
    const segments: [number, number, number, number][] = [
      [x, y, x + 1, y],
      [x + 1, y, x + 1, y + 1],
      [x, y + 1, x + 1, y + 1],
      [x, y, x, y + 1],
    ];
    for (const [x1, y1, x2, y2] of segments) {
      const key = `${x1},${y1},${x2},${y2}`;
      if (edges.has(key)) edges.delete(key);
      else edges.set(key, `M${x1} ${y1}L${x2} ${y2}`);
    }
  }
  return Array.from(edges.values()).join("");
})();

export function WordMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      /* meet + xMidYMid so the mark letterboxes inside its box rather than
         stretching when the container is a different ratio. */
      preserveAspectRatio="xMidYMid meet"
      className={cn("wordmark block", className)}
      role="img"
      aria-label="UNIVAULT"
    >
      {/* The shadow first, so the body sits on top of it. Not crispEdges: this
          is a half-cell-offset hairline, and snapping it to the device grid is
          what makes an outline look like it slipped. */}
      <g transform={`translate(${SHADOW} ${SHADOW})`} opacity={0.85}>
        <path
          d={OUTLINE}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.12}
          vectorEffect="non-scaling-stroke"
        />
      </g>
      {/* The body. crispEdges here, so the blocks keep hard pixel edges at any
          size instead of picking up an antialiased fringe. */}
      <g shapeRendering="crispEdges">
        {CELLS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
        ))}
      </g>
    </svg>
  );
}
