"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bracket } from "@/components/Bracket";

const ASCII = `
██████╗ ██╗     ██╗   ██╗██████╗
██╔══██╗██║     ██║   ██║██╔══██╗
██████╔╝██║     ██║   ██║██████╔╝
██╔══██╗██║     ██║   ██║██╔══██╗
██████╔╝███████╗╚██████╔╝██║  ██║
╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═╝
`.trim();

const BOOT = [
  { delay: 0, text: "> VAULT ENGINE  ............. [OK]" },
  { delay: 700, text: "> YIELD ORACLE  ............. [OK]" },
  { delay: 1400, text: "> KEEPER LOOP   ............. [OK]" },
  { delay: 2100, text: "> REBALANCING @ 60/40 TARGET .... [ACTIVE]" },
];

/**
 * The deployment readout beside the boot sequence.
 *
 * These are build-time constants rather than live reads: three vaults are
 * deployed, twelve contracts are verified on Blockscout, redemption has no
 * pause switch. Nothing here needs a network call, so the panel cannot spin,
 * fail or go stale.
 */
const STATUS: { label: string; value: string; tone: "good" | "plain" }[] = [
  { label: "VAULT CONTRACTS", value: "LIVE ON MAINNET", tone: "good" },
  { label: "SOURCE VERIFIED", value: "12 / 12", tone: "good" },
  { label: "CUSTODY", value: "YOURS", tone: "good" },
  { label: "WITHDRAWAL LOCK", value: "NONE", tone: "plain" },
  { label: "FEE", value: "5% OF GAINS ONLY", tone: "plain" },
];

const TONE = {
  good: "text-wire-cyan",
  plain: "text-wire-muted",
} as const;

export function HeroSection() {
  const [shown, setShown] = useState(0);
  const [booted, setBooted] = useState<number[]>([]);

  useEffect(() => {
    // One timer stepping a count, rather than one timeout per row: the rows
    // are data, and a timeout array has to be kept in sync with them by hand.
    const id = setInterval(
      () => setShown((n) => (n >= STATUS.length ? n : n + 1)),
      160,
    );
    const timeouts = BOOT.map((e, i) =>
      setTimeout(() => setBooted((s) => [...s, i]), e.delay),
    );
    return () => {
      clearInterval(id);
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <section className="border-b border-wire-border px-6 md:px-10 py-14 md:py-20">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-12 lg:gap-16 items-center">
        {/* Left: the pitch. Centred while it is the only column, left-aligned
            once the status panel sits beside it -- centred text against a
            left-aligned neighbour reads as a mistake. */}
        <div className="text-center lg:text-left">
          <div data-hero-logo className="mb-7 will-change-transform inline-block">
            <pre
              data-no-matrix
              className="font-mono text-[10px] md:text-[14px] lg:text-[17px] leading-tight text-wire-cyan glow-cyan glitch animate-flicker whitespace-pre"
              data-text={ASCII}
            >
              {ASCII}
            </pre>
          </div>

          {/* The marker is inline rather than a flex sibling: as a flex child it
              centred itself against a two-line heading and drifted to the far
              left of the column on narrow screens. */}
          <div className="font-mono text-base md:text-lg text-wire-muted mb-4 tracking-[0.25em]">
            <span className="text-wire-cyan mr-2">▶</span>GROW YOUR BAG, AUTOMATICALLY
          </div>

          <p className="font-mono text-xs md:text-sm text-wire-muted max-w-xl mx-auto lg:mx-0 mb-9 leading-relaxed md:leading-5">
            Deposit stablecoin. It earns real on-chain lending yield, grows into a
            curated basket of tokenized stocks, and rebalances itself — on Robinhood
            Chain. No app. No lockups. Your funds sit at your own address — the
            protocol can never move them.
          </p>

          <div className="mb-9 space-y-1 text-left inline-block">
            {BOOT.map((e, i) => (
              <div
                key={e.text}
                className={
                  "font-mono text-sm transition-all duration-200 " +
                  (booted.includes(i) ? "opacity-100" : "opacity-0") +
                  " " +
                  (i === BOOT.length - 1 ? "text-wire-cyan" : "text-wire-muted")
                }
              >
                {e.text}
              </div>
            ))}
            {booted.length === BOOT.length && (
              <div className="text-wire-cyan font-mono text-sm cursor" />
            )}
          </div>

          <div className="flex flex-col items-center lg:items-start gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-3 bg-wire-cyan text-black font-mono font-bold text-base px-10 py-4 hover:opacity-90 hover:shadow-[0_0_40px_rgba(214,254,81,0.35)] transition-all tracking-widest"
            >
              START GROWING →
            </Link>
            <div className="font-mono text-xs text-wire-muted">
              _ SELF-CUSTODIAL VAULT · ONE DEPOSIT · REDEEM ANYTIME IN-KIND
            </div>
          </div>
        </div>

        {/* Right: the same panel chrome the rest of the page uses, so the first
            screen introduces the vocabulary the vault preview then speaks. */}
        <div className="relative border border-wire-cyan/25 bg-black/25 w-full max-w-md mx-auto lg:mx-0">
          <Bracket at="tl" />
          <Bracket at="tr" />
          <Bracket at="bl" />
          <Bracket at="br" />

          <div className="flex items-center justify-between border-b border-wire-cyan/20 px-4 py-2.5">
            <span className="font-mono text-[10px] text-wire-cyan tracking-[0.22em]">
              ▸ SYSTEM STATUS
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-wire-muted tracking-[0.18em]">
              <span className="h-1.5 w-1.5 rounded-full bg-wire-cyan animate-pulse" />
              CHAIN 4663
            </span>
          </div>

          <div className="px-4 py-4 space-y-2">
            {STATUS.map((row, i) => (
              <div
                key={row.label}
                className={
                  "flex items-baseline gap-2 font-mono text-[11px] transition-opacity duration-300 " +
                  (i < shown ? "opacity-100" : "opacity-0")
                }
              >
                <span className="text-wire-muted/70 shrink-0">{row.label}</span>
                {/* Leader dots fill whatever gap the two labels leave, so the
                    column of values stays flush without measuring anything.
                    Drawn as a tiled gradient rather than a dotted border: a
                    1px dotted border renders as a dashed smear at this size,
                    and its dot pitch is not adjustable. */}
                <span
                  aria-hidden
                  className="flex-1 self-center h-px bg-[length:5px_1px] bg-repeat-x"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 50%, rgba(200,200,200,0.32) 0.5px, transparent 0.5px)",
                  }}
                />
                <span className={`shrink-0 tracking-wider ${TONE[row.tone]}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-wire-cyan/20 px-4 py-3">
            <div className="flex items-center justify-between font-mono text-[10px] text-wire-muted tracking-[0.18em] mb-1.5">
              <span>BALANCED · 60 / 40</span>
              <span className="text-wire-muted/60">AUTO</span>
            </div>
            {/* The split, drawn rather than described: the same 60/40 the vault
                preview below animates, so the two agree on sight. */}
            <div className="flex h-1.5 gap-px overflow-hidden">
              <div className="w-[60%] bg-wire-cyan/70" />
              <div className="w-[40%] bg-wire-cyan/25" />
            </div>
            <div className="flex justify-between font-mono text-[9px] text-wire-muted/60 mt-1.5 tracking-[0.14em]">
              <span>LENDING</span>
              <span>STOCKS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
