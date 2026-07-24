"use client";

import { useAccount } from "wagmi";
import { useMounted } from "@/hooks/useMounted";
import { formatUsdg, usePositionBreakdown, useVault } from "@/hooks/useVault";
import type { Strategy } from "@/lib/strategies";

interface PositionPanelProps {
  strategy: Strategy;
}

/** A status pill: a breathing lime dot when live, a still dim one when not. */
function Status({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 font-mono text-xs tracking-[0.25em] whitespace-nowrap">
      <span
        className={
          "inline-block w-2 h-2 rounded-full " +
          (on ? "bg-wire-cyan animate-earn" : "bg-wire-muted/40")
        }
      />
      <span className={on ? "text-wire-cyan" : "text-wire-muted"}>{label}</span>
    </span>
  );
}

/**
 * A looping pulse that runs the earning pipeline as lit nodes, so the card
 * reads as a live mechanism rather than a static balance: deposit splits into
 * lending and stocks, both feed value back, and it compounds.
 */
function Mechanism({ hasBasket }: { hasBasket: boolean }) {
  const stages = [
    { k: "DEPOSIT", s: "USDG" },
    { k: "AT WORK", s: hasBasket ? "LENDING + STOCKS" : "LENDING" },
    { k: "YIELD", s: "GROWS" },
    { k: "COMPOUND", s: "REPEATS" },
  ];
  return (
    <div className="mt-8 border border-wire-border bg-wire-card px-6 py-6">
      <div className="font-mono text-xs text-wire-muted tracking-[0.35em] mb-6">
        {"// HOW IT EARNS"}
      </div>
      <div className="relative">
        {/* the rail with a travelling pulse */}
        <div className="absolute left-[8%] right-[8%] top-[9px] h-px bg-wire-border">
          <span className="absolute -top-[3px] w-2 h-2 rounded-full bg-wire-cyan glow-box-cyan animate-flow" />
        </div>
        <div className="relative grid grid-cols-4 gap-2">
          {stages.map((st, i) => (
            <div key={st.k} className="flex flex-col items-center text-center">
              <span
                className={
                  "w-5 h-5 rounded-full border-2 bg-black mb-3 " +
                  (i === stages.length - 1
                    ? "border-wire-cyan glow-box-cyan"
                    : "border-wire-cyan/60")
                }
              />
              <span
                className={
                  "font-mono text-xs tracking-[0.2em] " +
                  (i === stages.length - 1
                    ? "text-wire-cyan glow-cyan"
                    : "text-wire-cyan/90")
                }
              >
                {st.k}
              </span>
              <span className="font-mono text-[10px] tracking-[0.15em] text-wire-muted mt-1">
                {st.s}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PositionPanel({ strategy }: PositionPanelProps) {
  const mounted = useMounted();
  const { isConnected } = useAccount();
  const vault = useVault(strategy.id);
  const bd = usePositionBreakdown(strategy.id);

  const live = mounted && isConnected;
  const total = vault.positionAssets;
  const totalAssets = vault.totalAssets;

  // The wallet's shares are pro-rata, so its slice of any leg is that leg times
  // the wallet's share of the whole vault.
  const slice = (part: bigint | undefined): bigint => {
    if (part === undefined || total === undefined || !totalAssets || totalAssets === 0n) {
      return 0n;
    }
    return (total * part) / totalAssets;
  };

  const header = (
    <div className="flex items-center justify-between gap-4 mb-8">
      <h2 className="font-mono text-xl md:text-2xl text-wire-cyan glow-cyan tracking-[0.3em]">
        YOUR POSITION
      </h2>
      <span className="font-mono text-xs text-wire-muted tracking-[0.25em] border border-wire-border px-3 py-1">
        {strategy.name}
      </span>
    </div>
  );

  const message =
    !live
      ? "Connect a wallet to see your balance, allocation and live value."
      : vault.address === null
        ? "This strategy has no vault deployed yet."
        : !vault.shares
          ? "No shares in this vault yet — deposit to start earning."
          : null;

  if (message) {
    return (
      <section className="border border-wire-border bg-black p-8 md:p-10">
        {header}
        <div className="border border-dashed border-wire-border px-8 py-14">
          <p className="font-mono text-sm text-wire-muted text-center leading-relaxed">
            {message}
          </p>
        </div>
        <Mechanism hasBasket={bd.hasBasket} />
      </section>
    );
  }

  const userStable = slice(bd.stableAssets);
  const userStocks = slice(bd.basketAssets);
  const userIdle = slice(bd.idle);
  const userLending = userStable > userIdle ? userStable - userIdle : 0n;

  const pctOf = (v: bigint, whole: bigint | undefined) =>
    whole && whole > 0n ? Number((v * 1000n) / whole) / 10 : 0;

  const stablePct = pctOf(userStable, total);
  const stocksPct = pctOf(userStocks, total);

  const lendingOn = userLending > 0n;
  const stocksOn = userStocks > 0n;

  return (
    <section className="border border-wire-border bg-black p-8 md:p-10">
      <div className="flex items-center justify-between gap-4 mb-8">
        <h2 className="font-mono text-xl md:text-2xl text-wire-cyan glow-cyan tracking-[0.3em]">
          YOUR POSITION
        </h2>
        <div className="flex items-center gap-3">
          <Status on label="LIVE" />
          <span className="font-mono text-xs text-wire-muted tracking-[0.25em] border border-wire-border px-3 py-1">
            {strategy.name}
          </span>
        </div>
      </div>

      {/* Total — the hero number */}
      <div className="mb-8">
        <div className="font-mono text-xs text-wire-muted tracking-[0.35em] mb-2">
          TOTAL VALUE
        </div>
        <div className="font-digits text-6xl md:text-7xl text-wire-cyan glow-cyan leading-none">
          {total === undefined ? "—" : formatUsdg(total)}
        </div>
      </div>

      {/* Allocation bar */}
      <div className="mb-10">
        <div className="flex h-6 w-full overflow-hidden border border-wire-border">
          <div
            className="bar-fill bg-wire-cyan/80 flex items-center pl-3"
            style={{ width: `${Math.max(stablePct, 8)}%` }}
          >
            <span className="font-mono text-[10px] text-black font-bold tracking-widest">
              STABLE
            </span>
          </div>
          {bd.hasBasket && (
            <div
              className="bar-fill bg-wire-purple/80 flex items-center justify-end pr-3"
              style={{ width: `${Math.max(stocksPct, 8)}%` }}
            >
              <span className="font-mono text-[10px] text-black font-bold tracking-widest">
                STOCKS
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-between font-mono text-xs text-wire-muted tracking-[0.25em] mt-2.5">
          <span className="text-wire-cyan">◆ {stablePct.toFixed(0)}% STABLE</span>
          {bd.hasBasket && (
            <span className="text-wire-purple">{stocksPct.toFixed(0)}% STOCKS ◆</span>
          )}
        </div>
      </div>

      {/* Stable leg */}
      <div className="border border-wire-border border-l-2 border-l-wire-cyan bg-wire-card px-6 py-5 mb-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="font-mono text-base text-wire-cyan tracking-[0.25em]">
            STABLE · {formatUsdg(userStable)}
          </span>
          <Status on={lendingOn} label={lendingOn ? "EARNING" : "IDLE"} />
        </div>
        <div className="space-y-3 font-mono text-sm">
          <div className="flex items-center justify-between">
            <span className="text-wire-muted tracking-wide">
              ▸ in lending <span className="text-wire-muted/60">· earns yield</span>
            </span>
            <span className="font-digits text-wire-cyan">{formatUsdg(userLending)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-wire-muted tracking-wide">
              ▸ idle{" "}
              {userIdle > 0n && (
                <span className="text-wire-muted/60">· liquidity buffer</span>
              )}
            </span>
            <span className={"font-digits " + (userIdle > 0n ? "text-wire-cyan" : "text-wire-muted")}>
              {formatUsdg(userIdle)}
            </span>
          </div>
        </div>
      </div>

      {/* Equity leg */}
      {bd.hasBasket && (
        <div className="border border-wire-border border-l-2 border-l-wire-purple bg-wire-card px-6 py-5">
          <div className="flex items-center justify-between gap-4 mb-5">
            <span className="font-mono text-base text-wire-cyan tracking-[0.25em]">
              STOCKS · {formatUsdg(userStocks)}
            </span>
            <Status on={stocksOn} label={stocksOn ? "LIVE" : "AWAITING"} />
          </div>
          <div className="space-y-3.5">
            {bd.stocks.map((s) => {
              const v = slice(s.value);
              const pct = pctOf(v, userStocks);
              const held = v > 0n;
              return (
                <div key={s.symbol} className="flex items-center gap-3">
                  <span
                    className={
                      "font-mono text-xs w-14 px-2 py-1 border text-center tracking-widest " +
                      (held
                        ? "border-wire-purple/60 text-wire-cyan"
                        : "border-wire-border text-wire-muted")
                    }
                  >
                    {s.symbol}
                  </span>
                  <div className="flex-1 h-3 bg-black border border-wire-border overflow-hidden">
                    <div
                      className="bar-fill h-full bg-wire-purple/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-digits text-sm w-20 text-right text-wire-cyan">
                    {formatUsdg(v)}
                  </span>
                  <span className="font-digits text-xs w-12 text-right text-wire-muted">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className="font-mono text-xs text-wire-muted/70 leading-relaxed mt-5 border-t border-wire-border pt-4">
            The equity leg targets an even split across these four. It shows what
            the vault holds right now, live from the chain.
          </p>
        </div>
      )}

      <Mechanism hasBasket={bd.hasBasket} />
    </section>
  );
}
