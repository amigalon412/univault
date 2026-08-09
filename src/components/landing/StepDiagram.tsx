import type { StepArt } from "@/lib/landing";

/**
 * The art on the three "how it works" cards.
 *
 * These plates used to hold nothing but the verb set in mono, which is a
 * caption pretending to be an illustration. Each one now draws the mechanic
 * its card describes, in the page's own tokens: geometry and hairlines, no
 * raster, no stock art.
 *
 * All three share a 320x200 view box — the plate's 16/10 exactly — so they
 * scale as one set and their line weights stay consistent across the row.
 * Colour comes from CSS classes rather than SVG attributes so the pink build
 * inherits the whole set by retargeting tokens, same as everything else.
 *
 * The motion is the point of each diagram, not decoration: value travelling in
 * and shares coming back, flow dividing at the fork, drifted holdings being
 * pulled to the band. All of it is off under prefers-reduced-motion.
 */

const VIEW_BOX = "0 0 320 200";

/** Value arriving, and the share token minted back for it. */
function DepositArt() {
  return (
    <svg className="step-art" viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      {/* the stablecoin going in, as a stack rather than a disc — a lone ring
          with a bar through it reads as a "no entry" sign */}
      <path className="sd-face" d="M18 100 V116 A22 7 0 0 0 62 116 V100 Z" />
      <ellipse className="sd-face" cx="40" cy="100" rx="22" ry="7" />
      <path className="sd-face" d="M18 84 V100 A22 7 0 0 0 62 100 V84 Z" />
      <ellipse className="sd-face" cx="40" cy="84" rx="22" ry="7" />
      <ellipse className="sd-hair" cx="40" cy="84" rx="9" ry="2.9" />

      {/* into the vault */}
      <path className="sd-rail" d="M70 96 H104" />
      <path className="sd-head" d="M99 91 L105 96 L99 101" />
      <circle className="sd-dot sd-flow-in" cx="72" cy="96" r="3.4" />

      {/* the vault, drawn as the thing it is: a door with a dial */}
      <rect className="sd-face" x="110" y="40" width="108" height="112" rx="14" />
      <circle className="sd-hair" cx="164" cy="96" r="30" />
      <circle className="sd-ink" cx="164" cy="96" r="7" />
      <path className="sd-hair" d="M164 66 V76 M164 116 V126 M134 96 H144 M184 96 H194" />

      {/* shares back out */}
      <path className="sd-rail" d="M226 96 H256" />
      <path className="sd-head" d="M251 91 L257 96 L251 101" />
      <circle className="sd-dot sd-flow-out" cx="228" cy="96" r="3.4" />
      <path
        className="sd-accent"
        d="M286 74 L306 85 V107 L286 118 L266 107 V85 Z"
      />

      <text className="sd-label" x="40" y="146" textAnchor="middle">
        USDG
      </text>
      <text className="sd-label" x="164" y="176" textAnchor="middle">
        ERC-4626 VAULT
      </text>
      <text className="sd-label" x="286" y="146" textAnchor="middle">
        SHARES
      </text>
    </svg>
  );
}

/** One deposit dividing: the thicker branch is the yield floor. */
function SplitArt() {
  return (
    <svg className="step-art" viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <circle className="sd-ink" cx="20" cy="100" r="6" />
      <path className="sd-trunk" d="M26 100 H84" />
      <text className="sd-label" x="20" y="128">
        ONE TX
      </text>

      {/* Branch weight is the ratio, drawn: the yield leg carries the larger
          share, so it is the heavier stroke. Straight, not curved — the
          travelling dots below move linearly, and on a curve they would drift
          off their own branch. */}
      <path className="sd-branch sd-branch-a" d="M84 100 L152 60" />
      <path className="sd-branch sd-branch-b" d="M84 100 L152 148" />
      <circle className="sd-dot sd-flow-a" cx="84" cy="100" r="3.4" />
      <circle className="sd-dot sd-flow-b" cx="84" cy="100" r="3.4" />

      {/* interest accruing */}
      <rect className="sd-face" x="152" y="26" width="142" height="70" rx="10" />
      <text className="sd-label" x="166" y="44">
        LENDING VENUE
      </text>
      <path
        className="sd-pos"
        d="M166 84 H188 V76 H210 V68 H232 V62 H254 V56 H276"
      />

      {/* four holdings, identical because they are equally weighted */}
      <rect className="sd-face" x="152" y="110" width="142" height="76" rx="10" />
      <text className="sd-label" x="166" y="128">
        4 STOCKS · EQUAL
      </text>
      {[156, 192, 228, 264].map((x) => (
        <rect key={x} className="sd-chip" x={x} y="136" width="26" height="38" rx="5" />
      ))}
    </svg>
  );
}

/** Holdings drifting out of the band, and being pulled back into it. */
function RebalanceArt() {
  return (
    <svg className="step-art" viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <path className="sd-floor" d="M20 176 H300" />

      {/* two holdings on target, two drifted — the drifted pair is what moves */}
      <rect className="sd-bar" x="172" y="76" width="46" height="100" rx="5" />
      <rect className="sd-bar" x="242" y="86" width="46" height="90" rx="5" />
      <rect
        className="sd-bar sd-bar-off"
        style={{ "--k": 0.83 } as React.CSSProperties}
        x="32"
        y="46"
        width="46"
        height="130"
        rx="5"
      />
      <rect
        className="sd-bar sd-bar-off"
        style={{ "--k": 1.42 } as React.CSSProperties}
        x="102"
        y="120"
        width="46"
        height="56"
        rx="5"
      />

      {/* Drawn over the bars, not behind them: the band is the region the
          guard contract permits, so it has to read as laid across the whole
          basket rather than as another object standing beside it. */}
      <rect className="sd-band" x="24" y="70" width="272" height="26" rx="4" />
      <path className="sd-target" d="M24 83 H296" />
      <text className="sd-label" x="296" y="60" textAnchor="end">
        TARGET BAND
      </text>

      {/* Corrections as badges sitting on the bar tops. Arrows floating above
          them would need clearance the plate does not have, and the top-left
          corner is already the caption's. */}
      <g className="sd-badge-g" style={{ "--dy": "22px" } as React.CSSProperties}>
        <circle className="sd-badge" cx="55" cy="46" r="9.5" />
        <path className="sd-badge-arw" d="M51 44 L55 48.5 L59 44" />
      </g>
      <g className="sd-badge-g" style={{ "--dy": "-23.5px" } as React.CSSProperties}>
        <circle className="sd-badge" cx="125" cy="120" r="9.5" />
        <path className="sd-badge-arw" d="M121 122 L125 117.5 L129 122" />
      </g>
    </svg>
  );
}

const ART: Record<StepArt, () => React.ReactElement> = {
  deposit: DepositArt,
  split: SplitArt,
  rebalance: RebalanceArt,
};

export function StepDiagram({ kind }: { kind: StepArt }) {
  const Art = ART[kind];
  return <Art />;
}
