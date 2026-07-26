"use client";

import { useEffect, useRef } from "react";

/**
 * A slow green meteor shower behind the page, falling top-right to bottom-left.
 *
 * Drawn on one canvas rather than as animated DOM nodes. Two dozen elements each
 * carrying its own infinite CSS transform is two dozen compositor layers and two
 * dozen animations for the AnimationGovernor to walk; a canvas is one layer, one
 * rAF loop, and nothing for the governor to find. The canvas is `fixed`, so it
 * never moves with the page and the effect costs nothing on scroll -- there is no
 * scroll listener here at all.
 *
 * Everything is in the accent green, faint enough to sit under text without
 * competing with it. Tune SPEED and DENSITY below; they are the two knobs.
 */

// Exactly diagonal, in canvas coordinates where y grows downward: down and left.
const ANGLE = (3 * Math.PI) / 4;
const DX = Math.cos(ANGLE);
const DY = Math.sin(ANGLE);

// px per second. Slow on purpose -- a streak takes ten to twenty seconds to
// cross a laptop screen, which reads as drift rather than as rain.
const SPEED_MIN = 52;
const SPEED_MAX = 118;

// One meteor per this many square px of viewport, clamped by the bounds below.
const DENSITY = 62_000;
const COUNT_MIN = 10;
const COUNT_MAX = 30;

/* Three depth tiers. Nearer streaks are longer, brighter and faster, which is
   the whole of the parallax -- there is no separate depth axis. */
const TIERS = [
  { len: 96, width: 1.0, alpha: 0.3, speed: 0.55 },
  { len: 156, width: 1.4, alpha: 0.48, speed: 0.78 },
  { len: 224, width: 1.9, alpha: 0.68, speed: 1.0 },
] as const;

const ACCENT = "214,254,81";

interface Meteor {
  x: number;
  y: number;
  tier: number;
  speed: number;
  /* Slow brightness wobble, so the field never looks like it is on rails. */
  twinkleRate: number;
  twinklePhase: number;
}

export function Starfall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* Honour the OS setting rather than dimming the effect: someone who asks for
       reduced motion does not want a slower meteor shower, they want none. The
       rAF loop never starts, so the cost is a blank canvas element. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const meteors: Meteor[] = [];
    /* One gradient per tier, not one per meteor per frame. Gradient coordinates
       resolve against the transform in effect when the stroke is painted, so a
       gradient built once in local space (head at the origin, tail at -len)
       lands correctly for every meteor once we translate and rotate to it. */
    let trails: CanvasGradient[] = [];

    const spawn = (m: Meteor, initial: boolean) => {
      const tier = TIERS[m.tier];
      /* Travelling at 45 degrees, a streak entering the top at x drifts a full
         viewport height leftwards before it exits the bottom. Seeding x across
         width + height is what keeps the bottom-left corner as populated as the
         top-right one; the surplus on the right enters through the right edge
         partway down, which is what sells the diagonal. */
      m.x = Math.random() * (width + height + tier.len * 2) - tier.len;
      m.y = initial ? Math.random() * height : -tier.len - Math.random() * height * 0.4;
      m.speed = (SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)) * tier.speed;
      m.twinkleRate = 0.35 + Math.random() * 0.9;
      m.twinklePhase = Math.random() * Math.PI * 2;
    };

    const build = () => {
      const target = Math.min(
        COUNT_MAX,
        Math.max(COUNT_MIN, Math.round((width * height) / DENSITY)),
      );

      // Keep the streaks already in flight; only add or trim the difference, so
      // a resize does not restart the whole field.
      while (meteors.length > target) meteors.pop();
      while (meteors.length < target) {
        const m: Meteor = {
          x: 0,
          y: 0,
          tier: meteors.length % TIERS.length,
          speed: 0,
          twinkleRate: 0,
          twinklePhase: 0,
        };
        spawn(m, true);
        meteors.push(m);
      }

      trails = TIERS.map((tier) => {
        const g = ctx.createLinearGradient(0, 0, -tier.len, 0);
        g.addColorStop(0, `rgba(${ACCENT},1)`);
        g.addColorStop(0.28, `rgba(${ACCENT},0.42)`);
        g.addColorStop(1, `rgba(${ACCENT},0)`);
        return g;
      });
    };

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      /* Mobile browsers fire resize every time the address bar slides, which is
         a height change of a hundred-odd px and nothing else. Rebuilding the
         field on each of those is visible as a stutter, so small height-only
         changes are ignored. */
      if (w === width && Math.abs(h - height) < 90) return;

      width = w;
      height = h;
      // Capped: a background effect at 3x on a phone buys nothing anyone can see
      // and costs nine times the fill rate.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      build();
    };

    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);

      /* Clamped: coming back from a background tab hands us a delta of minutes,
         and an unclamped step would teleport every streak off-screen at once. */
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;

      ctx.clearRect(0, 0, width, height);
      const t = now / 1000;

      for (const m of meteors) {
        const tier = TIERS[m.tier];
        m.x += DX * m.speed * dt;
        m.y += DY * m.speed * dt;

        // Off the bottom, or off the left past its own trail.
        if (m.y - tier.len > height || m.x + tier.len < 0) {
          spawn(m, false);
          continue;
        }

        const alpha =
          tier.alpha * (0.72 + 0.28 * Math.sin(t * m.twinkleRate + m.twinklePhase));

        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(ANGLE);
        ctx.globalAlpha = alpha;

        ctx.strokeStyle = trails[m.tier];
        ctx.lineWidth = tier.width;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-tier.len, 0);
        ctx.stroke();

        // The head, a touch brighter than the trail it drags.
        ctx.globalAlpha = Math.min(1, alpha * 1.7);
        ctx.fillStyle = `rgb(${ACCENT})`;
        ctx.beginPath();
        ctx.arc(0, 0, tier.width * 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    };

    const start = () => {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // rAF is already throttled in a hidden tab, but not in every browser and not
    // when the window is merely occluded. Stopping outright is free to undo.
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    start();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
