"use client";

import { useEffect, useRef } from "react";
import { PIXEL_GRID, PIXEL_LOGOS } from "@/lib/pixel-logos";

/**
 * Stock logos falling behind the page.
 *
 * Replaces the green meteor shower this site used to run. Same engineering --
 * one fixed canvas, one rAF loop, nothing for AnimationGovernor to walk -- but
 * what falls is the basket the vault actually holds, and nothing else.
 *
 * THE POOL IS PIXEL_LOGOS, not a list of its own. An earlier pass padded the
 * field with a dozen extra tickers (MSFT, GOOGL, SPY...) drawn as text chips,
 * on the theory that four marks on a loop would read as repetitive. They read
 * as a portfolio the vault does not hold, which is worse than repetitive on a
 * page whose whole argument is that you can check what it owns. Sourcing the
 * field from the same array the basket renders from means adding a holding to
 * the vault adds it here, and nothing can appear here that is not in it.
 *
 * Each chip is a Uniswap token badge: a filled circle on the card grey, a rim
 * tinted by the mark, and the company logo inside in its own colours.
 *
 * Two knobs: DENSITY and the SPEED pair.
 */

/* Brand colour per mark. The four pixel grids in pixel-logos.ts deliberately
   throw colour away -- they were sampled for a page that drew everything in one
   accent -- so the colour has to come back from somewhere, and this is it. */
const LOGO_COLOURS: Record<string, string> = {
  NVDA: "#76b900",
  AAPL: "#f5f5f7",
  TSLA: "#e82127",
  AMZN: "#ff9900",
};

/** Fallback for a mark added to pixel-logos.ts without a colour here. */
const DEFAULT_COLOUR = "#ffffff";

// px per second, before the tier multiplier. Slow: a badge should take ten-odd
// seconds to cross a laptop screen, so the field reads as drifting, not raining.
const SPEED_MIN = 26;
const SPEED_MAX = 58;

// One chip per this many square px of viewport, clamped by the bounds below.
const DENSITY = 58_000;
const COUNT_MIN = 10;
const COUNT_MAX = 26;

/* Three depth tiers. Nearer chips are bigger, brighter and faster -- that is
   the whole of the parallax, there is no separate depth axis.

   Higher than the monochrome pass ran at. A white mark at 0.15 is a smudge you
   read as texture; a brand colour at 0.15 is a smudge you read as a rendering
   fault, because the eye expects a colour it recognises to resolve. These are
   the alphas at which NVIDIA green is NVIDIA green and the hero headline still
   wins the foreground. */
const TIERS = [
  { size: 30, alpha: 0.26, speed: 0.6 },
  { size: 44, alpha: 0.36, speed: 0.82 },
  { size: 60, alpha: 0.48, speed: 1 },
] as const;

/** Offscreen size the pixel marks are rasterised at, once, at mount. */
const SPRITE_PX = 96;

interface Chip {
  x: number;
  y: number;
  tier: number;
  speed: number;
  /** Index into PIXEL_LOGOS. */
  logo: number;
  /** Sway is a sine on the x axis, so no chip falls on a rail. */
  swayRate: number;
  swayPhase: number;
  swayAmp: number;
  spin: number;
  spinRate: number;
}

/** "#76b900" -> "118,185,0", so a level can be mixed into the alpha channel. */
function toRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/**
 * Rasterise one pixel-grid mark into an offscreen canvas in its brand colour.
 *
 * Drawn once per mark at mount and then blitted, because painting 676 cells per
 * chip per frame is not a background effect, it is a benchmark.
 */
function renderSprite(rows: string[], hex: string): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = SPRITE_PX;
  c.height = SPRITE_PX;
  const g = c.getContext("2d");
  if (!g) return null;

  const rgb = toRgb(hex);
  const cell = SPRITE_PX / PIXEL_GRID;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const level = row.charCodeAt(x) - 48;
      if (level <= 0) continue;
      g.fillStyle = `rgba(${rgb},${(0.35 + (level / 9) * 0.65).toFixed(3)})`;
      // +1 on the size so neighbouring cells butt up instead of leaving seams
      // at fractional cell widths.
      g.fillRect(x * cell, y * cell, cell + 0.6, cell + 0.6);
    }
  }
  return c;
}

