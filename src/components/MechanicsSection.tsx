"use client";

import { useReveal } from "@/hooks/useReveal";
import { ContractLink } from "@/components/ContractLink";
import { PixelLogo } from "@/components/PixelLogo";
import { GLYPH_GRID } from "@/lib/pixel-glyphs";
import {
  DIAGRAM_VAULT,
  LEG_NODES,
  RAIL_NODES,
  SOURCE_NODE,
  TRACE_STEPS,
  VAULT_NODE,
  type FlowNode,
} from "@/lib/mechanics";

/** One box in the diagram. */
function Node({
  node,
  hub = false,
  className = "",
}: {
  node: FlowNode;
  hub?: boolean;
  className?: string;
}) {
  return (
    <div
      className={
        "relative flex flex-col items-center justify-center rounded-2xl text-center " +
        (hub
          ? "bg-wire-raised border border-wire-cyan/45 shadow-[0_0_44px_rgba(252,114,255,0.14)] px-7 py-8 "
          : "bg-wire-card border border-wire-border px-6 py-6 ") +
        className
      }
    >
      <PixelLogo
        logo={node.glyph}
        grid={GLYPH_GRID}
        size={hub ? 56 : 42}
        className={(hub ? "text-wire-cyan" : "text-white/80") + " mx-auto"}
      />
      <div
        className={
          "font-semibold mt-4 " +
          (hub ? "text-base text-wire-cyan" : "text-sm text-white")
        }
      >
        {node.name}
      </div>
      <div className="text-[11px] text-wire-muted mt-1.5">{node.role}</div>
      {node.holdings ? (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-1.5">
            {node.holdings.map((h) => (
              <ContractLink
                key={h.symbol}
                address={h.token}
                label={h.symbol}
                variant="ticker"
              />
            ))}
          </div>
          <div className="mt-3">
            <ContractLink
              address={node.address}
              label="Adapter"
              variant="bare"
              className="opacity-70"
            />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <ContractLink address={node.address} />
        </div>
      )}
    </div>
  );
}

/* ── The wiring ────────────────────────────────────────────────────────────
   Drawn as SVG on a fixed grid rather than as flexbox rules.

   Rules in a flex row cannot make a fork: each one is an independent
   horizontal stub that floats wherever the box model leaves it, so the two
   branches to the legs pointed at nothing and started nowhere. A fork needs a
   trunk, a riser and two arms that actually meet, which means real geometry.

   The heights below are fixed for the same reason -- the legs column is given
   a known height and its two cards split it, so every coordinate here is a
   number rather than a guess about how flexbox will resolve.

   The travelling dots ride a CSS offset-path rather than SMIL animateMotion.
   Both draw the same thing, but AnimationGovernor finds endless animations
   through document.getAnimations(), which does not see SMIL -- these would
   have run forever behind a scrolled-past section, which is exactly the
   compositor load this page was cleaned up to remove. */
const LEGS_H = 356;         // height of the legs column at lg and up
const CARD_H = (LEGS_H - 20) / 2;   // two cards, one gap-5 between them
const ARM_1 = CARD_H / 2;
const ARM_2 = LEGS_H - CARD_H / 2;
const FORK_W = 92;
const SPLIT_X = 38;         // where the trunk turns into the riser

const DASH = "5 7";

/** Straight run from the source into the vault. */
function Feed() {
  return (
    <svg
      aria-hidden
      width="100%"
      height="14"
      viewBox="0 0 100 14"
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <line
        x1="0"
        y1="7"
        x2="100"
        y2="7"
        stroke="rgba(252,114,255,0.55)"
        strokeWidth="1"
        strokeDasharray={DASH}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        r="3.5"
        cx="0"
        cy="0"
        fill="#fc72ff"
        className="flow-dot drop-shadow-[0_0_7px_#fc72ff]"
        style={{ offsetPath: 'path("M0 7 L100 7")' }}
      />
    </svg>
  );
}

/** Trunk out of the vault, splitting to meet each leg where it actually is. */
function Fork() {
  return (
    <svg
      aria-hidden
      width={FORK_W}
      height={LEGS_H}
      viewBox={`0 0 ${FORK_W} ${LEGS_H}`}
      className="shrink-0 overflow-visible"
    >
      <g
        fill="none"
        stroke="rgba(252,114,255,0.55)"
        strokeWidth="1"
        strokeDasharray={DASH}
      >
        <path d={`M0 ${LEGS_H / 2} H${SPLIT_X}`} />
        <path d={`M${SPLIT_X} ${ARM_1} V${ARM_2}`} />
        <path d={`M${SPLIT_X} ${ARM_1} H${FORK_W}`} />
        <path d={`M${SPLIT_X} ${ARM_2} H${FORK_W}`} />
      </g>
      {/* No stagger. The fork is symmetric -- both paths are the trunk plus an
          equal riser plus an equal arm -- so with the same duration the two
          dots stay in lockstep: they leave the vault as one, sit on top of
          each other along the trunk, and separate exactly where the split is.
          Offsetting them made the deposit look like it left twice. */}
      {[ARM_1, ARM_2].map((y) => (
        <circle
          key={y}
          r="3.5"
          cx="0"
          cy="0"
          fill="#fc72ff"
          className="flow-dot drop-shadow-[0_0_7px_#fc72ff]"
          style={{ offsetPath: `path("M0 ${LEGS_H / 2} H${SPLIT_X} V${y} H${FORK_W}")` }}
        />
      ))}
    </svg>
  );
}

