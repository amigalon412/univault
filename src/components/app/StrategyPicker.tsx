"use client";

import { StrategyGlyph } from "@/components/StrategyGlyph";
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
    <section className="card panel">
      <div className="panel-head">
        <h2>Select strategy</h2>
        <span className="ui-label">3 vaults</span>
      </div>

      <div className="panel-body picker-list">
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            aria-pressed={s.id === selected}
            className="pool-bub"
          >
            <span className="pav">
              <StrategyGlyph id={s.id} />
            </span>
            <span className="pnm">
              <b>{s.name}</b>
              <small>{s.short}</small>
            </span>
            <span className="pool-apr">
              <b>{s.split}</b>
              <small>
                {tvl[s.id] === undefined
                  ? "not deployed"
                  : `${formatUsdg(tvl[s.id]!, 0)} TVL`}
              </small>
            </span>
            {/* The split as a two-tone track rather than a number twice over:
                the accent is the yield floor, the quiet fill the basket, and
                the ratio is the shape. */}
            <span className="split-track" aria-hidden>
              <i style={{ width: `${s.stablePct}%` }} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
