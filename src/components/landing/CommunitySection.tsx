"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ArrowRightIcon } from "@/components/icons";
import { PIXEL_LOGOS } from "@/lib/pixel-logos";
import type { FeedItem, FeedResponse } from "@/types/feed";

/** The tickers a feed row can be matched against. */
const SYMBOLS = PIXEL_LOGOS.map((l) => l.key);

/**
 * Cards shown before the feed answers, and if it never does.
 *
 * Not placeholders pretending to be data — they are the vault's own targets,
 * which are true regardless of what the chain says. The alternative was
 * inventing prices, and a column of invented prices on a page arguing that
 * everything here is checkable would be the worst possible thing to ship.
 */
const RESTING: MiniData[] = [
  { sym: "NVDA", name: "NVIDIA", meta: "Basket holding", note: "10%" },
  { sym: "AAPL", name: "Apple", meta: "Basket holding", note: "10%" },
  { sym: "TSLA", name: "Tesla", meta: "Basket holding", note: "10%" },
  { sym: "AMZN", name: "Amazon", meta: "Basket holding", note: "10%" },
  { sym: null, name: "Lending leg", meta: "USDG supplied", note: "60%" },
  { sym: null, name: "Rebalance", meta: "On drift", note: "auto" },
];

interface MiniData {
  sym: string | null;
  name: string;
  meta: string;
  note: string;
  direction?: "up" | "down";
}

function MiniCard({ item }: { item: MiniData }) {
  return (
    <div className="mini">
      <div className="av">
        {item.sym ? (
          <BrandMark sym={item.sym} size={19} />
        ) : (
          <span className="av-dot" />
        )}
      </div>
      <div className="in">
        <b>{item.name}</b>
        <small>{item.meta}</small>
      </div>
      <div className={`chg ${item.direction ?? ""}`.trim()}>{item.note}</div>
    </div>
  );
}

/** A feed row rendered as a ticker card. */
function toMini(item: FeedItem): MiniData {
  const sym = SYMBOLS.find((k) => item.subject.includes(k)) ?? null;
  return {
    sym,
    name: item.subject,
    meta: item.detail ?? item.kind,
    note: item.value,
  };
}

/**
 * The closing section: 220vh tall with a 100vh sticky track, so the centre
 * copy stays pinned while the two side columns drift past it in opposite
 * directions. <ScrollEffects /> drives the columns off scroll progress through
 * the section, and `data-nav="over"` is what flips the nav white here.
 *
 * The columns show whatever the chain last returned. Until it answers they
 * show the vault's targets instead of a spinner, because a column of skeletons
 * either side of a headline is worse than a column of true statements.
 */
export function CommunitySection() {
  const [items, setItems] = useState<MiniData[]>(RESTING);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/feed", { cache: "no-store" });
        if (!res.ok) return;
        const data: FeedResponse = await res.json();
        if (!alive || !data.items.length) return;
        setItems(data.items.slice(0, 10).map(toMini));
      } catch {
        /* offline, or the chain is unreachable — the resting cards stand. */
      }
    };
    load();
    // The route caches for 12s, so polling faster only burns requests.
    const poll = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, []);

  // Split into two columns, and pad the short one so neither runs out of cards
  // mid-drift and leaves a gap the height of the viewport.
  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);
  const fill = (col: MiniData[]) =>
    col.length >= 4 ? col : [...col, ...RESTING].slice(0, 4);

  return (
    <section className="community" id="community" data-nav="over">
      <div className="cmy-track">
        <div className="cmy-bg" data-par="-0.05" />

        <div className="cmy-col l" id="cmyL">
          {fill(left).map((item, i) => (
            <MiniCard item={item} key={`l-${item.name}-${i}`} />
          ))}
        </div>

        <div className="cmy-col r" id="cmyR">
          {fill(right).map((item, i) => (
            <MiniCard item={item} key={`r-${item.name}-${i}`} />
          ))}
        </div>

        <div className="cmy-inner reveal">
          <span className="eyebrow">[ Live on-chain ]</span>
          <h2>Put your idle stablecoin to work.</h2>
          <p>
            One deposit, a real yield floor, and a basket that holds its shape without
            you. Everything on this page is read from the contracts — go and check it.
          </p>
          <div className="cmy-cta">
            <Link className="btn btn-primary" href="/app">
              <span className="lbl">Open the app</span>
              <span className="arw">
                <ArrowRightIcon />
              </span>
            </Link>
            <Link className="btn btn-ghost" href="/docs">
              <span className="lbl">Read the docs</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