/**
 * How one deposit moves, traced through the contracts it actually touches.
 *
 * Replaces a section that repeated the vault preview's three strategy cards.
 * The page had no diagram and no external evidence in it anywhere; this is
 * both. Every node links to the live contract at the address it runs at, so
 * the wiring is checkable rather than asserted.
 *
 * On "verified": all twelve deployed contracts are source-verified on
 * Blockscout, so the copy below can cover the whole diagram. The guards took
 * a second pass -- they were deployed before 423d0b9 tightened the slippage
 * ceiling, so they verify against that commit's parent rather than against
 * HEAD. contracts/script/verify-all.sh knows this; re-run it to confirm the
 * state before trusting this comment.
 */
export function MechanicsSection() {
  // Below the fold, so the reveal is triggered by arrival rather than by mount.
  const { ref: root, seen } = useReveal<HTMLDivElement>();

  return (
    <section
      id="mechanics"
      className="relative px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
      {/* A pink wash floated behind the diagram, masked so it dissolves before
          the margins. Replaces the graph-paper ruling this section used to
          draw: a grid is terminal furniture, a soft accent bloom is the only
          thing the app this borrows from ever puts behind a card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-1/2 h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(252,114,255,0.10),transparent_72%)] blur-3xl" />
      </div>
      <div className="relative max-w-5xl mx-auto" ref={root}>
        <div className="text-sm font-semibold text-wire-cyan mb-3">
          How one deposit moves
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] text-white mb-4 leading-tight">
          Follow the money. Every box is a contract.
        </h2>
        <p className="text-base text-wire-muted leading-relaxed max-w-2xl mb-9">
          Not a diagram of an intention. Every node opens the deployed contract
          on the explorer, at the address it actually runs at, with its source
          verified — so you can read what each one does rather than taking this
          page&apos;s word for it.
        </p>

        <div className="relative uni-card overflow-hidden">
          <div className="flex items-center gap-4 border-b border-wire-border px-5 sm:px-7 py-4 text-xs text-wire-muted">
            <span className="font-semibold text-white whitespace-nowrap">
              UNIVAULT · ERC-4626
            </span>
            <span className="hidden lg:inline whitespace-nowrap">
              {DIAGRAM_VAULT} addresses
            </span>
            <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-wire-cyan animate-earn" />
              Live on Robinhood Chain
            </span>
          </div>

          <div className="relative px-5 sm:px-9 py-9 sm:py-12">
            {/* Stacks under lg: a horizontal flow has nowhere to go on a phone,
                and the fixed widths below add up to more than the panel is wide
                anywhere short of lg — at ~930px the right-hand leg column was
                being clipped off the card.
                Above lg the widths are fixed, so the wiring can be drawn to
                coordinates instead of hoping flexbox lands where the SVG
                expects. The source and the vault sit close together — the two
                of them are one movement, and the interesting split is the fork
                on the right, which is where the room should go. */}
            <div
              className={
                "flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-0 " +
                (seen ? "figure-in" : "opacity-0")
              }
            >
              <div className="w-full lg:w-[212px] lg:flex-none">
                <Node node={SOURCE_NODE} />
              </div>
              <div className="hidden lg:block w-[86px] shrink-0 px-3">
                <Feed />
              </div>
              <div className="w-full lg:w-[228px] lg:flex-none">
                <Node node={VAULT_NODE} hub />
              </div>
              <div className="hidden lg:block">
                <Fork />
              </div>
              <div
                className="flex flex-col gap-5 lg:flex-1 lg:min-w-[236px]"
              >
                {LEG_NODES.map((leg) => (
                  <div key={leg.name} className="lg:h-[168px]">
                    <Node node={leg} className="h-full" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-wire-border flex flex-wrap items-center gap-3">
              <span className="text-xs text-wire-muted/70">Kept on target by</span>
              {RAIL_NODES.map((n) => (
                <span
                  key={n.name}
                  className="flex items-center gap-2.5 rounded-full border border-wire-border bg-white/[0.03] px-3.5 py-2 text-xs text-wire-muted"
                >
                  <PixelLogo
                    logo={n.glyph}
                    grid={GLYPH_GRID}
                    size={18}
                    className="text-wire-cyan shrink-0"
                  />
                  <span className="text-white font-medium">{n.name}</span>
                  <ContractLink address={n.address} variant="bare" />
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-wire-border">
            {TRACE_STEPS.map((s, i) => (
              <div
                key={s.num}
                className={
                  "grid grid-cols-[44px_1fr] md:grid-cols-[44px_1fr_auto] gap-x-5 gap-y-3 px-5 sm:px-9 py-6 border-b border-wire-border last:border-b-0 " +
                  (seen ? "figure-in" : "opacity-0")
                }
                style={{ animationDelay: `${200 + i * 90}ms` }}
              >
                <div className="font-digits text-sm text-wire-cyan pt-0.5">{s.num}</div>
                <div>
                  <div className="text-sm font-semibold text-white">{s.title}</div>
                  <div className="text-[13px] text-wire-muted leading-relaxed mt-2 max-w-2xl">
                    {s.body}
                  </div>
                </div>
                <div className="col-start-2 md:col-start-3 flex flex-wrap md:flex-col md:items-end gap-x-4 gap-y-2">
                  {s.links.map((l) => (
                    <ContractLink
                      key={l.label}
                      address={l.address}
                      label={l.label}
                      variant="bare"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
