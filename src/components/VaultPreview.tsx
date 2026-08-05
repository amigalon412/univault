"use client";

import Link from "next/link";
import { useState } from "react";
import { useReveal } from "@/hooks/useReveal";
import { PixelLogo } from "@/components/PixelLogo";
import { ScrambleFigure } from "@/components/ScrambleFigure";
import { PIXEL_LOGOS } from "@/lib/pixel-logos";
import { STRATEGIES, type StrategyId } from "@/lib/strategies";

/* An illustrative deposit, not a real position — the figures below are this
   number split by the selected strategy's target, nothing more. Labelled on
   screen so nobody reads it as balance or performance. */
const EXAMPLE = 10_000;
const SEGMENTS = 48;

/* Gap between one segment lighting and the next. With 48 segments and the
   0.68s fade in .seg-fill, the meter takes a shade under two seconds to fill —
   slow enough to watch the allocation being laid down rather than to catch it
   already finished. */
const SEG_STAGGER = 26;

/* How far each holding wanders from its target before the rebalance pulls it
   back, as a scale factor on its bar. Mixed directions and sizes so the basket
   drifts the way a real one does — not four bars breathing in unison. Read by
   the .weight-drift keyframes through --drift. */
const DRIFT = [1.16, 0.86, 1.09, 0.9];

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function VaultPreview() {
  const [selected, setSelected] = useState<StrategyId>("balanced");

  /* Nothing animates until the card is actually on screen — the reveal would
     otherwise be over long before anyone scrolled here.

     The figures are NOT counted up. That was the first design and it is gone:
     a JS clock ticking setState drove the bar and the logos fine, but React
     would not repaint the two <div>s holding the money on a page that loaded
     already scrolled to this section — the timer provably ran (20 ticks) and
     the numbers stayed at zero. Rather than ship a card whose resting state
     can read $0, the motion is CSS only: it is keyed off one boolean, it goes
     through the compositor, and it cannot leave a wrong number on screen. */
  const { ref: root, seen } = useReveal<HTMLDivElement>(0.2);

  const strategy = STRATEGIES.find((s) => s.id === selected)!;
  const lending = (EXAMPLE * strategy.stablePct) / 100;
  const basket = (EXAMPLE * strategy.stockPct) / 100;
  const litSegments = seen ? Math.round((strategy.stablePct / 100) * SEGMENTS) : 0;
  const perStock = basket / PIXEL_LOGOS.length;
  const weight = strategy.stockPct / PIXEL_LOGOS.length;

  // Carries id="vaults": the nav links to /#vaults, and the section that used
  // to own that anchor is gone. This is the vaults section now.
  return (
    <section
      id="vaults"
      className="relative px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
      <div className="relative max-w-5xl mx-auto" ref={root}>
        <div className="relative flex flex-wrap items-end justify-between gap-3 mb-7">
          <div>
            <div className="text-sm font-semibold text-wire-cyan mb-2">What you get</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] text-white leading-tight">
              One deposit, split and working.
            </h2>
          </div>
          <div className="rounded-full border border-wire-border px-3.5 py-1.5 text-xs text-wire-muted">
            Simulated · example figures
          </div>
        </div>

        {/* The panel. Deliberately not the app's deposit card: no tabs, no
            input, no submit. This is an instrument reading out a position, not
            a form for opening one.

            .float-panel keeps it drifting a few pixels vertically on a
            nine-second cycle, matching the drift/rebalance loop inside it — the
            panel breathes on the same period as the basket it is showing. */}
        <div className="float-panel uni-card overflow-hidden">
          {/* instrument header */}
          <div className="flex flex-wrap items-center gap-3 border-b border-wire-border px-5 sm:px-7 py-4 text-xs">
            <span className="font-semibold text-white whitespace-nowrap">
              {strategy.name} vault
            </span>
            <span className="hidden md:inline text-wire-muted">
              ERC-4626 · Robinhood Chain · Non-custodial
            </span>
            <span className="ml-auto flex items-center gap-2 text-wire-muted whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-wire-cyan animate-earn" />
              Live contract
            </span>
          </div>

          {/* Strategy select, as a segmented control on a recessed track —
              the shape the real app uses for anything with three states. */}
          <div className="px-4 sm:px-6 pt-5">
            <div className="flex flex-wrap gap-1 rounded-2xl bg-white/[0.04] p-1">
              {STRATEGIES.map((s) => {
                const active = s.id === selected;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected(s.id)}
                    aria-pressed={active}
                    className={
                      "flex-1 min-w-[104px] rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors " +
                      (active
                        ? "bg-wire-cyan text-black"
                        : "text-wire-muted hover:text-white hover:bg-white/5")
                    }
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keyed on the strategy, so switching rebuilds this subtree rather
              than patching it.

              Not a stylistic choice. Patching left stale text behind: after
              switching to GROWTH the amounts were right but the line reading
              "Evenly weighted — $1,000 each" kept BALANCED's figure, because
              that value sits between two literal strings inside one element
              and React did not rewrite that text node. Remounting the body
              removes the whole class of problem, and it costs one small
              subtree per click. */}
          <div key={selected} className="relative p-5 sm:p-7 md:p-9">
            {/* deposit + split readout */}
            <div className="flex flex-wrap items-end justify-between gap-8 mb-10">
              <div>
                <div className="text-xs text-wire-muted mb-2">You deposit</div>
                <div className="figure-blur font-digits text-5xl md:text-7xl font-semibold text-white leading-none">
                  <ScrambleFigure value={usd(EXAMPLE)} active={seen} />
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-wire-muted">
                  <span className="uni-wash rounded-full px-2.5 py-1 font-semibold">USDG</span>
                  Once · no lockup
                </div>
              </div>

              <div className="uni-raised px-5 py-4 text-right">
                <div className="text-xs text-wire-muted mb-1.5">Target split</div>
                <div className="figure-blur font-digits text-4xl md:text-5xl font-semibold text-wire-cyan leading-none">
                  <ScrambleFigure value={strategy.split} active={seen} />
                </div>
                <div className="text-xs text-wire-muted mt-1.5">Yield / stocks</div>
              </div>
            </div>

            {/* Allocation as a lit segment display with a scale under it. Each
                segment carries its own delay so the bar fills left to right;
                only opacity animates. */}
            <div className="mb-10">
              <div className="flex items-baseline justify-between text-xs mb-2.5">
                <span className="text-white/80">◂ Lending yield</span>
                <span className="text-wire-muted">Allocation</span>
                <span className="text-wire-cyan">Tokenized stocks ▸</span>
              </div>
              <div
                className="flex gap-[2px] h-9 rounded-xl bg-white/[0.04] p-1.5"
                role="img"
                aria-label={`${strategy.stablePct}% lending yield, ${strategy.stockPct}% tokenized stocks`}
              >
                {/* The track is always drawn; a lit segment gets an overlay on
                    top of it. Two elements rather than one recoloured element
                    so the fill can animate on opacity — the old version
                    transitioned background-color and box-shadow across all 48,
                    which is 48 repaints a frame for the length of the stagger. */}
                {Array.from({ length: SEGMENTS }, (_, i) => {
                  const lit = i < litSegments;
                  return (
                    <span key={i} className="relative flex-1 rounded-sm bg-white/[0.06]">
                      {lit && (
                        <span
                          className="seg-fill absolute inset-0 rounded-sm bg-wire-cyan"
                          style={{ animationDelay: `${i * SEG_STAGGER}ms` }}
                        />
                      )}
                    </span>
                  );
                })}
              </div>
              {/* a scale, so the bar is a measurement and not a decoration */}
              <div className="relative mt-1.5 h-4">
                {[0, 25, 50, 75, 100].map((p) => (
                  <span
                    key={p}
                    className="absolute top-0 -translate-x-1/2 text-[10px] text-wire-muted/70"
                    style={{ left: `${p}%` }}
                  >
                    <span className="block h-1 w-px bg-white/15 mx-auto mb-1" />
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* the two legs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="uni-raised p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-xs font-medium text-wire-muted">Lending leg</span>
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] text-wire-cyan">
                    <span className="h-1 w-1 rounded-full bg-wire-cyan animate-earn" />
                    Earning
                  </span>
                </div>
                <div className="figure-in font-digits text-4xl font-semibold text-white leading-none">
                  <ScrambleFigure value={usd(lending)} active={seen} />
                </div>
                <div className="mt-4 mb-4 h-px bg-white/8" />
                <div className="text-sm text-wire-muted leading-relaxed">
                  Supplied to an on-chain lending venue. Real interest, not emissions.
                </div>
                <div className="mt-4 text-xs text-wire-muted/70">
                  {strategy.stablePct}% of deposit
                </div>
              </div>

              <div className="uni-raised p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-xs font-medium text-wire-muted">Stock basket</span>
                  <span className="ml-auto text-[11px] text-wire-muted/70">
                    {strategy.stockPct === 0 ? "Empty" : "Evenly weighted"}
                  </span>
                </div>
                <div className="figure-in font-digits text-4xl font-semibold text-white leading-none">
                  <ScrambleFigure value={usd(basket)} active={seen} />
                </div>
                <div className="mt-4 mb-5 h-px bg-white/8" />

                {strategy.stockPct === 0 ? (
                  <div className="text-sm text-wire-muted leading-relaxed">
                    Steady holds no stocks. All of it stays in the yield leg.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {PIXEL_LOGOS.map((logo, i) => (
                      <div
                        key={logo.key}
                        className="figure-in flex items-center gap-3"
                        style={{ animationDelay: `${120 + i * 80}ms` }}
                      >
                        {/* The mark in a round token badge, the way an asset
                            row is drawn everywhere in the app this borrows
                            from. */}
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.07]">
                          <PixelLogo logo={logo} size={17} className="text-white/85" />
                        </span>
                        <span className="text-xs font-medium text-white/85 w-12 shrink-0">
                          {logo.key}
                        </span>
                        {/* Per-holding weight, drawn rather than stated — and
                            live: the bar wanders off its target and is pulled
                            back, which is what the line below claims happens.
                            The tick marks the target it returns to, so the
                            movement reads as drift against a goal rather than
                            as decoration. */}
                        <span className="relative h-1.5 flex-1 rounded-full bg-white/[0.07] min-w-8">
                          <span
                            aria-hidden
                            className="absolute inset-y-[-2px] w-px bg-white/25"
                            style={{ left: `${weight * 2.6}%` }}
                          />
                          <span
                            className="weight-drift absolute inset-y-0 left-0 rounded-full bg-wire-cyan/80"
                            style={
                              {
                                width: `${weight * 2.6}%`,
                                "--drift": DRIFT[i % DRIFT.length],
                              } as React.CSSProperties
                            }
                          />
                        </span>
                        <span className="font-digits text-xs text-white/90 w-16 text-right shrink-0">
                          {/* Each row settles a beat after the one above it, so
                              the basket resolves top-down instead of all four
                              landing on the same frame. */}
                          <ScrambleFigure
                            value={usd(perStock)}
                            active={seen}
                            durationMs={520 + i * 90}
                          />
                        </span>
                      </div>
                    ))}
                    {/* Two lines in one slot, cross-fading on the drift's own
                        timeline. The resting label is the real one and carries
                        the accessible text; the flash is decoration for the
                        moment the bars snap back, so it is hidden from readers. */}
                    <div className="relative pt-1.5 text-[11px]">
                      <span className="drift-label text-wire-muted/70">
                        {weight}% each · rebalanced on drift
                      </span>
                      <span
                        aria-hidden
                        className="drift-flash absolute left-0 top-1.5 text-wire-cyan whitespace-nowrap"
                      >
                        ▸ Drift over band · rebalancing
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-wire-border px-5 sm:px-8 md:px-9 py-5">
            <div className="text-xs text-wire-muted">
              Redeem anytime · in kind · nobody can block it
            </div>
            <Link
              href="/app"
              className="group uni-pill bg-wire-cyan text-black text-sm font-semibold px-6 py-3 hover:shadow-[0_10px_34px_rgba(252,114,255,0.3)]"
            >
              Open the vault{" "}
              <span className="inline-block transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
