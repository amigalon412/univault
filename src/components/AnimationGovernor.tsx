"use client";

import { useEffect } from "react";

/**
 * Stops the page's endless animations from running when nobody can see them.
 *
 * Measured on the homepage: six infinite CSS animations (the glitch layers,
 * flicker, blink, marquee) keep running at full rate when scrolled completely
 * off-screen, and keep running in a background tab. None of that work is
 * visible to anyone; it just keeps the compositor awake forever, on every open
 * tab, which is what pins a CPU.
 *
 * Driven off the Web Animations API rather than a list of class names, so it
 * governs every infinite animation on the page including ones added later --
 * there is no selector list to keep in sync with the CSS. Finite animations
 * (page-in, reveal) are left alone: they end on their own.
 */
export function AnimationGovernor() {
  useEffect(() => {
    if (typeof document.getAnimations !== "function") return;

    const isEndless = (a: Animation) =>
      a.effect?.getTiming().iterations === Infinity;

    const setPaused = (el: Element, paused: boolean) => {
      for (const a of el.getAnimations({ subtree: true })) {
        if (!isEndless(a)) continue;
        if (paused) a.pause();
        else a.play();
      }
    };

    const MARGIN = 200;
    const onScreen = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.bottom > -MARGIN && r.top < window.innerHeight + MARGIN;
    };

    const observed = new Set<Element>();

    /* Re-evaluated from geometry rather than from the observer, because an
       IntersectionObserver only fires when intersection *changes*. Coming back
       from a background tab is not a change, so resuming has to be driven from
       here -- otherwise everything stays frozen for good once you switch away. */
    const settle = () => {
      const hidden = document.hidden;
      for (const el of observed) setPaused(el, hidden || !onScreen(el));
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (document.hidden) return;
        for (const entry of entries) setPaused(entry.target, !entry.isIntersecting);
      },
      { rootMargin: `${MARGIN}px` },
    );

    const rescan = () => {
      for (const a of document.getAnimations()) {
        if (!isEndless(a)) continue;
        const target = (a.effect as KeyframeEffect | null)?.target;
        if (target instanceof Element && !observed.has(target)) {
          observed.add(target);
          io.observe(target);
        }
      }
      settle();
    };

    // Rescan a few times rather than continuously: animations appear as fonts
    // load, the boot lines finish and the live feed mounts, all within the
    // first few seconds, and nothing adds any after that.
    rescan();
    const passes = [400, 1500, 4000].map((ms) => window.setTimeout(rescan, ms));

    const onVisibility = () => settle();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      passes.forEach(clearTimeout);
      io.disconnect();
      // Leave nothing paused behind us.
      for (const a of document.getAnimations()) if (isEndless(a)) a.play();
    };
  }, []);

  return null;
}
