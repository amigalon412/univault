"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WordMark } from "@/components/WordMark";

/**
 * Four facts about the running system, revealed one after another.
 *
 * Was a terminal boot log with dot leaders and [OK] markers. The content is
 * worth keeping -- it is the only place on the fold that says the thing is
 * actually running -- but the form is not: on a Uniswap-shaped page these read
 * as status chips, so that is what they are now.
 */
const STATUS = [
  { delay: 0, label: "Vault engine", value: "Live" },
  { delay: 600, label: "Yield oracle", value: "Live" },
  { delay: 1200, label: "Keeper loop", value: "Live" },
  { delay: 1800, label: "Rebalancing", value: "60 / 40 target", lit: true },
];

export function HeroSection() {
  const [booted, setBooted] = useState<number[]>([]);
  const headline = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeouts = STATUS.map((e, i) =>
      setTimeout(() => setBooted((s) => [...s, i]), e.delay),
    );
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, []);

  /* The headline's scroll parallax. One element, transform and opacity only, so
     every frame is a compositor operation with no layout, no paint and no text
     mutation. */
  useEffect(() => {
    const el = headline.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    const apply = () => {
      ticking = false;
      const p = Math.min(1, window.scrollY / (window.innerHeight * 0.6));
      el.style.transform = `translateY(${(-30 * p).toFixed(1)}px)`;
      el.style.opacity = (1 - 0.7 * p).toFixed(3);
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
    <section className="min-h-[78vh] flex flex-col items-center justify-center px-6 md:px-10 py-16 md:py-24">
      <div className="w-full max-w-3xl text-center">
        <div ref={headline} className="will-change-transform">
          {/* The wordmark. Width-driven, not font-size-driven: it is an SVG
              grid, so one max-width sets its size at every breakpoint and the
              letterforms cannot come apart. */}
          <WordMark className="mx-auto mb-9 w-full max-w-[300px] sm:max-w-[440px] md:max-w-[560px] animate-flicker" />

          <h1 className="text-[2.75rem] leading-[1.05] sm:text-6xl md:text-7xl font-semibold tracking-[-0.04em] text-white mb-6">
            Grow your bag,
            <br />
            <span className="text-wire-cyan">automatically.</span>
          </h1>

          <p className="text-base md:text-lg text-wire-muted max-w-xl mx-auto mb-10 leading-relaxed">
            Deposit stablecoin once. It earns real on-chain lending yield, grows
            into a curated basket of tokenized stocks, and rebalances itself. No
            lockups. Your funds sit at your own address — the protocol can never
            move them.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 mb-12">
          <Link
            href="/app"
            /* pulse-glow idles a halo around the primary action. It stops on
               hover by design — an animated box-shadow outranks the hover
               shadow in the cascade, so leaving it running would swallow the
               button's own feedback. Stopping hands the shadow back. */
            className="pulse-glow uni-pill inline-flex items-center gap-2 bg-wire-cyan text-black text-base md:text-lg font-semibold px-9 py-4 hover:shadow-[0_10px_40px_rgba(252,114,255,0.35)]"
          >
            Get started
            <span aria-hidden>→</span>
          </Link>
          <div className="text-xs md:text-sm text-wire-muted">
            Self-custodial vault · One deposit · Redeem anytime in-kind
          </div>
        </div>

        {/* Status chips, arriving one at a time. Held at opacity 0 rather than
            unmounted so the row never reflows as they land. */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {STATUS.map((e, i) => (
            <div
              key={e.label}
              className={
                "flex items-center gap-2 rounded-full border border-wire-border bg-wire-card/70 px-3.5 py-2 text-xs transition-opacity duration-300 " +
                (booted.includes(i) ? "opacity-100" : "opacity-0")
              }
            >
              <span
                className={
                  "h-1.5 w-1.5 rounded-full " +
                  (e.lit ? "bg-wire-cyan animate-earn" : "bg-wire-green")
                }
              />
              <span className="text-wire-muted">{e.label}</span>
              <span className={e.lit ? "text-wire-cyan font-medium" : "text-white/80"}>
                {e.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
