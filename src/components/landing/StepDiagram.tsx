import { BRAND_MASKS } from "@/components/BrandMark";
import { BASKET_STOCKS, STABLE_SYMBOL } from "@/lib/chain";
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

/**
 * The four holdings in the split diagram's lower box.
 *
 * Four blank chips said "four of something"; the marks say which four, and the
 * card's claim is that the basket is a named, checkable set rather than a
 * gesture. Sizes come from the same table <BrandMark /> uses, so a mark that is
 * retraced or re-cropped moves in both places at once.
 */
const CHIP_W = 30;
const CHIP_H = 24;
const CHIP_CAP = 11;
const COLS = 4;
const ROW_Y = [134, 160];

/* Positions are computed from BASKET_STOCKS rather than written out, so the
   diagram cannot keep drawing four chips after a fifth name is added. Four to
   a row: the box is 142 wide and eight chips side by side would each be under
   16px, at which point the marks are back to being blobs — which is the exact
   problem <BrandMark /> exists to solve. */
const BASKET = BASKET_STOCKS.map(({ symbol }, i) => ({
  sym: symbol,
  x: 154 + (i % COLS) * 36,
  y: ROW_Y[Math.floor(i / COLS)] ?? ROW_Y[ROW_Y.length - 1],
}));

/** Value arriving, and the share token minted back for it. */
function DepositArt() {
  return (
    <svg className="step-art" viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      {/* the stablecoin going in, as a stack rather than a disc — a lone ring
          with a bar through it reads as a "no entry" sign */}
      {/* Tether's own mark rather than a generic coin stack. The artwork is a
          24x24 viewBox, so it is translated and scaled into this diagram's
          coordinates instead of being redrawn by hand -- redrawing a brand is
          how you end up with something that is nearly it. */}
      <g transform="translate(14 70) scale(2.17)" className="sd-face">
        <path d="M18.7538 10.5176c0 .6251-2.2379 1.1483-5.2381 1.2812l.0028.0007c-.0848.0064-.5233.0325-1.5012.0325-.7778 0-1.33-.0233-1.5237-.0325-3.0059-.1322-5.2495-.6555-5.2495-1.2819s2.2436-1.149 5.2495-1.2834v2.0442c.1965.0142.7594.0474 1.5372.0474.9334 0 1.4008-.0389 1.4849-.0466V9.2356c2.9994.1337 5.2381.657 5.2381 1.282zm5.19.5466L12.1248 22.389a.1803.1803 0 0 1-.2496 0L.0562 11.0635a.1781.1781 0 0 1-.0382-.2079l4.3762-9.1921a.1767.1767 0 0 1 .1626-.1026h14.8878a.1768.1768 0 0 1 .1612.1032l4.3762 9.1922a.1782.1782 0 0 1-.0382.2079zm-4.478-.4038c0-.8068-2.5515-1.4799-5.9473-1.6369V7.195h4.186V4.4055H6.3076V7.195h4.1852v1.8286c-3.4018.1562-5.9601.83-5.9601 1.6376 0 .8075 2.5583 1.4806 5.9601 1.6376v5.8618h3.025v-5.8639c3.394-.1563 5.948-.8295 5.948-1.6363z" />
      </g>

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
        {STABLE_SYMBOL}
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

      {/* the holdings, identical chips because they are equally weighted */}
      <rect className="sd-face" x="152" y="110" width="142" height="76" rx="10" />
      <text className="sd-label" x="166" y="128">
        {BASKET.length} STOCKS · EQUAL
      </text>
      {BASKET.map(({ sym, x, y }) => {
        const mask = BRAND_MASKS[sym];
        const h = CHIP_CAP * (mask?.k ?? 1);
        const w = h * (mask?.ratio ?? 1);
        return (
          <g key={sym}>
            <rect className="sd-chip" x={x} y={y} width={CHIP_W} height={CHIP_H} rx="6" />
            {/* The mask PNG is white ink on transparency. brightness(0) drives
                the ink to black without touching the alpha, and the opacity
                lands it at the same grey as the labels — one filter instead of
                a per-mark <mask> and an id per mark in a diagram rendered once. */}
            {mask ? (
              <image
                className="sd-logo"
                href={mask.src}
                x={x + (CHIP_W - w) / 2}
                y={y + CHIP_H / 2 - h / 2}
                width={w}
                height={h}
              />
            ) : (
              /* No mask on file — a wordmark that is illegible at this size, so
                 the chip carries the ticker instead of five pixels of lettering. */
              <text
                className="sd-label"
                x={x + CHIP_W / 2}
                y={y + CHIP_H / 2 + 2.5}
                textAnchor="middle"
                style={{ fontSize: 7 }}
              >
                {sym}
              </text>
            )}
          </g>
        );
      })}
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
