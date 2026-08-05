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
      label: "Total value locked",
      value: total === undefined ? "—" : formatUsdg(total, 0),
      sub: NOTHING_DEPLOYED ? "No vault deployed yet" : "Across 3 vaults",
      lit: true,
    },
    {
      label: "Your position",
      value:
        live && vault.positionAssets !== undefined
          ? formatUsdg(vault.positionAssets)
          : "—",
      sub: `In ${strategy.name}`,
      lit: false,
    },
    {
      label: "Wallet",
      value: live && balance !== undefined ? formatUsdg(balance) : "—",
      sub: "USDG available",
      lit: false,
    },
  ];

  return (
    <div className="px-6 md:px-10 py-12 md:py-16">
      <div className="max-w-7xl mx-auto">
        <div className="text-sm font-semibold text-wire-cyan mb-3">Vault app</div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-[-0.035em] text-white mb-10 leading-tight">
          Put your cash to work.
        </h1>

        {NOTHING_DEPLOYED && (
          <div className="uni-card border-wire-cyan/35 px-6 py-5 mb-8">
            <div className="text-sm font-semibold text-wire-cyan mb-1.5">
              No contracts deployed
            </div>
            <div className="text-sm text-wire-muted leading-relaxed">
              The vaults are written and tested but not yet live on Robinhood
              Chain. Nothing on this page can take a deposit, and every figure
              reads as blank rather than pretending otherwise.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="uni-card px-6 py-6">
              <div className="text-xs text-wire-muted mb-3">{s.label}</div>
              <div
                className={
                  "font-digits text-3xl md:text-4xl font-semibold mb-2 " +
                  (s.lit ? "text-wire-cyan" : "text-white")
                }
              >
                {s.value}
              </div>
              <div className="text-xs text-wire-muted">{s.sub}</div>
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
