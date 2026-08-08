"use client";

import Link from "next/link";
import { ArrowRightIcon, VaultMark } from "@/components/icons";
import { PixelLogo } from "@/components/PixelLogo";
import { ORBIT_SATELLITES } from "@/lib/landing";
import { PIXEL_LOGOS } from "@/lib/pixel-logos";
import { STRATEGIES } from "@/lib/strategies";
import type { CSSProperties } from "react";

/** Ticker -> pixel mark, so a satellite can be named rather than indexed. */
const MARK_BY_SYM = Object.fromEntries(PIXEL_LOGOS.map((l) => [l.key, l]));

/**
 * The basket, orbiting the vault.
 *
 * Decorative, and honest about it: the four satellites are the four holdings
 * and nothing more. Each ring spins at its own period with a negative delay to
 * desynchronise its starting angle, and the badge counter-rotates at the same
 * period so the mark inside stays upright instead of tumbling.
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
      {ORBIT_SATELLITES.map((sat) => {
        const mark = MARK_BY_SYM[sat.sym];
        return (
          <div
            className="sat"
            key={sat.sym}
            style={
              {
                "--t": sat.duration,
                ...("delay" in sat && sat.delay ? { animationDelay: sat.delay } : {}),
              } as CSSProperties
            }
          >
            <b>{mark ? <PixelLogo logo={mark} size={22} /> : sat.sym}</b>
          </div>
        );
      })}
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
                <span className="pav">{s.name.slice(0, 2).toUpperCase()}</span>
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
