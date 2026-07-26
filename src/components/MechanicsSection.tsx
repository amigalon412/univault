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
function Node({ node, hub = false }: { node: FlowNode; hub?: boolean }) {
  return (
    <div
      className={
        "relative bg-black text-center " +
        (hub
          ? "border border-wire-cyan shadow-[0_0_40px_rgba(214,254,81,0.16)] px-7 py-8"
          : "border border-wire-cyan/35 px-6 py-6")
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
      <div className="mt-4">
        <ContractLink address={node.address} />
      </div>
    </div>
  );
}

/**
 * A dashed connector with a dot running along it.
 *
 * It carries no label. It used to print the leg's share of the deposit, but
 * that share is BALANCED's and nobody else's — STEADY sends nothing this way
 * and GROWTH sends most of it. The ratio belongs to the strategy, not to the
 * machine, and the machine is what this diagram is of.
 */
function Connector({ delay = 0 }: { delay?: number }) {
  return (
    <div className="relative mx-4 min-w-10 flex-1">
      <div className="h-px bg-[repeating-linear-gradient(90deg,rgba(214,254,81,0.55)_0_5px,transparent_5px_12px)]" />
      <span
        aria-hidden
        className="flow-dot absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-wire-cyan shadow-[0_0_12px_#d6fe51]"
        style={{ animationDelay: `${delay}ms` }}
      />
    </div>
  );
}

/**
 * How one deposit moves, traced through the contracts it actually touches.
 *
 * Replaces a section that repeated the vault preview's three strategy cards.
 * The page had no diagram and no external evidence in it anywhere; this is
 * both. Every node links to a deployed, verified contract, so the claim is
 * checkable rather than asserted.
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
      className="border-b border-wire-border px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
      <div className="max-w-5xl mx-auto" ref={root}>
        <div className="font-mono text-xs text-wire-muted tracking-[0.4em] mb-2">
          {"// HOW ONE DEPOSIT MOVES"}
        </div>
        <h2 className="font-mono text-2xl md:text-3xl text-wire-cyan glow-cyan mb-3 leading-snug">
          Follow the money. Every box is a contract.
        </h2>
        <p className="font-mono text-sm text-wire-muted leading-relaxed max-w-2xl mb-8">
          Not a diagram of an intention. Each node opens the deployed, verified
          contract on the explorer — read what it does rather than taking this
          page&apos;s word for it.
        </p>

        <div className="relative border border-wire-cyan/25 bg-wire-card">
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

          <div
            className="relative px-5 sm:px-9 py-9 sm:py-12"
            style={{
              backgroundImage:
                "linear-gradient(rgba(214,254,81,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(214,254,81,0.05) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          >
            {/* Stacks under md: a horizontal flow has nowhere to go on a phone. */}
            <div
              className={
                "flex flex-col md:flex-row md:items-center gap-5 md:gap-0 " +
                (seen ? "figure-in" : "opacity-0")
              }
            >
              <Node node={SOURCE_NODE} />
              <div className="hidden md:block flex-1">
                <Connector />
              </div>
              <Node node={VAULT_NODE} hub />
              {/* Each leg carries its own connector so the line meets the box
                  it points at. Spacing the two connectors inside one stretched
                  column instead put them at the column's extremes -- the top
                  one floated clear above the vault it was supposed to leave. */}
              {/* min-w on the column, not just on the card: flex-1 alone gave
                  this column less width than the card inside it needed, and the
                  connector collapsed to a stub to make room. */}
              <div className="flex flex-col gap-5 md:flex-1 md:min-w-[330px]">
                {LEG_NODES.map((leg, i) => (
                  <div key={leg.name} className="flex items-center">
                    <div className="hidden md:block flex-1 min-w-[56px]">
                      <Connector delay={400 + i * 700} />
                    </div>
                    <div className="w-full md:w-[240px] md:flex-none">
                      <Node node={leg} />
                    </div>
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
