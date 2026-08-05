"use client";

import { formatUsdg } from "@/hooks/useVault";
import { STRATEGIES, type StrategyId } from "@/lib/strategies";

interface StrategyPickerProps {
  selected: StrategyId;
  onSelect: (id: StrategyId) => void;
  /** Live TVL per vault. A strategy missing from the map has no deployment. */
  tvl: Partial<Record<StrategyId, bigint>>;
}

export function StrategyPicker({ selected, onSelect, tvl }: StrategyPickerProps) {
  return (
    <section className="uni-card p-5 sm:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-lg font-semibold text-white">Select strategy</h2>
        <span className="text-xs text-wire-muted">3 vaults</span>
      </div>
      <div className="space-y-3">
        {STRATEGIES.map((s) => {
          const active = s.id === selected;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              aria-pressed={active}
              className={
                "w-full text-left rounded-2xl p-5 sm:p-6 border transition-colors group " +
                (active
                  ? "border-wire-cyan/50 bg-wire-cyan/[0.06]"
                  : "border-wire-border bg-white/[0.02] hover:bg-white/[0.05]")
              }
            >
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <span
                  className={
                    "text-xl font-semibold transition-colors " +
                    (active ? "text-wire-cyan" : "text-white")
                  }
                >
                  {s.name}
                </span>
                <span
                  className={
                    "font-digits text-2xl font-semibold whitespace-nowrap " +
                    (active ? "text-wire-cyan" : "text-white")
                  }
                >
                  {s.split}
                </span>
              </div>
              {/* The split as a two-tone track rather than a run of block
                  glyphs: the stablecoin leg in the accent, the stock leg in
                  the quiet fill, both in one bar so the ratio is the shape. */}
              <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.07] mb-4">
                <span
                  className="h-full bg-wire-cyan"
                  style={{ width: `${s.stablePct}%` }}
                />
                <span
                  className="h-full bg-white/30"
                  style={{ width: `${s.stockPct}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between gap-4 text-xs">
                <span className="text-wire-muted truncate">{s.short}</span>
                <span className="text-wire-muted whitespace-nowrap">
                  {tvl[s.id] === undefined
                    ? "Not deployed"
                    : `${formatUsdg(tvl[s.id]!, 0)} TVL`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
