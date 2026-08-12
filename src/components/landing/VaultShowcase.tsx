"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ArrowRightIcon } from "@/components/icons";
import { ScrambleFigure } from "@/components/ScrambleFigure";
import { useReveal } from "@/hooks/useReveal";
import { BASKET_STOCKS } from "@/lib/chain";
import { STRATEGIES, type StrategyId } from "@/lib/strategies";

/* An illustrative deposit, not a real position — every figure below is this
   number split by the selected strategy's target, nothing more. Labelled on
   screen so nobody reads it as a balance. */
const EXAMPLE = 10_000;
const SEGMENTS = 40;

/* Gap between one segment lighting and the next. Forty segments at 24ms is a
   shade under a second to fill — slow enough to watch the allocation being
   laid down, fast enough that it is finished before you look away. */
const SEG_STAGGER = 24;

/* How far each holding wanders from target before the rebalance pulls it back,
   as a scale factor on its bar. Mixed directions and sizes so the basket
   drifts the way a real one does. Read by .weight-drift through --drift. */
const DRIFT = [1.16, 0.86, 1.09, 0.9];

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/**
 * The product, on the fold's other side.
 *
 * This is where FrogPools puts a video of its app. We have the app, so it
 * shows the actual instrument instead: pick a strategy and watch one deposit
 * get split, metered and weighted.
 *
 * The figures are NOT counted up by a JS clock. That was the first design and
 * it is gone: a timer ticking setState drove the bar fine but React would not
 * repaint the money on a page loaded already scrolled here — the timer
 * provably ran and the numbers stayed at zero. The motion is CSS keyed off one
 * boolean, so a resting state that reads $0 is not reachable.
 */
