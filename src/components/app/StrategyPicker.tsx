"use client";

import { formatUsdg } from "@/hooks/useVault";
import { BAR_FILL, BAR_TRACK, STRATEGIES, type StrategyId } from "@/lib/strategies";
import { AsciiRule } from "@/components/AsciiRule";

interface StrategyPickerProps {
  selected: StrategyId;
  onSelect: (id: StrategyId) => void;
  /** Live TVL per vault. A strategy missing from the map has no deployment. */
  tvl: Partial<Record<StrategyId, bigint>>;
}

export function StrategyPicker({ selected, onSelect, tvl }: StrategyPickerProps) {
  return (
    <section className="border border-wire-border bg-black p-7 md:p-9">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="font-mono text-lg text-wire-cyan glow-cyan tracking-[0.3em]">
          SELECT STRATEGY
        </h2>
        <span className="font-mono text-xs text-wire-muted tracking-[0.2em]">
          3 VAULTS
        </span>
      </div>
      <AsciiRule className="text-xs text-wire-cyan/40 mb-6" />
      <div className="space-y-px bg-wire-border">
        {STRATEGIES.map((s) => {
          const active = s.id === selected;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              aria-pressed={active}
              className={
                "w-full text-left p-7 transition-all group " +
                (active
                  ? "bg-wire-card outline outline-wire-cyan glow-box-cyan"
                  : "bg-black hover:bg-wire-card")
              }
            >
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <span className="flex items-baseline gap-2.5 min-w-0">
                  <span
                    className={
                      "font-mono text-sm " +
                      (active ? "text-wire-cyan" : "text-wire-dim")
                    }
                  >
                    {active ? "▸" : " "}
                  </span>
                  <span
                    className={
                      "font-mono text-2xl tracking-widest transition-all " +
                      (active
                        ? "text-wire-cyan glow-cyan"
                        : "text-wire-cyan group-hover:glow-cyan")
                    }
                  >
                    {s.name}
                  </span>
                </span>
                <span
                  className={
                    "font-digits text-3xl whitespace-nowrap " +
                    (active ? "text-wire-cyan glow-cyan" : "text-wire-cyan")
                  }
                >
                  {s.split}
                </span>
              </div>
              <div className="relative h-4 mb-4 font-mono text-base leading-4 tracking-tighter">
                <div className="absolute inset-0 overflow-hidden whitespace-nowrap text-wire-dim">
                  {BAR_TRACK}
                </div>
                <div
                  className={
                    "absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap " +
                    s.barClass +
                    (active ? " text-wire-cyan glow-cyan" : " text-wire-cyan")
                  }
                >
                  {BAR_FILL}
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-4 font-mono text-xs tracking-[0.2em]">
                <span className="text-wire-muted truncate">{s.short}</span>
                <span className="text-wire-muted whitespace-nowrap">
                  {tvl[s.id] === undefined
                    ? "NOT DEPLOYED"
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