export function LogoFall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* Honour the OS setting rather than dimming the effect: someone who asks
       for reduced motion does not want slower falling logos, they want none.
       The rAF loop never starts, so the cost is one blank canvas element. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const sprites = PIXEL_LOGOS.map((l) =>
      renderSprite(l.rows, LOGO_COLOURS[l.key] ?? DEFAULT_COLOUR),
    );

    let width = 0;
    let height = 0;
    const chips: Chip[] = [];

    /* Which mark a respawning chip gets, dealt from a shuffled bag rather than
       drawn independently.

       Independent draws are uniform in the long run and lumpy in the short run,
       and the short run is the only run anyone sees: with four marks over a
       couple of dozen chips, a stretch of five NVIDIAs and no Apple at all is
       an ordinary outcome, and it does not read as chance -- it reads as the
       basket being wrong. A bag holding one of each, reshuffled when it empties,
       cannot drift further than one cycle from even, and still never repeats a
       fixed order. */
    let bag: number[] = [];
    const dealLogo = (): number => {
      if (!bag.length) {
        bag = PIXEL_LOGOS.map((_, i) => i);
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      return bag.pop()!;
    };

    const spawn = (c: Chip, initial: boolean) => {
      const tier = TIERS[c.tier];
      c.x = Math.random() * width;
      c.y = initial
        ? Math.random() * height
        : -tier.size - Math.random() * height * 0.5;
      c.speed = (SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)) * tier.speed;
      c.logo = dealLogo();
      c.swayRate = 0.14 + Math.random() * 0.3;
      c.swayPhase = Math.random() * Math.PI * 2;
      c.swayAmp = 8 + Math.random() * 26;
      c.spin = (Math.random() - 0.5) * 0.5;
      c.spinRate = (Math.random() - 0.5) * 0.12;
    };

    const build = () => {
      const target = Math.min(
        COUNT_MAX,
        Math.max(COUNT_MIN, Math.round((width * height) / DENSITY)),
      );

      // Keep the chips already in flight; only add or trim the difference, so a
      // resize does not restart the whole field.
      while (chips.length > target) chips.pop();
      while (chips.length < target) {
        const c: Chip = {
          x: 0,
          y: 0,
          tier: chips.length % TIERS.length,
          speed: 0,
          logo: 0,
          swayRate: 0,
          swayPhase: 0,
          swayAmp: 0,
          spin: 0,
          spinRate: 0,
        };
        spawn(c, true);
        chips.push(c);
      }
    };

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      /* Mobile browsers fire resize every time the address bar slides, which is
         a height change of a hundred-odd px and nothing else. Rebuilding the
         field on each of those is visible as a stutter. */
      if (w === width && Math.abs(h - height) < 90) return;

      width = w;
      height = h;
      // Capped: a background effect at 3x on a phone buys nothing anyone can
      // see and costs nine times the fill rate.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);

      /* Clamped: coming back from a background tab hands us a delta of minutes,
         and an unclamped step would teleport every chip off-screen at once. */
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;

      ctx.clearRect(0, 0, width, height);
      const t = now / 1000;

      for (const c of chips) {
        const tier = TIERS[c.tier];
        c.y += c.speed * dt;
        c.spin += c.spinRate * dt;

        if (c.y - tier.size > height) {
          spawn(c, false);
          continue;
        }

        const x = c.x + Math.sin(t * c.swayRate + c.swayPhase) * c.swayAmp;
        const r = tier.size / 2;
        const rgb = toRgb(LOGO_COLOURS[PIXEL_LOGOS[c.logo].key] ?? DEFAULT_COLOUR);

        ctx.save();
        ctx.translate(x, c.y);
        ctx.rotate(c.spin);
        ctx.globalAlpha = tier.alpha;

        // The badge: card grey with a rim tinted by the mark it holds, which is
        // exactly the token chip the real app draws next to an asset name.
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = "#1b1b1b";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${rgb},0.5)`;
        ctx.stroke();

        const sprite = sprites[c.logo];
        if (sprite) {
          const inner = tier.size * 0.66;
          ctx.drawImage(sprite, -inner / 2, -inner / 2, inner, inner);
        }

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

    // rAF is already throttled in a hidden tab, but not in every browser and
    // not when the window is merely occluded. Stopping outright is free to undo.
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
