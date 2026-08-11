"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ArrowRightIcon } from "@/components/icons";
import { StrategyGlyph } from "@/components/StrategyGlyph";
import { BASKET_STOCKS } from "@/lib/chain";
import { STRATEGIES, type StrategyId } from "@/lib/strategies";
import type { FeedItem, FeedResponse } from "@/types/feed";

/**
 * The tickers a feed row can be matched against.
 *
 * USDG is in here beside the four stocks because the lending rows name it —
 * "steakUSDG" contains it, which is what the substring match below is for.
 */
const SYMBOLS = [...BASKET_STOCKS.map((s) => s.symbol), "USDG"];

/**
 * Cards shown before the feed answers, and if it never does.
 *
 * Not placeholders pretending to be data — they are the vault's own targets,
 * which are true regardless of what the chain says. The alternative was
 * inventing prices, and a column of invented prices on a page arguing that
 * everything here is checkable would be the worst possible thing to ship.
 */
const BALANCED = STRATEGIES.find((s) => s.id === "balanced")!;

/* Company names for the tickers, so a card can say "NVIDIA" rather than
   "NVDA". Anything missing here falls back to its ticker, which is correct
   rather than blank. */
const COMPANY: Record<string, string> = {
  NVDA: "NVIDIA",
  AAPL: "Apple",
  TSLA: "Tesla",
  AMZN: "Amazon",
  GOOGL: "Alphabet",
  MSFT: "Microsoft",
  SPCX: "SpaceX",
  PLTR: "Palantir",
};

/* Weights are computed, not typed. These rows read "10%" each while the basket
   held four names; the same four literals beside eight holdings would have
   been a set of numbers that no longer add up to the leg they belong to. */
const PER_STOCK = `${Math.round((BALANCED.stockPct / BASKET_STOCKS.length) * 10) / 10}%`;

const RESTING: MiniData[] = [
  ...BASKET_STOCKS.map(({ symbol }) => ({
    sym: symbol,
    name: COMPANY[symbol] ?? symbol,
    meta: "Basket holding",
    note: PER_STOCK,
  })),
  { sym: "USDG", name: "Lending leg", meta: "USDG supplied", note: `${BALANCED.stablePct}%` },
  { sym: null, name: "Rebalance", meta: "On drift", note: "auto" },
];

interface MiniData {
  sym: string | null;
  /** Set instead of `sym` when the row is about a vault rather than a token. */
  strategy?: StrategyId;
  name: string;
  meta: string;
  note: string;
  direction?: "up" | "down";
}

/**
 * The well takes whichever mark the row has: a token gets its brand mask, a
 * vault gets the same wander line the launchpad and the app's picker draw for
 * it, and anything else falls back to the dot. Three rows in a column that all
 * said "●" were three rows you could not tell apart at a glance.
 */
function MiniCard({ item }: { item: MiniData }) {
  return (
    <div className="mini">
      <div className="av">
        {item.strategy ? (
          <StrategyGlyph id={item.strategy} />
        ) : item.sym ? (
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

/**
 * A feed row rendered as a ticker card.
 *
 * Strategies are matched before tickers, not after: the vault rows arrive as
 * "STEADY", "BALANCED", "GROWTH", and a later ticker match on the same string
 * would be a coincidence rather than a holding.
 */
function toMini(item: FeedItem): MiniData {
  const subject = item.subject.toUpperCase();
  const strategy = STRATEGIES.find((s) => subject === s.name.toUpperCase());
  return {
    sym: strategy ? null : (SYMBOLS.find((k) => subject.includes(k)) ?? null),
    strategy: strategy?.id,
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
        /* Take the whole read, not a fixed ten. The feed is steakUSDG, one
           row per deployed vault and one per priced holding, so the count
           moves with the basket — at ten the last two holdings fell off the
           end and the columns showed six of the eight. */
        setItems(data.items.map(toMini));
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
