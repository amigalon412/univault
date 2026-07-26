"use client";

import { useEffect, useRef, useState } from "react";
import { Bracket } from "@/components/Bracket";
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
        "relative flex flex-col items-center justify-center bg-black text-center " +
        (hub
          ? "border border-wire-cyan shadow-[0_0_40px_rgba(214,254,81,0.16)] px-7 py-8 "
          : "border border-wire-cyan/35 px-6 py-6 ") +
        className
      }
    >
      <PixelLogo
        logo={node.glyph}
        grid={GLYPH_GRID}
        size={hub ? 60 : 46}
        className="text-wire-cyan mx-auto"
      />
      <div
        className={
          "font-mono text-wire-cyan tracking-[0.2em] mt-4 " +
          (hub ? "text-base glow-cyan" : "text-sm")
        }
      >
        {node.name}
      </div>
      <div className="font-mono text-[11px] text-wire-muted tracking-[0.1em] mt-2">
        {node.role}
      </div>
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
              label="ADAPTER"
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
const LEGS_H = 356;         // height of the legs column at md and up
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
        stroke="rgba(214,254,81,0.55)"
        strokeWidth="1"
        strokeDasharray={DASH}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        r="3.5"
        cx="0"
        cy="0"
        fill="#d6fe51"
        className="flow-dot drop-shadow-[0_0_7px_#d6fe51]"
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
        stroke="rgba(214,254,81,0.55)"
        strokeWidth="1"
        strokeDasharray={DASH}
      >
        <path d={`M0 ${LEGS_H / 2} H${SPLIT_X}`} />
        <path d={`M${SPLIT_X} ${ARM_1} V${ARM_2}`} />
        <path d={`M${SPLIT_X} ${ARM_1} H${FORK_W}`} />
        <path d={`M${SPLIT_X} ${ARM_2} H${FORK_W}`} />
      </g>
      {[ARM_1, ARM_2].map((y, i) => (
        <circle
          key={y}
          r="3.5"
          cx="0"
          cy="0"
          fill="#d6fe51"
          className="flow-dot drop-shadow-[0_0_7px_#d6fe51]"
          style={{
            offsetPath: `path("M0 ${LEGS_H / 2} H${SPLIT_X} V${y} H${FORK_W}")`,
            animationDelay: `${i * 900}ms`,
          }}
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
 * The copy deliberately does NOT say "verified". None of the BLUR contracts
 * are source-verified on Blockscout yet -- checked against its API -- so a
 * link opens bytecode, not Solidity. Saying otherwise would be the same
 * mistake as the launch video that showed superseded addresses under a green
 * VERIFIED tick. When `forge verify-contract` has been run against them, the
 * word can come back and this note can go.
 */
export function MechanicsSection() {
  const [seen, setSeen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Below the fold, so the reveal is triggered by arrival rather than by mount.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="mechanics"
      className="relative border-b border-wire-border px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
      {/* One grid for the whole section rather than one inside the panel.
          Continuity is then structural: the panel is a border drawn over the
          same field, so the ruling runs out of it and across the page instead
          of stopping at an edge. Masked so it dissolves before the margins and
          does not read as a rectangle of its own. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(214,254,81,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(214,254,81,0.055) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage:
            "radial-gradient(115% 80% at 50% 45%, #000 45%, rgba(0,0,0,0.35) 78%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(115% 80% at 50% 45%, #000 45%, rgba(0,0,0,0.35) 78%, transparent 100%)",
        }}
      />
      <div className="relative max-w-5xl mx-auto" ref={root}>
        <div className="font-mono text-xs text-wire-muted tracking-[0.4em] mb-2">
          {"// HOW ONE DEPOSIT MOVES"}
        </div>
        <h2 className="font-mono text-2xl md:text-3xl text-wire-cyan glow-cyan mb-3 leading-snug">
          Follow the money. Every box is a contract.
        </h2>
        <p className="font-mono text-sm text-wire-muted leading-relaxed max-w-2xl mb-8">
          Not a diagram of an intention. Every node opens the live contract on
          the explorer, at the address it actually runs at — check the wiring
          rather than taking this page&apos;s word for it.
        </p>

        <div className="relative border border-wire-cyan/25 bg-black/25">
          <Bracket at="tl" />
          <Bracket at="tr" />
          <Bracket at="bl" />
          <Bracket at="br" />

          <div className="flex items-center gap-4 border-b border-wire-cyan/20 px-5 sm:px-7 py-3.5 font-mono text-[11px] tracking-[0.26em] text-wire-muted">
            <span className="text-wire-cyan glow-cyan whitespace-nowrap">
              ▸ BLUR VAULT · ERC-4626
            </span>
            <span className="hidden lg:inline text-wire-muted/70 whitespace-nowrap">
              {DIAGRAM_VAULT} ADDRESSES
            </span>
            <span className="ml-auto flex items-center gap-2.5 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-wire-cyan animate-earn" />
              LIVE ON ROBINHOOD CHAIN
            </span>
          </div>

          <div className="relative px-5 sm:px-9 py-9 sm:py-12">
            {/* Stacks under md: a horizontal flow has nowhere to go on a phone.
                Above md the widths are fixed, so the wiring can be drawn to
                coordinates instead of hoping flexbox lands where the SVG
                expects. The source and the vault sit close together — the two
                of them are one movement, and the interesting split is the fork
                on the right, which is where the room should go. */}
            <div
              className={
                "flex flex-col md:flex-row md:items-center gap-5 md:gap-0 " +
                (seen ? "figure-in" : "opacity-0")
              }
            >
              <div className="w-full md:w-[212px] md:flex-none">
                <Node node={SOURCE_NODE} />
              </div>
              <div className="hidden md:block w-[86px] shrink-0 px-3">
                <Feed />
              </div>
              <div className="w-full md:w-[228px] md:flex-none">
                <Node node={VAULT_NODE} hub />
              </div>
              <div className="hidden md:block">
                <Fork />
              </div>
              <div
                className="flex flex-col gap-5 md:flex-1 md:min-w-[236px]"
              >
                {LEG_NODES.map((leg) => (
                  <div key={leg.name} className="md:h-[168px]">
                    <Node node={leg} className="h-full" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-wire-cyan/15 flex flex-wrap items-center gap-3.5">
              <span className="font-mono text-[11px] text-wire-muted/70 tracking-[0.26em]">
                KEPT ON TARGET BY
              </span>
              {RAIL_NODES.map((n) => (
                <span
                  key={n.name}
                  className="flex items-center gap-2.5 border border-wire-cyan/20 px-3.5 py-2.5 font-mono text-[11px] tracking-[0.14em] text-wire-muted"
                >
                  <PixelLogo
                    logo={n.glyph}
                    grid={GLYPH_GRID}
                    size={20}
                    className="text-wire-cyan shrink-0"
                  />
                  <span className="text-wire-cyan">{n.name}</span>
                  <ContractLink address={n.address} variant="bare" />
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-wire-cyan/20">
            {TRACE_STEPS.map((s, i) => (
              <div
                key={s.num}
                className={
                  "grid grid-cols-[44px_1fr] md:grid-cols-[44px_1fr_auto] gap-x-5 gap-y-3 px-5 sm:px-9 py-6 border-b border-wire-cyan/10 last:border-b-0 " +
                  (seen ? "figure-in" : "opacity-0")
                }
                style={{ animationDelay: `${200 + i * 90}ms` }}
              >
                <div className="font-mono text-sm text-wire-cyan/45 pt-0.5">
                  {s.num}
                </div>
                <div>
                  <div className="font-mono text-sm text-wire-cyan tracking-[0.16em]">
                    {s.title}
                  </div>
                  <div className="font-mono text-[13px] text-wire-muted leading-relaxed mt-2.5 max-w-2xl">
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