export function VaultShowcase() {
  const [selected, setSelected] = useState<StrategyId>("balanced");
  const { ref: root, seen } = useReveal<HTMLDivElement>(0.2);

  const strategy = STRATEGIES.find((s) => s.id === selected)!;
  const lending = (EXAMPLE * strategy.stablePct) / 100;
  const basket = (EXAMPLE * strategy.stockPct) / 100;
  const litSegments = seen ? Math.round((strategy.stablePct / 100) * SEGMENTS) : 0;
  /* Divided by the basket, not by the logo table. Those were the same number
     while every holding happened to have artwork, and PIXEL_LOGOS is a list of
     pictures — adding a name whose mark has not been drawn yet would have
     quietly kept splitting the money four ways. */
  const perStock = basket / BASKET_STOCKS.length;
  const weight = strategy.stockPct / BASKET_STOCKS.length;

  return (
    <section id="preview">
      <div className="wrap">
        <div className="sec-head ctr reveal">
          <span className="eyebrow">{"// What you get"}</span>
          <h2>One deposit, split and working.</h2>
          <p>
            Put a stablecoin in once. It earns lending interest, grows into a curated
            basket of tokenized stocks, and holds its target split without being asked.
          </p>
        </div>

        <div className="showcase reveal" ref={root}>
          <div className="showcase-head">
            <span className="showcase-title">{strategy.name} vault</span>
            <span className="showcase-meta">ERC-4626 · BNB Chain · non-custodial</span>
            <span className="launch-live">
              <span className="d" /> Live contract
            </span>
          </div>

          {/* Segmented control on a recessed track — three states, one row. */}
          <div className="seg-control">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s.id)}
                aria-pressed={s.id === selected}
                className="seg-btn"
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Keyed on the strategy, so switching remounts rather than patches.
              Not stylistic: patching left stale text behind — the amounts
              updated but the "$1,000 each" line kept the previous strategy's
              figure, because that value sits between two literal strings in
              one element and React did not rewrite the text node. */}
          <div key={selected} className="showcase-body">
            <div className="showcase-top">
              <div>
                <div className="ui-label">You deposit</div>
                <div className="figure showcase-hero-figure">
                  <ScrambleFigure value={usd(EXAMPLE)} active={seen} />
                </div>
                <div className="showcase-sub">
                  <span className="chip">USDG</span>
                  once · no lockup
                </div>
              </div>

              <div className="showcase-split">
                <div className="ui-label">Target split</div>
                <div className="figure showcase-split-figure">
                  <ScrambleFigure value={strategy.split} active={seen} />
                </div>
                <div className="showcase-sub">yield / stocks</div>
              </div>
            </div>

            <div className="meter">
              <div className="meter-head">
                <span>Lending yield</span>
                <span className="ui-label">Allocation</span>
                <span>Tokenized stocks</span>
              </div>
              <div
                className="meter-track"
                role="img"
                aria-label={`${strategy.stablePct}% lending yield, ${strategy.stockPct}% tokenized stocks`}
              >
                {/* Two elements per segment, not one recoloured element: the
                    fill animates on opacity, which the compositor can do.
                    Transitioning background-color across forty of them is
                    forty repaints a frame for the length of the stagger. */}
                {Array.from({ length: SEGMENTS }, (_, i) => (
                  <span key={i} className="meter-cell">
                    {i < litSegments && (
                      <span
                        className="seg-fill meter-lit"
                        style={{ animationDelay: `${i * SEG_STAGGER}ms` }}
                      />
                    )}
                  </span>
                ))}
              </div>
              <div className="meter-scale">
                {[0, 25, 50, 75, 100].map((p) => (
                  <span key={p} style={{ left: `${p}%` }}>
                    <i />
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="legs">
              <div className="leg">
                <div className="leg-head">
                  <span className="ui-label">Lending leg</span>
                  <span className="leg-state">
                    <span className="animate-earn">●</span> Earning
                  </span>
                </div>
                <div className="figure leg-figure">
                  <ScrambleFigure value={usd(lending)} active={seen} />
                </div>
                <p>Supplied to an on-chain lending venue. Real interest, not emissions.</p>
                <div className="ui-label leg-foot">{strategy.stablePct}% of deposit</div>
              </div>

              <div className="leg">
                <div className="leg-head">
                  <span className="ui-label">Stock basket</span>
                  <span className="leg-state">
                    {strategy.stockPct === 0 ? "Empty" : "Evenly weighted"}
                  </span>
                </div>
                <div className="figure leg-figure">
                  <ScrambleFigure value={usd(basket)} active={seen} />
                </div>

                {strategy.stockPct === 0 ? (
                  <p>Steady holds no stocks. All of it stays in the yield leg.</p>
                ) : (
                  <div className="holdings">
                    {BASKET_STOCKS.map((logo, i) => (
                      <div
                        key={logo.symbol}
                        className="holding figure-in"
                        style={{ animationDelay: `${120 + i * 80}ms` }}
                      >
                        <span className="holding-mark">
                          <BrandMark sym={logo.symbol} size={15} />
                        </span>
                        <span className="holding-sym">{logo.symbol}</span>
                        {/* The weight is drawn rather than stated, and it is
                            live: the bar wanders off target and snaps back,
                            which is exactly what the line underneath claims
                            happens. The tick marks the target it returns to,
                            so the movement reads as drift against a goal. */}
                        <span className="holding-bar">
                          <i style={{ left: `${weight * 2.4}%` }} />
                          <span
                            className="weight-drift"
                            style={
                              {
                                width: `${weight * 2.4}%`,
                                "--drift": DRIFT[i % DRIFT.length],
                              } as React.CSSProperties
                            }
                          />
                        </span>
                        <span className="holding-value figure">
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
                        the text; the flash is decoration for the moment the
                        bars snap back, so it is hidden from readers. */}
                    <div className="holding-note">
                      <span className="drift-label">
                        {weight}% each · rebalanced on drift
                      </span>
                      <span aria-hidden className="drift-flash">
                        Drift over band · rebalancing
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="showcase-foot">
            <span className="ui-label">Redeem anytime · in kind · nobody can block it</span>
            <Link className="btn btn-primary" href="/app">
              <span className="lbl">Open the vault</span>
              <span className="arw">
                <ArrowRightIcon />
              </span>
            </Link>
          </div>
        </div>

        <div className="showcase-cap">Simulated · example figures, not performance</div>
      </div>
    </section>
  );
}
