"use client";

import { useEffect, useState } from "react";
import { HERO_NOTE, HERO_SLIDES, type TextSegment } from "@/lib/landing";

const SLIDE_INTERVAL_MS = 2800;

function Line({ segments }: { segments: TextSegment[] }) {
  return (
    <span className="ln">
      {segments.map((seg, i) =>
        seg.highlight ? (
          <span className="g" key={i}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

/**
 * Full-bleed hero: looping footage under a green wash, with three headlines
 * crossfading over it.
 *
 * `data-nav="over"` is what tips the nav into its white state — <ScrollEffects />
 * looks for exactly that attribute. This is the only saturated band above the
 * fold, so the nav's flip back to paper glass on scroll is the page's first
 * piece of feedback.
 *
 * All three slides are mounted at once and cross-faded on opacity/visibility
 * rather than swapped: swapping would reflow the block on every tick, and the
 * headline is the tallest thing on the fold.
 */
export function Hero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % HERO_SLIDES.length),
      SLIDE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <header className="hero" id="top" data-nav="over">
      <video
        className="hero-video"
        muted
        loop
        playsInline
        preload="metadata"
        poster="/images/hero-poster.jpg"
        data-lazyvideo
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>
      <div className="hero-tint" />
      <div className="hero-scrim" />
      <div className="hero-fade" />

      <div className="hero-inner wrap">
        <div className="hero-slides">
          {HERO_SLIDES.map((slide, i) => (
            <div className={`hero-slide${i === active ? " on" : ""}`} key={i}>
              <Line segments={slide.lineOne} />
              <Line segments={slide.lineTwo} />
            </div>
          ))}
        </div>
      </div>

      <div className="hero-corners">
        <div className="ai-note">
          <div className="k">{HERO_NOTE.eyebrow}</div>
          <p>{HERO_NOTE.body}</p>
        </div>
        <div className="scrolldisc">
          Scroll to discover <span className="arr">↓</span>
        </div>
      </div>
    </header>
  );
}
