"use client";

import { useAccount } from "wagmi";
import { BrandMark } from "@/components/BrandMark";
import { useMounted } from "@/hooks/useMounted";
import { formatUsdg, usePositionBreakdown, useVault } from "@/hooks/useVault";
import type { Strategy } from "@/lib/strategies";

interface PositionPanelProps {
  strategy: Strategy;
}

/** A status pill: a live dot when on, a still grey one when not. */
function Status({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="status">
      <span className={on ? "status-dot animate-earn" : "status-dot is-off"} />
      {label}
    </span>
  );
}

/**
 * The earning pipeline as four lit nodes with a pulse travelling the rail, so
 * the card reads as a mechanism rather than a balance: deposit splits into
 * lending and stocks, both feed value back, and it compounds.
 */
function Mechanism({ hasBasket }: { hasBasket: boolean }) {
  const stages = [
    { k: "Deposit", s: "USDG" },
    { k: "At work", s: hasBasket ? "Lending + stocks" : "Lending" },
    { k: "Yield", s: "Grows" },
    { k: "Compound", s: "Repeats" },
  ];
  return (
    <div className="mech">
      <div className="ui-label">How it earns</div>
      <div className="mech-rail">
        <span className="mech-line" />
        <div className="mech-stages">
          {stages.map((st, i) => (
            <div className="mech-stage" key={st.k}>
              <span className={i === stages.length - 1 ? "mech-dot is-end" : "mech-dot"} />
              <b>{st.k}</b>
              <small>{st.s}</small>
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

  // The wallet's shares are pro-rata, so its slice of any leg is that leg
  // times the wallet's share of the whole vault.
  const slice = (part: bigint | undefined): bigint => {
    if (part === undefined || total === undefined || !totalAssets || totalAssets === 0n) {
      return 0n;
    }
    return (total * part) / totalAssets;
  };

  const head = (extra?: React.ReactNode) => (
    <div className="panel-head">
      <h2>Your position</h2>
      <div className="panel-head-side">
        {extra}
        <span className="chip">{strategy.name}</span>
      </div>
    </div>
  );

  const message = !live
    ? "Connect a wallet to see your balance, allocation and live value."
    : vault.address === null
      ? "This strategy has no vault deployed yet."
      : !vault.shares
        ? "No shares in this vault yet — deposit to start earning."
        : null;

  if (message) {
    return (
      <section className="card panel">
        {head()}
        <div className="panel-body">
          <div className="empty">{message}</div>
          <Mechanism hasBasket={bd.hasBasket} />
        </div>
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
    <section className="card panel">
      {head(<Status on label="Live" />)}

      <div className="panel-body">
        <div className="position-total">
          <div className="ui-label">Total value</div>
          <div className="figure position-figure">
            {total === undefined ? "—" : formatUsdg(total)}
          </div>
        </div>

        <div className="alloc">
          <div className="alloc-bar">
            <span className="alloc-stable" style={{ width: `${Math.max(stablePct, 8)}%` }}>
              Stable
            </span>
            {bd.hasBasket && (
              <span className="alloc-stocks" style={{ width: `${Math.max(stocksPct, 8)}%` }}>
                Stocks
              </span>
            )}
          </div>
          <div className="alloc-legend">
            <span>{stablePct.toFixed(0)}% stable</span>
            {bd.hasBasket && <span>{stocksPct.toFixed(0)}% stocks</span>}
          </div>
        </div>

        <div className="leg-block">
          <div className="leg-head">
            <span className="leg-title">Stable · {formatUsdg(userStable)}</span>
            <Status on={lendingOn} label={lendingOn ? "Earning" : "Idle"} />
          </div>
          <dl className="rows">
            <div>
              <dt>In lending</dt>
              <dd className="figure">{formatUsdg(userLending)}</dd>
            </div>
            <div>
              <dt>Idle{userIdle > 0n ? " · liquidity buffer" : ""}</dt>
              <dd className="figure">{formatUsdg(userIdle)}</dd>
            </div>
          </dl>
        </div>

        {bd.hasBasket && (
          <div className="leg-block">
            <div className="leg-head">
              <span className="leg-title">Stocks · {formatUsdg(userStocks)}</span>
              <Status on={stocksOn} label={stocksOn ? "Live" : "Awaiting"} />
            </div>
            <div className="stock-rows">
              {bd.stocks.map((s) => {
                const v = slice(s.value);
                const pct = pctOf(v, userStocks);
                return (
                  <div className="stock-row" key={s.symbol}>
                    {/* The mark beside the ticker, as everywhere else holdings
                        are listed. At four rows the tickers alone were enough
                        to scan; at eight the column reads as a wall of
                        four-letter words without them. */}
                    <span className="stock-mark">
                      <BrandMark sym={s.symbol} size={15} />
                    </span>
                    <span className="chip stock-sym">{s.symbol}</span>
                    <span className="stock-bar">
                      <i style={{ width: `${pct}%` }} />
                    </span>
                    <span className="figure stock-value">{formatUsdg(v)}</span>
                    <span className="figure stock-pct">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
            <p className="leg-note">
              {/* Counted from what the chain returned, not written down. The
                  rows themselves already come from the adapter's holdings, so
                  a hardcoded "these four" was the one part of this block that
                  could disagree with the list directly above it. */}
              The equity leg targets an even split across these {bd.stocks.length}. It
              shows what the vault holds right now, live from the chain.
            </p>
          </div>
        )}

        <Mechanism hasBasket={bd.hasBasket} />
      </div>
    </section>
  );
}
