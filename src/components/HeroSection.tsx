"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export function HeroSection() {
  const [shown, setShown] = useState<number[]>([]);

  useEffect(() => {
    const timeouts = BOOT.map((e, i) =>
      setTimeout(() => setShown((s) => [...s, i]), e.delay),
    );
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <section className="min-h-[78vh] flex flex-col items-center justify-center px-8 py-16 border-b border-wire-border text-center">
      <div className="font-mono text-[12px] text-wire-muted mb-8 tracking-widest hidden md:block">
        <div>┌──────────────────────────────┐</div>
        {/* Hard spaces: the box only lines up if the padding survives, and
                JSX text collapses runs of ordinary whitespace. */}
        <div>{"│  BALANCED VAULT · 60 / 40    │"}</div>
        <div>{"│  SPLIT: ████████░░░░░  AUTO   │"}</div>
        <div>└──────────────────────────────┘</div>
      </div>
      {/* The wrapper carries the scroll-parallax (transform + opacity only, so
          it stays on the compositor and never touches the text); the pre keeps
          its glitch and flicker and is left out of the matrix dissolve. */}
      <div data-hero-logo className="mb-8 will-change-transform">
        <pre
          data-no-matrix
          className="font-mono text-[10px] md:text-[14px] lg:text-[18px] leading-tight text-wire-cyan glow-cyan glitch animate-flicker whitespace-pre"
          data-text={ASCII}
        >
          {ASCII}
        </pre>
      </div>
      <div className="font-mono text-base md:text-lg text-wire-muted mb-4 tracking-[0.25em] flex items-center gap-2 justify-center">
        <span className="text-wire-cyan">▶</span>GROW YOUR BAG, AUTOMATICALLY
      </div>
      <p className="font-mono text-xs md:text-sm text-wire-muted max-w-xl mb-10 leading-relaxed md:leading-5">
        Deposit stablecoin. It earns real on-chain lending yield, grows into a
        curated basket of tokenized stocks, and rebalances itself — on Robinhood
        Chain. No app. No lockups. Your funds sit at your own address — the
        protocol can never move them.
      </p>
      <div className="mb-10 space-y-1 text-left inline-block">
        {BOOT.map((e, i) => (
          <div
            key={e.text}
            className={
              "font-mono text-sm transition-all duration-200 " +
              (shown.includes(i) ? "opacity-100" : "opacity-0") +
              " " +
              (i === BOOT.length - 1 ? "text-wire-cyan" : "text-wire-muted")
            }
          >
            {e.text}
          </div>
        ))}
        {shown.length === BOOT.length && (
          <div className="text-wire-cyan font-mono text-sm cursor" />
        )}
      </div>
      <div className="space-y-3 flex flex-col items-center">
        <Link
          href="/app"
          className="flex items-center gap-3 bg-wire-cyan text-black font-mono font-bold text-base px-10 py-4 hover:opacity-90 hover:shadow-[0_0_40px_rgba(214,254,81,0.35)] transition-all tracking-widest"
        >
          START GROWING →
        </Link>
        <div className="font-mono text-xs text-wire-muted">
          _ SELF-CUSTODIAL VAULT · ONE DEPOSIT · REDEEM ANYTIME IN-KIND
        </div>
      </div>
    </section>
  );
}
