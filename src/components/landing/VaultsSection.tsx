"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ArrowRightIcon, VaultMark } from "@/components/icons";
import { StrategyGlyph } from "@/components/StrategyGlyph";
import { ORBIT_SATELLITES } from "@/lib/landing";
import { STRATEGIES } from "@/lib/strategies";
import type { CSSProperties } from "react";

/**
 * The basket, orbiting the vault.
 *
 * Decorative, and honest about it: the satellites are the holdings and nothing
 * more, all of them, straight from ORBIT_SATELLITES. Each ring spins at its own
 * period with a negative delay to desynchronise its starting angle, and the
 * badge counter-rotates at the same period so the mark inside stays upright
 * instead of tumbling.
 *
 * The marks are <BrandMark />, not the house pixel grid: at badge size the
 * grid has fewer device pixels than cells and every one collapses into the
 * same smudge. See BrandMark.tsx.
 */
function VaultOrbit() {
  return (
    <div className="orbit" aria-hidden="true">
      <div className="sweep" />
      <div className="ring" />
      <div className="ring r2" />
      <div className="core">
        <VaultMark width={48} height={48} />
      </div>
      {ORBIT_SATELLITES.map((sat, i) => (
        <div
          className="sat"
          key={sat.sym}
          style={
            {
              "--t": sat.duration,
              /* Alternate the two drawn rings. The inner one is set to the
                 ring's own inset so a badge sits on the line rather than
                 floating near it — see `--orbit` in globals.css. */
              ...(i % 2 ? { "--orbit": "24%" } : {}),
              ...("delay" in sat && sat.delay ? { animationDelay: sat.delay } : {}),
            } as CSSProperties
          }
        >
          <b>
            <BrandMark sym={sat.sym} size={22} />
          </b>
        </div>
      ))}
    </div>
  );
}

/**
 * The three vaults, as a launchpad card on the page's widest surface.
 *
 * Split figures and copy come from lib/strategies.ts — the same source the app
 * renders from, so the marketing page cannot drift from the product.
 */
export function VaultsSection() {
  return (
    <section id="vaults">
      <div className="wrap">
        <div className="sec-head ctr reveal">
          <span className="eyebrow">{"// Vaults"}</span>
          <h2>Three targets. Pick a lane.</h2>
          <p>
            Every vault is the same contract with a different split between the yield
            floor and the basket. Move between them whenever you like — nothing locks.
          </p>
        </div>

        <div className="launch reveal">
          <VaultOrbit />

          <div className="launch-list">
            <div className="launch-head">
              <span className="lh-t">Deployed vaults</span>
              <span className="launch-live">
                <span className="d" /> Live on Robinhood Chain
              </span>
            </div>

            {STRATEGIES.map((s) => (
              <Link className="pool-bub" key={s.id} href="/app">
                <span className="pav">
                  <StrategyGlyph id={s.id} />
                </span>
                <span className="pnm">
                  <b>{s.name}</b>
                  <small>{s.short}</small>
                </span>
                <span className="pool-apr">
                  <b>{s.split}</b>
                  <small>yield / stocks</small>
                </span>
                <span className="pool-stake">Open</span>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 42 }} className="reveal">
          <Link className="btn btn-primary" href="/app">
            <span className="lbl">Launch the app</span>
            <span className="arw">
              <ArrowRightIcon />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
