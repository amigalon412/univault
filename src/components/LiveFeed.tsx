"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedItem, FeedKind, FeedResponse, FeedStats } from "@/types/feed";

interface KindMeta {
  label: string;
  cls: string;
  arrow: string;
}

const KIND_MAP: Record<FeedKind, KindMeta> = {
  price: { label: "Price", cls: "bg-wire-cyan/12 text-wire-cyan", arrow: "◆" },
  yield: { label: "Yield", cls: "bg-wire-green/12 text-wire-green", arrow: "⟳" },
  vault: { label: "Vault", cls: "bg-wire-purple/12 text-wire-purple", arrow: "▲" },
};

function timeAgo(ts: number): string {
  const t = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (t < 60) return `${t}s`;
  if (t < 3600) return `${Math.floor(t / 60)}m`;
  if (t < 86400) return `${Math.floor(t / 3600)}h`;
  return `${Math.floor(t / 86400)}d`;
}

const EMPTY_STATS: FeedStats = {
  blockNumber: 0,
  tvlUsd: null,
  vaultsDeployed: 0,
};

export function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<FeedStats>(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/feed", { cache: "no-store" });
        if (!res.ok) return;
        const data: FeedResponse = await res.json();
        if (!alive) return;
        const fresh = new Set<string>();
        for (const item of data.items) {
          if (!seen.current.has(item.id)) {
            fresh.add(item.id);
            seen.current.add(item.id);
          }
        }
        if (seen.current.size > fresh.size && fresh.size) {
          setHighlight(fresh);
          setTimeout(() => {
            if (alive) setHighlight(new Set());
          }, 2000);
        }
        setItems(data.items);
        setStats(data.stats);
        setLoaded(true);
      } catch {}
    };
    load();
    // The route caches for 12s, so polling faster only burns requests.
    const poll = setInterval(load, 15000);
    const ticker = setInterval(() => {
      if (alive) setTick((t) => t + 1);
    }, 15000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, []);

  return (
    <section id="feed" className="px-4 sm:px-6 md:px-8 pb-20 scroll-mt-16">
      <div className="max-w-5xl mx-auto uni-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-b border-wire-border">
          <span className="text-sm font-semibold text-white truncate">
            Live on-chain activity
          </span>
          <div className="flex items-center gap-5 shrink-0">
            <span className="hidden md:inline text-xs text-wire-muted">
              {stats.blockNumber > 0
                ? `Block ${stats.blockNumber.toLocaleString()}`
                : "Connecting"}
              {stats.tvlUsd === null
                ? " · no vaults deployed"
                : ` · $${Math.round(stats.tvlUsd).toLocaleString()} TVL`}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-wire-cyan">
              <span className="w-1.5 h-1.5 rounded-full bg-wire-cyan animate-blink" />
              Live
            </span>
          </div>
        </div>
        <div className="px-3 sm:px-5 py-3 text-sm max-h-[440px] overflow-y-auto">
          {!loaded ? (
            <div className="text-wire-muted py-10 text-center text-sm">
              Reading Robinhood Chain…
            </div>
          ) : items.length === 0 ? (
            <div className="text-wire-muted py-10 text-center space-y-2">
              <div className="text-white font-medium">Chain unreachable</div>
              <div className="text-xs">
                Nothing is shown here that was not just read from the chain, so
                nothing is shown.
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {items.map((item) => {
                const kind = KIND_MAP[item.kind];
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors${
                      highlight.has(item.id) ? " bg-wire-cyan/8" : " hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className="text-wire-muted/60 shrink-0 w-9 text-right text-xs font-digits">
                      {timeAgo(item.ts)}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${kind.cls}`}
                    >
                      {kind.label}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-sm">
                      <span className="text-white font-medium">{item.subject}</span>
                      <span className="text-wire-muted"> · </span>
                      <span className="text-wire-cyan font-digits">{item.value}</span>
                      {item.detail && (
                        <span className="text-wire-muted"> · {item.detail}</span>
                      )}
                    </span>
                    <a
                      href={item.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-wire-muted/60 hover:text-wire-cyan hidden sm:inline shrink-0"
                      title="View the contract this was read from"
                    >
                      {item.linkShort} ↗
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
