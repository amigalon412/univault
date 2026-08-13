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
import { NOTHING_DEPLOYED, STABLE_SYMBOL } from "@/lib/chain";
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
  // to render blank rather than as a value the server could not have known.
  const live = mounted && isConnected;

  const stats = [
    {
      label: "Total value locked",
      value: total === undefined ? "—" : formatUsdg(total, 0),
      sub: NOTHING_DEPLOYED ? "No vault deployed yet" : "Across 3 vaults",
    },
    {
      label: "Your position",
      value:
        live && vault.positionAssets !== undefined
          ? formatUsdg(vault.positionAssets)
          : "—",
      sub: `In ${strategy.name}`,
    },
    {
      label: "Wallet",
      value: live && balance !== undefined ? formatUsdg(balance) : "—",
      sub: `${STABLE_SYMBOL} available`,
    },
  ];

  return (
    <div className="app-shell">
      <div className="app-glow" aria-hidden />
      <div className="wrap">
        <span className="eyebrow">{"// Vault app"}</span>
        <h1 className="app-title">Put your cash to work.</h1>

        {NOTHING_DEPLOYED && (
          <div className="notice">
            <strong>No contracts deployed</strong>
            <p>
              The vaults are written and tested but not yet live on BNB Chain.
              Nothing on this page can take a deposit, and every figure reads blank
              rather than pretending otherwise.
            </p>
          </div>
        )}

        <div className="app-stats">
          {stats.map((s) => (
            <div className="card app-stat" key={s.label}>
              <div className="ui-label">{s.label}</div>
              <div className="figure app-stat-figure">{s.value}</div>
              <div className="app-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="app-grid">
          <div className="app-col">
            <StrategyPicker selected={selected} onSelect={setSelected} tvl={perVault} />
            <PositionPanel strategy={strategy} />
          </div>

          <div className="app-side">
            <DepositPanel strategy={strategy} />
          </div>
        </div>
      </div>
    </div>
  );
}
