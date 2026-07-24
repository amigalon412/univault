"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { DepositPanel } from "@/components/app/DepositPanel";
import { PositionPanel } from "@/components/app/PositionPanel";
import { StrategyPicker } from "@/components/app/StrategyPicker";
import { useMounted } from "@/hooks/useMounted";
import {
  formatUsdg,
  useTotalValueLocked,
  useUsdg,
  useVault,
} from "@/hooks/useVault";
import { NOTHING_DEPLOYED } from "@/lib/chain";
import { STRATEGIES, type StrategyId } from "@/lib/strategies";
import { AsciiRule } from "@/components/AsciiRule";

export function VaultApp() {
  const [selected, setSelected] = useState<StrategyId>("balanced");
  const strategy = STRATEGIES.find((s) => s.id === selected) ?? STRATEGIES[1];

  const mounted = useMounted();
  const { isConnected } = useAccount();
  const vault = useVault(selected);
  const { total, perVault } = useTotalValueLocked();
  const { balance } = useUsdg(vault.address);

  // Until hydration the wallet is unknown, so every wallet-derived figure has
  // to render as blank rather than as a value the server could not have known.
  const live = mounted && isConnected;

  const stats = [
    {
      label: "TOTAL VALUE LOCKED",
      value: total === undefined ? "—" : formatUsdg(total, 0),
      sub: NOTHING_DEPLOYED ? "NO VAULT DEPLOYED YET" : "ACROSS 3 VAULTS",
      lit: true,
    },
    {
      label: "YOUR POSITION",
      value:
        live && vault.positionAssets !== undefined
          ? formatUsdg(vault.positionAssets)
          : "—",
      sub: `IN ${strategy.name}`,
      lit: false,
    },
    {
      label: "WALLET",
      value: live && balance !== undefined ? formatUsdg(balance) : "—",
      sub: "USDG AVAILABLE",
      lit: false,
    },
  ];

  return (
    <div className="px-6 md:px-10 py-12 md:py-16">
      <div className="max-w-7xl mx-auto">
        <div className="font-mono text-sm text-wire-muted tracking-[0.4em] mb-3">
          {"// VAULT TERMINAL"}
        </div>
        <AsciiRule className="text-xs text-wire-cyan/40 mb-7" />
        <h1 className="font-mono text-3xl md:text-5xl text-wire-cyan glow-cyan mb-10 leading-tight">
          Put your cash to work.
        </h1>

        {NOTHING_DEPLOYED && (
          <div className="border border-wire-cyan/40 bg-wire-card px-7 py-5 mb-8">
            <div className="font-mono text-sm text-wire-cyan tracking-[0.25em] mb-2">
              ⚠ NO CONTRACTS DEPLOYED
            </div>
            <div className="font-mono text-xs text-wire-muted leading-relaxed">
              The vaults are written and tested but not yet live on Robinhood
              Chain. Nothing on this page can take a deposit, and every figure
              reads as blank rather than pretending otherwise.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-wire-border border border-wire-border mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-black px-8 py-7">
              <div className="font-mono text-xs text-wire-muted tracking-[0.25em] mb-3">
                {s.label}
              </div>
              <div
                className={
                  "font-digits text-3xl md:text-4xl mb-2 " +
                  (s.lit ? "text-wire-cyan glow-cyan" : "text-wire-cyan")
                }
              >
                {s.value}
              </div>
              <div className="font-mono text-xs text-wire-muted tracking-[0.2em]">
                {s.sub}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">
          <div className="space-y-8">
            <StrategyPicker
              selected={selected}
              onSelect={setSelected}
              tvl={perVault}
            />

            <PositionPanel strategy={strategy} />
          </div>

          <div className="lg:sticky lg:top-20">
            <DepositPanel strategy={strategy} />
          </div>
        </div>
      </div>
    </div>
  );
}
