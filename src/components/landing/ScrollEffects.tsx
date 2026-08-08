"use client";

import { useEffect, useRef } from "react";

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Every scroll-driven effect on the landing page, in one handler.
 *
 * Ported from FrogPools, which runs the lot from a single rAF-throttled
 * listener rather than one observer per effect. That is worth keeping: each of
 * these reads layout, and reading layout from five separate callbacks in the
 * same frame is five forced reflows instead of one.
 *
 * What it drives:
 *   · the fixed progress bar across the top
 *   · the nav's flip to its over-a-dark-band state, driven by [data-nav="over"]
 *   · parallax on anything carrying [data-par]
 *   · the community section's two counter-drifting columns
 *   · the how-it-works staircase — cards start offset and rise into line
 *   · the reveal observer, and the stagger it writes onto grouped cells
 *   · #page's bottom margin, which is what gives the fixed footer somewhere to
 *     be uncovered from
 *   · play/pause for the hero video, so it never decodes off-screen
 */
export function ScrollEffects() {
  const progRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const prog = progRef.current;
    const nav = document.querySelector<HTMLElement>(".nav");
    const pars = Array.from(document.querySelectorAll<HTMLElement>("[data-par]")).map(
      (el) => ({ el, sp: parseFloat(el.dataset.par ?? "0") }),
    );
    const comm = document.getElementById("community");
    const cL = document.getElementById("cmyL");
    const cR = document.getElementById("cmyR");
    const stepsWrap = document.getElementById("steps");
    const stepEls = stepsWrap
      ? Array.from(stepsWrap.querySelectorAll<HTMLElement>(".step"))
      : [];
    const overSecs = Array.from(document.querySelectorAll<HTMLElement>('[data-nav="over"]'));

    let ticking = false;

    function upd() {
      const st = window.scrollY || 0;
      const wh = window.innerHeight;
      const dh = document.documentElement.scrollHeight - wh;

      if (prog) prog.style.width = (dh > 0 ? (st / dh) * 100 : 0).toFixed(2) + "%";

      if (nav) {
        nav.classList.toggle("scrolled", st > 8);
        const navH = nav.offsetHeight || 74;
        // Measured at 60% of the nav's own height rather than at its top edge:
        // the flip should happen when the band is behind the wordmark, not when
        // its first pixel slides under the bar.
        let over = false;
        overSecs.forEach((s) => {
          const r = s.getBoundingClientRect();
          if (r.top <= navH * 0.6 && r.bottom >= navH * 0.6) over = true;
        });
        nav.classList.toggle("nav-over", over);
      }

      pars.forEach((o) => {
        const r = o.el.getBoundingClientRect();
        const c = r.top + r.height / 2 - wh / 2;
        o.el.style.transform = `translate3d(0,${(c * o.sp).toFixed(1)}px,0)`;
      });

      if (comm && cL && cR) {
        const cr = comm.getBoundingClientRect();
        const tot = comm.offsetHeight - wh;
        const cp = clamp(-cr.top / (tot || 1), 0, 1);
        const rng = wh * 0.95;
        // The right column travels further and starts offset, so the two
        // never read as one block sliding.
        cL.style.transform = `translateY(${((0.5 - cp) * rng).toFixed(1)}px)`;
        cR.style.transform = `translateY(${((0.5 - cp) * rng * 1.18 - 30).toFixed(1)}px)`;
      }

      if (stepsWrap && stepEls.length) {
        const r = stepsWrap.getBoundingClientRect();
        const p = 1 - clamp((r.top - wh * 0.15) / (wh * 0.7), 0, 1);
        stepEls.forEach((el, i) => {
          el.style.transform = `translateY(${(i * 70 * (1 - p)).toFixed(1)}px)`;
          el.style.opacity = (0.25 + 0.75 * p).toFixed(2);
        });
      }

      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(upd);
      }
    }

    // Stagger grouped cells before the reveal observer picks them up, so a row
    // of six resolves left to right instead of all at once.
    document.querySelectorAll<HTMLElement>("[data-stagger]").forEach((group) => {
      const step = parseInt(group.dataset.stagger ?? "70", 10);
      Array.from(group.children).forEach((child, i) => {
        const el = child as HTMLElement;
        el.classList.add("reveal");
        el.style.setProperty("--d", i * step + "ms");
      });
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    // The footer is fixed at z-0 behind #page. Without this the page ends where
    // its content ends and there is nothing to scroll down into.
    function fit() {
      const pg = document.getElementById("page");
      const ft = document.getElementById("bigfoot");
      if (pg && ft) pg.style.marginBottom = ft.offsetHeight + "px";
    }

    const lazyVids = Array.from(
      document.querySelectorAll<HTMLVideoElement>("video[data-lazyvideo]"),
    );
    const vio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) {
            const p = v.play();
            if (p?.catch) p.catch(() => {});
          } else {
            try {
              v.pause();
            } catch {
              /* pause can throw while the media is still loading */
            }
          }
        });
      },
      { threshold: 0.2 },
    );
    lazyVids.forEach((v) => vio.observe(v));

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", upd);
    window.addEventListener("resize", fit);
    window.addEventListener("load", fit);
    upd();
    fit();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", upd);
      window.removeEventListener("resize", fit);
      window.removeEventListener("load", fit);
      io.disconnect();
      vio.disconnect();
    };
  }, []);

  return (
    <div className="scrollprog">
      <i ref={progRef} />
    </div>
  );
}
