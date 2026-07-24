"use client";

import { useEffect } from "react";

/* Single-cell glyphs only, so the monospace grid never shifts as text turns to
   code. Box-drawing + symbols read as "matrix rain". */
const GLYPHS = "01<>/\\|=+*#%&$¥┐└┘├┤┬┴┼─│╬╠╣═║╗╝╚╔▓▒░█";
const GLEN = GLYPHS.length;
const BLOCKED = new Set(["NAV", "A", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "SCRIPT", "STYLE", "SVG"]);

/**
 * Scroll-driven "matrix" dissolve across the whole page. Each run of text is
 * crisp near the centre of the viewport and turns to glyphs as it drifts toward
 * either edge, so scrolling assembles text out of code and back.
 *
 * Built for speed: it mutates text-node values directly — never React state, so
 * there is no re-render — and only touches nodes near the viewport, only while
 * scrolling. Glyphs are a deterministic function of scroll position, so the
 * page is frozen (zero work) at rest and only animates under the scroll.
 * Structure is untouched: only `Text` node values change, so nested markup,
 * links and inputs are left alone. Honours prefers-reduced-motion.
 */
export function MatrixScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.querySelector("main");
    if (!main) return;

    const orig = new WeakMap<Text, string>();
    const THRESH = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const s = Math.sin(i * 12.9898) * 43758.5453;
      THRESH[i] = s - Math.floor(s);
    }

    type Item = { node: Text; parent: HTMLElement; text: string; cy: number; clean: boolean; bucket: number };
    let items: Item[] = [];

    const qualifies = (node: Text): boolean => {
      const v = node.nodeValue;
      if (!v || v.trim().length < 2) return false;
      let el = node.parentElement;
      if (!el || el.closest("[data-no-matrix],.animate-marquee")) return false;
      while (el && el !== main) {
        if (BLOCKED.has(el.tagName)) return false;
        el = el.parentElement;
      }
      return true;
    };

    // Walk the page for text runs and cache each one's absolute vertical centre.
    // Scramble keeps length and whitespace, so positions do not shift and this
    // only has to run on layout changes, never on scroll.
    const collect = () => {
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      const sy = window.scrollY;
      const next: Item[] = [];
      let n = walker.nextNode() as Text | null;
      while (n) {
        if (qualifies(n)) {
          if (!orig.has(n)) orig.set(n, n.nodeValue as string);
          const text = orig.get(n) as string;
          range.selectNodeContents(n);
          const r = range.getBoundingClientRect();
          next.push({
            node: n,
            parent: n.parentElement as HTMLElement,
            text,
            cy: r.top + sy + r.height / 2,
            clean: n.nodeValue === text,
            bucket: -1,
          });
        }
        n = walker.nextNode() as Text | null;
      }
      items = next;
    };

    const sync = (it: Item) => {
      // Keep the .glitch layers (content: attr(data-text)) in step with the pre.
      if (it.parent.hasAttribute("data-text")) it.parent.setAttribute("data-text", it.node.nodeValue as string);
    };
    const restore = (it: Item) => {
      it.bucket = -1;
      if (it.clean) return;
      it.node.nodeValue = it.text;
      sync(it);
      it.clean = true;
    };

    // Matrix only in a thin strip at the very top and bottom of the viewport;
    // the middle ~94% stays crisp. A thin band means only a run or two is ever
    // mid-dissolve, which is what keeps this cheap.
    const EDGE = 0.94;
    const SPAN = 1 - EDGE;

    // The BLUR logo gets a light scroll parallax — transform + opacity only, so
    // it stays on the compositor (no text mutation, no layout) and cannot lag.
    const heroLogo = main.querySelector<HTMLElement>("[data-hero-logo]");

    const apply = () => {
      const vh = window.innerHeight;
      const half = vh / 2;
      const scrollY = window.scrollY;
      const center = scrollY + half;
      // Only runs inside the viewport can be in the strip; skip everything else.
      const lo = scrollY - 40;
      const hi = scrollY + vh + 40;

      if (heroLogo) {
        let hp = scrollY / (vh * 0.6);
        if (hp > 1) hp = 1;
        heroLogo.style.transform = `translateY(${(-34 * hp).toFixed(1)}px) scale(${(1 - 0.05 * hp).toFixed(3)})`;
        heroLogo.style.opacity = (1 - 0.65 * hp).toFixed(3);
      }

      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        if (it.cy < lo || it.cy > hi) {
          restore(it);
          continue;
        }
        const d = Math.abs(it.cy - center) / half; // 0 at centre .. 1 at edge
        if (d <= EDGE) {
          restore(it);
          continue;
        }
        let p = (d - EDGE) / SPAN;
        if (p > 1) p = 1;
        const bucket = (p * 22) | 0; // evolves with scroll, fixed at rest
        // Skip the rewrite when the glyph frame has not changed -- the single
        // biggest saving, since text mutation forces reshaping and paint.
        if (bucket === it.bucket) continue;
        it.bucket = bucket;

        const src = it.text;
        let out = "";
        for (let i = 0; i < src.length; i++) {
          const cc = src.charCodeAt(i);
          if (cc === 32 || cc === 10 || cc === 9) {
            out += src[i];
          } else if (p >= THRESH[i & 511]) {
            out += GLYPHS[((i * 31 + bucket * 17) >>> 0) % GLEN];
          } else {
            out += src[i];
          }
        }
        it.node.nodeValue = out;
        sync(it);
        it.clean = false;
      }
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        apply();
      });
    };
    const onResize = () => {
      collect();
      apply();
    };

    collect();
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // Late layout (font load, boot lines, live data) shifts positions; re-measure
    // occasionally rather than on every scroll frame.
    const timer = window.setInterval(() => {
      collect();
      apply();
    }, 4000);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      clearInterval(timer);
      for (const it of items) if (it.node.isConnected) restore(it);
    };
  }, []);

  return null;
}
