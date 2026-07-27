"use client";

import Link from "next/link";
import { useState } from "react";
import { useReveal } from "@/hooks/useReveal";
import { Bracket } from "@/components/Bracket";
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
      className="relative border-b border-wire-border px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
      <div className="relative max-w-5xl mx-auto" ref={root}>
        <div className="relative flex flex-wrap items-end justify-between gap-3 mb-7">
          <div>
            <div className="font-mono text-xs text-wire-muted tracking-[0.4em] mb-2">
              {"// WHAT YOU GET"}
            </div>
            <h2 className="font-mono text-2xl md:text-3xl text-wire-cyan glow-cyan leading-snug">
              One deposit, split and working.
            </h2>
          </div>
          <div className="font-mono text-[10px] text-wire-muted tracking-[0.3em] border border-wire-border px-3 py-1.5">
            SIMULATED · EXAMPLE FIGURES
          </div>
        </div>

        {/* The panel. Deliberately not the app's terminal card: no prompt line,
            no tabs for deposit/withdraw, no input, no ASCII bars. This is an
            instrument reading out a position, not a form for opening one.

            .float-panel keeps it drifting a few pixels vertically on a
            nine-second cycle, matching the drift/rebalance loop inside it — the
            panel breathes on the same period as the basket it is showing. */}
        <div className="float-panel relative border border-wire-cyan/25 bg-wire-card">
          <Bracket at="tl" />
          <Bracket at="tr" />
          <Bracket at="bl" />
          <Bracket at="br" />

          {/* Fine hatch, so the panel has a surface instead of being a hole. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #d6fe51 0 1px, transparent 1px 7px)",
            }}
          />

          {/* instrument header */}
          <div className="relative flex items-center gap-3 border-b border-wire-cyan/20 px-4 sm:px-6 py-2.5 font-mono text-[10px] tracking-[0.26em] text-wire-muted">
            <span className="text-wire-cyan glow-cyan whitespace-nowrap">
              ▸ VAULT://{strategy.name}
            </span>
            <span className="hidden md:inline text-wire-muted/70">
              ERC-4626 · ROBINHOOD CHAIN · NON-CUSTODIAL
            </span>
            <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-wire-cyan animate-earn" />
              LIVE CONTRACT
            </span>
          </div>

          {/* strategy select */}
          <div className="relative flex flex-wrap gap-px bg-wire-cyan/15 border-b border-wire-cyan/20">
            {STRATEGIES.map((s, i) => {
              const active = s.id === selected;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  aria-pressed={active}
                  className={
                    "group relative flex-1 min-w-[120px] px-4 py-3.5 font-mono text-xs tracking-[0.2em] transition-colors " +
                    (active
                      ? "bg-wire-cyan text-black font-bold"
                      : "bg-black text-wire-muted hover:text-wire-cyan hover:bg-wire-cyan/5")
                  }
                >
                  <span
                    className={
                      "mr-2 text-[9px] align-middle " +
                      (active ? "text-black/60" : "text-wire-cyan/40")
                    }
                  >
                    0{i + 1}
                  </span>
                  {s.name}
                </button>
              );
            })}
          </div>

          {/* Keyed on the strategy, so switching rebuilds this subtree rather
              than patching it.

              Not a stylistic choice. Patching left stale text behind: after
              switching to GROWTH the amounts were right but the line reading
              "Evenly weighted — $1,000 each" kept BALANCED's figure, because
              that value sits between two literal strings inside one element
              and React did not rewrite that text node. The same shape is what
              made the earlier count-up render $0 for ever. Remounting the body
              removes the whole class of problem, and it costs one small
              subtree per click. */}
          <div key={selected} className="relative p-5 sm:p-8 md:p-10">
            {/* deposit + split readout */}
            <div className="flex flex-wrap items-end justify-between gap-8 mb-10">
              <div className="flex items-stretch gap-4">
                <span aria-hidden className="w-[3px] bg-wire-cyan/70 glow-box-cyan" />
                <div>
                  <div className="font-mono text-[10px] text-wire-muted tracking-[0.32em] mb-2">
                    YOU DEPOSIT
                  </div>
                  <div className="figure-blur font-digits text-5xl md:text-7xl text-wire-cyan glow-cyan leading-none">
                    <ScrambleFigure value={usd(EXAMPLE)} active={seen} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-wire-muted tracking-[0.2em]">
                    <span className="border border-wire-cyan/30 px-2 py-0.5 text-wire-cyan/80">
                      USDG
                    </span>
                    ONCE · NO LOCKUP
                  </div>
                </div>
              </div>

              <div className="relative border border-wire-cyan/25 px-5 py-3 text-right">
                <div className="font-mono text-[10px] text-wire-muted tracking-[0.32em] mb-1.5">
                  TARGET SPLIT
                </div>
                <div className="figure-blur font-digits text-4xl md:text-5xl text-wire-cyan leading-none">
                  <ScrambleFigure value={strategy.split} active={seen} />
                </div>
                <div className="font-mono text-[10px] text-wire-muted tracking-[0.2em] mt-1.5">
                  YIELD / STOCKS
                </div>
              </div>
            </div>

            {/* Allocation as a lit segment display with a scale under it, not a
                row of block glyphs. Each segment carries its own delay so the
                bar fills left to right; only opacity and colour animate. */}
            <div className="mb-10">
              <div className="flex items-baseline justify-between font-mono text-[10px] tracking-[0.26em] mb-2.5">
                <span className="text-wire-cyan">◂ LENDING YIELD</span>
                <span className="text-wire-muted">ALLOCATION METER</span>
                <span className="text-wire-cyan">TOKENIZED STOCKS ▸</span>
              </div>
              <div
                className="flex gap-[2px] h-10 border-y border-wire-cyan/20 py-1"
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
                    <span key={i} className="relative flex-1 bg-wire-cyan/[0.08]">
                      {lit && (
                        <span
                          className="seg-fill absolute inset-0 bg-wire-cyan shadow-[0_0_12px_rgba(214,254,81,0.6)]"
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
                    className="absolute top-0 -translate-x-1/2 font-mono text-[9px] text-wire-muted/60"
                    style={{ left: `${p}%` }}
                  >
                    <span className="block h-1 w-px bg-wire-cyan/25 mx-auto mb-1" />
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* the two legs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-wire-cyan/15">
              <div className="bg-black p-5 sm:p-7">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="font-mono text-[10px] text-wire-cyan/50">[01]</span>
                  <span className="font-mono text-[10px] text-wire-muted tracking-[0.3em]">
                    LENDING LEG
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-wire-cyan tracking-[0.2em]">
                    <span className="h-1 w-1 rounded-full bg-wire-cyan animate-earn" />
                    EARNING
                  </span>
                </div>
                <div className="figure-in font-digits text-4xl text-wire-cyan leading-none">
                  <ScrambleFigure value={usd(lending)} active={seen} />
                </div>
                <div className="mt-3 mb-4 h-px bg-gradient-to-r from-wire-cyan/40 to-transparent" />
                <div className="font-mono text-xs text-wire-muted leading-relaxed">
                  Supplied to an on-chain lending venue. Real interest, not
                  emissions.
                </div>
                <div className="mt-4 font-mono text-[10px] text-wire-muted/70 tracking-[0.2em]">
                  {strategy.stablePct}% OF DEPOSIT
                </div>
              </div>

              <div className="bg-black p-5 sm:p-7">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="font-mono text-[10px] text-wire-cyan/50">[02]</span>
                  <span className="font-mono text-[10px] text-wire-muted tracking-[0.3em]">
                    STOCK BASKET
                  </span>
                  <span className="ml-auto font-mono text-[9px] text-wire-muted/70 tracking-[0.2em]">
                    {strategy.stockPct === 0 ? "EMPTY" : "EVENLY WEIGHTED"}
                  </span>
                </div>
                <div className="figure-in font-digits text-4xl text-wire-cyan leading-none">
                  <ScrambleFigure value={usd(basket)} active={seen} />
                </div>
                <div className="mt-3 mb-5 h-px bg-gradient-to-r from-wire-cyan/40 to-transparent" />

                {strategy.stockPct === 0 ? (
                  <div className="font-mono text-xs text-wire-muted leading-relaxed">
                    STEADY holds no stocks. All of it stays in the yield leg.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {PIXEL_LOGOS.map((logo, i) => (
                      <div
                        key={logo.key}
                        className="figure-in flex items-center gap-3"
                        style={{ animationDelay: `${120 + i * 80}ms` }}
                      >
                        <PixelLogo logo={logo} size={26} className="text-wire-cyan shrink-0" />
                        <span className="font-mono text-[11px] text-wire-muted tracking-[0.18em] w-11 shrink-0">
                          {logo.key}
                        </span>
                        {/* Per-holding weight, drawn rather than stated — and
                            live: the bar wanders off its target and is pulled
                            back, which is what the line below claims happens.
                            The tick marks the target it returns to, so the
                            movement reads as drift against a goal rather than
                            as decoration. */}
                        <span className="relative h-1.5 flex-1 bg-wire-cyan/[0.08] min-w-8">
                          <span
                            aria-hidden
                            className="absolute inset-y-[-2px] w-px bg-wire-cyan/30"
                            style={{ left: `${weight * 2.6}%` }}
                          />
                          <span
                            className="weight-drift absolute inset-y-0 left-0 bg-wire-cyan/70"
                            style={
                              {
                                width: `${weight * 2.6}%`,
                                "--drift": DRIFT[i % DRIFT.length],
                              } as React.CSSProperties
                            }
                          />
                        </span>
                        <span className="font-digits text-xs text-wire-cyan/90 w-16 text-right shrink-0">
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
                    <div className="relative pt-1.5 font-mono text-[10px] tracking-[0.2em]">
                      <span className="drift-label text-wire-muted/70">
                        {weight}% EACH · REBALANCED ON DRIFT
                      </span>
                      <span
                        aria-hidden
                        className="drift-flash absolute left-0 top-1.5 text-wire-cyan whitespace-nowrap"
                      >
                        ▸ DRIFT OVER BAND · REBALANCING
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-4 border-t border-wire-cyan/20 px-5 sm:px-8 md:px-10 py-5">
            <div className="font-mono text-[10px] text-wire-muted tracking-[0.22em]">
              REDEEM ANYTIME · IN KIND · NOBODY CAN BLOCK IT
            </div>
            <Link
              href="/app"
              className="group font-mono text-xs text-wire-cyan border border-wire-cyan px-6 py-2.5 tracking-widest hover:bg-wire-cyan hover:text-black transition-all"
            >
              OPEN THE VAULT{" "}
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
