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
    <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] whitespace-nowrap">
      <span
        className={
          "inline-block w-1.5 h-1.5 rounded-full " +
          (on ? "bg-wire-cyan animate-earn" : "bg-wire-muted/40")
        }
      />
      <span className={on ? "text-wire-cyan" : "text-wire-muted"}>{label}</span>
    </span>
  );
}

/**
 * A looping pulse that runs along the earning pipeline, so the card reads as a
 * live mechanism rather than a static balance: deposit splits into lending and
 * stocks, both feed value back, and it compounds.
 */
function Mechanism({ hasBasket }: { hasBasket: boolean }) {
  const stages = [
    "USDG",
    hasBasket ? "LENDING + STOCKS" : "LENDING",
    "YIELD",
    "COMPOUND",
  ];
  return (
    <div className="mt-7 border border-wire-border bg-wire-card px-5 py-5">
      <div className="font-mono text-[11px] text-wire-muted tracking-[0.3em] mb-4">
        {"// HOW IT EARNS"}
      </div>
      <div className="relative h-px bg-wire-border my-3">
        <span className="absolute -top-[3px] w-1.5 h-1.5 rounded-full bg-wire-cyan glow-box-cyan animate-flow" />
      </div>
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] sm:text-[11px] tracking-[0.15em] text-wire-cyan/80">
        {stages.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className={i === stages.length - 1 ? "text-wire-cyan glow-cyan" : ""}>
              {s}
            </span>
            {i < stages.length - 1 && <span className="text-wire-border">▶</span>}
          </span>
        ))}
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
    <div className="flex items-baseline justify-between gap-4 mb-6">
      <h2 className="font-mono text-lg text-wire-cyan glow-cyan tracking-[0.3em]">
        YOUR POSITION
      </h2>
      <span className="font-mono text-xs text-wire-muted tracking-[0.2em]">
        {strategy.name}
      </span>
    </div>
  );

  // States that carry no live breakdown fall back to a plain line.
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
      <section className="border border-wire-border bg-black p-7 md:p-9">
        {header}
        <div className="border border-dashed border-wire-border px-8 py-12">
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

  const stablePct = total && total > 0n ? Number((userStable * 1000n) / total) / 10 : 0;
  const stocksPct = total && total > 0n ? Number((userStocks * 1000n) / total) / 10 : 0;

  const lendingOn = userLending > 0n;
  const stocksOn = userStocks > 0n;

  return (
    <section className="border border-wire-border bg-black p-7 md:p-9">
      {header}

      {/* Total */}
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <span className="font-mono text-xs text-wire-muted tracking-[0.25em]">
          TOTAL VALUE
        </span>
        <span className="font-mono text-3xl md:text-4xl text-wire-cyan glow-cyan">
          {total === undefined ? "—" : formatUsdg(total)}
        </span>
      </div>

      {/* Allocation bar */}
      <div className="flex h-3 w-full overflow-hidden border border-wire-border mb-2">
        <div
          className="bar-fill bg-wire-cyan/70"
          style={{ width: `${stablePct}%` }}
          title={`Stable ${stablePct.toFixed(0)}%`}
        />
        <div
          className="bar-fill bg-wire-purple/70"
          style={{ width: `${stocksPct}%` }}
          title={`Stocks ${stocksPct.toFixed(0)}%`}
        />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-wire-muted tracking-[0.2em] mb-7">
        <span>◆ STABLE {stablePct.toFixed(0)}%</span>
        {bd.hasBasket && <span>STOCKS {stocksPct.toFixed(0)}% ◆</span>}
      </div>

      {/* Stable leg */}
      <div className="border border-wire-border bg-wire-card px-5 py-4 mb-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <span className="font-mono text-sm text-wire-cyan tracking-[0.2em]">
            STABLE · {formatUsdg(userStable)}
          </span>
          <Status on={lendingOn} label={lendingOn ? "EARNING" : "IDLE"} />
        </div>
        <div className="space-y-1.5 font-mono text-xs">
          <div className="flex justify-between text-wire-muted">
            <span>in lending (earns yield)</span>
            <span className="text-wire-cyan">{formatUsdg(userLending)}</span>
          </div>
          <div className="flex justify-between text-wire-muted">
            <span>idle {userIdle > 0n ? "· awaiting the keeper" : ""}</span>
            <span className={userIdle > 0n ? "text-wire-cyan" : "text-wire-muted"}>
              {formatUsdg(userIdle)}
            </span>
          </div>
        </div>
      </div>

      {/* Equity leg */}
      {bd.hasBasket && (
        <div className="border border-wire-border bg-wire-card px-5 py-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <span className="font-mono text-sm text-wire-cyan tracking-[0.2em]">
              STOCKS · {formatUsdg(userStocks)}
            </span>
            <Status on={stocksOn} label={stocksOn ? "LIVE" : "AWAITING"} />
          </div>
          <div className="space-y-2 font-mono text-xs">
            {bd.stocks.map((s) => {
              const v = slice(s.value);
              const pct =
                userStocks > 0n ? Number((v * 1000n) / userStocks) / 10 : 0;
              return (
                <div key={s.symbol} className="flex items-center gap-3">
                  <span className="w-12 text-wire-cyan">{s.symbol}</span>
                  <div className="flex-1 h-2 bg-black border border-wire-border overflow-hidden">
                    <div
                      className="bar-fill h-full bg-wire-purple/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-wire-muted">
                    {formatUsdg(v)}
                  </span>
                  <span className="w-10 text-right text-wire-muted/70">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className="font-mono text-[11px] text-wire-muted/70 leading-relaxed mt-3">
            Target is 25% each; the keeper spreads into them over time. What you
            see is what the vault holds right now.
          </p>
        </div>
      )}

      <Mechanism hasBasket={bd.hasBasket} />
    </section>
  );
}
