"use client";

import { useEffect, useRef } from "react";

/**
 * A figure settling on its value: the digits churn for a moment and lock in
 * from the left, so a number that changed reads as recalculated rather than
 * swapped.
 *
 * Built so the wrong number cannot survive on screen. The vault preview lost an
 * earlier count-up for exactly that reason -- a JS clock owned the displayed
 * value, and on a page loaded already scrolled to that section the clock's
 * repaints never landed and the money sat at $0 for ever. So here the value is
 * never JS-owned:
 *
 *   1. React renders the true string. That is the server output and the resting
 *      state; if this effect never runs at all, the figure is already correct.
 *   2. The scramble writes over it imperatively and only ever writes characters
 *      derived from that same true string -- digits are replaced, everything
 *      else is copied -- so even a frame caught mid-flight shows the real
 *      figure's shape, and its tail digits are the only thing in motion.
 *   3. Progress comes from the clock, not from a frame count. A throttled or
 *      frozen rAF (background tab, occluded window) cannot stall it partway:
 *      the next frame to run, whenever it comes, computes progress >= 1 and
 *      writes the truth.
 *   4. A timeout independently forces the true value in, in case no further
 *      frame ever arrives.
 *   5. Cleanup writes it too.
 *
 * Only digits churn, never the separators, so `$` `,` `/` and spaces hold still
 * and the string keeps its width — with .figure's tabular numerals that
 * means no reflow while it runs.
 */

const DIGITS = "0123456789";

interface ScrambleFigureProps {
  /** The real, final text. Rendered as-is; the animation only decorates it. */
  value: string;
  className?: string;
  /** Held still while false — lets the caller wait until the card is on screen. */
  active?: boolean;
  durationMs?: number;
}

export function ScrambleFigure({
  value,
  className,
  active = true,
  durationMs = 620,
}: ScrambleFigureProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let settled = false;
    const start = performance.now();

    const settle = () => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(raf);
      el.textContent = value;
    };

    const tick = (now: number) => {
      const p = (now - start) / durationMs;
      if (p >= 1) {
        settle();
        return;
      }
      /* Slightly ahead of linear, so the last digit locks a little before the
         end and the figure is readable for the final beat instead of resolving
         on the very last frame. */
      const locked = Math.floor(p * value.length * 1.25);
      let out = "";
      for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        out +=
          i < locked || ch < "0" || ch > "9"
            ? ch
            : DIGITS[(Math.random() * 10) | 0];
      }
      el.textContent = out;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    const guard = window.setTimeout(settle, durationMs + 300);

    return () => {
      clearTimeout(guard);
      settle();
    };
  }, [value, active, durationMs]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
