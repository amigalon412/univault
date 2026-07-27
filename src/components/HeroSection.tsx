"use client";

import { useEffect, useRef, useState } from "react";
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
  const [booted, setBooted] = useState<number[]>([]);
  const logo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeouts = BOOT.map((e, i) =>
      setTimeout(() => setBooted((s) => [...s, i]), e.delay),
    );
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, []);

  /* The logo's scroll parallax used to be a side job of the page-wide matrix
     effect, which has been removed. It is kept here because it is the cheap
     half: one element, transform and opacity only, so every frame is a
     compositor operation with no layout, no paint and no text mutation. */
  useEffect(() => {
    const el = logo.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    const apply = () => {
      ticking = false;
      const p = Math.min(1, window.scrollY / (window.innerHeight * 0.6));
      el.style.transform = `translateY(${(-34 * p).toFixed(1)}px) scale(${(1 - 0.05 * p).toFixed(3)})`;
      el.style.opacity = (1 - 0.65 * p).toFixed(3);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="min-h-[78vh] flex flex-col items-center justify-center border-b border-wire-border px-6 md:px-10 py-14 md:py-20">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <div ref={logo} className="mb-7 will-change-transform inline-block">
            <pre
             
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

          <p className="font-mono text-xs md:text-sm text-wire-muted max-w-xl mx-auto mb-9 leading-relaxed md:leading-5">
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

          <div className="flex flex-col items-center gap-3">
            <Link
              href="/app"
              /* pulse-glow idles a halo around the primary action. It stops on
                 hover by design — an animated box-shadow outranks the hover
                 shadow in the cascade, so leaving it running would swallow the
                 button's own feedback. Stopping hands the shadow back. */
              className="pulse-glow inline-flex items-center gap-3 bg-wire-cyan text-black font-mono font-bold text-base px-10 py-4 hover:opacity-90 hover:shadow-[0_0_40px_rgba(214,254,81,0.35)] transition-all tracking-widest"
            >
              START GROWING →
            </Link>
            <div className="font-mono text-xs text-wire-muted">
              _ SELF-CUSTODIAL VAULT · ONE DEPOSIT · REDEEM ANYTIME IN-KIND
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
