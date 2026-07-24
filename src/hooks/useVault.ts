"use client";

import { erc20Abi, formatUnits, type Address } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { blurVaultAbi } from "@/lib/abis";
import {
  BASKET_STOCKS,
  DEPLOYED_VAULTS,
  USDG,
  USDG_DECIMALS,
  VAULT_ADDRESSES,
} from "@/lib/chain";
import type { StrategyId } from "@/lib/strategies";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/** Just the one basket getter the position breakdown needs. */
const basketValueAbi = [
  {
    type: "function",
    name: "valueOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** A vault amount is always denominated in USDG, so always six decimals. */
export function formatUsdg(value: bigint, maximumFractionDigits = 2): string {
  return Number(formatUnits(value, USDG_DECIMALS)).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  });
}

export interface VaultView {
  address: Address | null;
  /** Everything the vault holds, both legs, valued in USDG. */
  totalAssets: bigint | undefined;
  /** What the connected wallet's shares are currently worth, in USDG. */
  positionAssets: bigint | undefined;
  shares: bigint | undefined;
  /**
   * The most that can be taken out as USDG. Not the same as the position once
   * a basket is involved: a priced exit is paid out of the lending leg only, so
   * the rest has to leave in kind.
   */
  maxWithdraw: bigint | undefined;
  /**
   * False when the oracle cannot price part of the basket -- a stale feed or a
   * stock split the adapter has not acknowledged. Deposits and withdrawals
   * that need a valuation will revert while this is false, so the UI says so
   * rather than letting the user sign a transaction that cannot land.
   */
  isPriceable: boolean | undefined;
  isLoading: boolean;
}

export function useVault(strategy: StrategyId): VaultView {
  const vault = VAULT_ADDRESSES[strategy];
  const { address: account } = useAccount();

  const vaultContract = { address: vault ?? undefined, abi: blurVaultAbi } as const;

  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: [
      { ...vaultContract, functionName: "totalAssets" },
      { ...vaultContract, functionName: "isPriceable" },
      {
        ...vaultContract,
        functionName: "balanceOf",
        args: [account ?? "0x0000000000000000000000000000000000000000"],
      },
      {
        ...vaultContract,
        functionName: "maxWithdraw",
        args: [account ?? "0x0000000000000000000000000000000000000000"],
      },
    ],
    query: { enabled: Boolean(vault) },
  });

  const shares = data?.[2]?.status === "success" ? data[2].result : undefined;

  const { data: positionData } = useReadContracts({
    contracts: [
      { ...vaultContract, functionName: "convertToAssets", args: [shares ?? 0n] },
    ],
    query: { enabled: Boolean(vault && account && shares !== undefined) },
  });

  return {
    address: vault,
    totalAssets: data?.[0]?.status === "success" ? data[0].result : undefined,
    isPriceable: data?.[1]?.status === "success" ? data[1].result : undefined,
    maxWithdraw: data?.[3]?.status === "success" ? data[3].result : undefined,
    shares,
    positionAssets:
      positionData?.[0]?.status === "success" ? positionData[0].result : undefined,
    isLoading,
  };
}

/** Total value locked across every deployed vault. */
export function useTotalValueLocked(): {
  total: bigint | undefined;
  perVault: Partial<Record<StrategyId, bigint>>;
} {
  const { data } = useReadContracts({
    allowFailure: true,
    contracts: DEPLOYED_VAULTS.map(([, address]) => ({
      address,
      abi: blurVaultAbi,
      functionName: "totalAssets" as const,
    })),
    query: { enabled: DEPLOYED_VAULTS.length > 0 },
  });

  if (!data) return { total: undefined, perVault: {} };

  const perVault: Partial<Record<StrategyId, bigint>> = {};
  let total = 0n;
  let sawOne = false;

  DEPLOYED_VAULTS.forEach(([id], i) => {
    const entry = data[i];
    if (entry?.status !== "success") return;
    const value = entry.result as bigint;
    perVault[id] = value;
    total += value;
    sawOne = true;
  });

  // A partial sum would understate TVL without saying so, so only report a
  // total once at least one vault answered.
  return { total: sawOne ? total : undefined, perVault };
}

/** The connected wallet's USDG balance, and what it has approved to `spender`. */
export function useUsdg(spender: Address | null) {
  const { address: account } = useAccount();

  const { data, refetch } = useReadContracts({
    allowFailure: true,
    contracts: [
      {
        address: USDG,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account ?? "0x0000000000000000000000000000000000000000"],
      },
      {
        address: USDG,
        abi: erc20Abi,
        functionName: "allowance",
        args: [
          account ?? "0x0000000000000000000000000000000000000000",
          spender ?? "0x0000000000000000000000000000000000000000",
        ],
      },
    ],
    query: { enabled: Boolean(account) },
  });

  return {
    balance: data?.[0]?.status === "success" ? data[0].result : undefined,
    allowance:
      spender && data?.[1]?.status === "success" ? data[1].result : undefined,
    refetch,
  };
}

export interface StockHolding {
  symbol: string;
  /** What the vault holds of this name right now, in USDG (6 decimals). */
  value: bigint;
}

export interface PositionBreakdown {
  /** True once the vault leg values have loaded. */
  ready: boolean;
  /** The stablecoin leg: lending plus anything still idle, in USDG. */
  stableAssets: bigint | undefined;
  /** The equity (stock) leg, in USDG. */
  basketAssets: bigint | undefined;
  /** USDG sitting idle in the vault -- the liquidity buffer kept out of
   *  lending so small exits need no unwind. */
  idle: bigint | undefined;
  /** The part of the stable leg actually placed in lending (stable - idle). */
  lending: bigint | undefined;
  /** Live split, in basis points of stable. */
  currentStableBps: number | undefined;
  targetStableBps: number | undefined;
  /** Whether this vault has a stock basket at all (STEADY does not). */
  hasBasket: boolean;
  /** Per-name stock holdings, vault-level, in USDG. */
  stocks: StockHolding[];
}

/**
 * The real composition of a vault right now: how much is in lending, how much
 * still idle, and what stocks it actually holds -- read from the chain, not
 * inferred from the target split. The distinction matters: a fresh deposit sits
 * idle until the keeper allocates it, so "60/40" is the goal, not the state.
 */
export function usePositionBreakdown(strategy: StrategyId): PositionBreakdown {
  const vault = VAULT_ADDRESSES[strategy];
  const vaultContract = { address: vault ?? undefined, abi: blurVaultAbi } as const;

  const { data } = useReadContracts({
    allowFailure: true,
    contracts: [
      { ...vaultContract, functionName: "stableAssets" },
      { ...vaultContract, functionName: "basketAssets" },
      { ...vaultContract, functionName: "basket" },
      { ...vaultContract, functionName: "currentStableBps" },
      { ...vaultContract, functionName: "targetStableBps" },
      { address: USDG, abi: erc20Abi, functionName: "balanceOf", args: [vault ?? ZERO] },
    ],
    query: { enabled: Boolean(vault) },
  });

  const stableAssets = data?.[0]?.status === "success" ? data[0].result : undefined;
  const basketAssets = data?.[1]?.status === "success" ? data[1].result : undefined;
  const basket = data?.[2]?.status === "success" ? data[2].result : undefined;
  const currentStableBps = data?.[3]?.status === "success" ? Number(data[3].result) : undefined;
  const targetStableBps = data?.[4]?.status === "success" ? Number(data[4].result) : undefined;
  const idle = data?.[5]?.status === "success" ? data[5].result : undefined;

  const hasBasket = Boolean(basket && basket !== ZERO);

  const { data: stockData } = useReadContracts({
    allowFailure: true,
    contracts: BASKET_STOCKS.map((s) => ({
      address: basket as Address,
      abi: basketValueAbi,
      functionName: "valueOf" as const,
      args: [s.token],
    })),
    query: { enabled: hasBasket },
  });

  // valueOf is an 18-decimal USD figure; the rest of the app speaks USDG's six.
  const stocks: StockHolding[] = hasBasket
    ? BASKET_STOCKS.map((s, i) => ({
        symbol: s.symbol,
        value:
          stockData?.[i]?.status === "success"
            ? (stockData[i].result as bigint) / 1_000_000_000_000n
            : 0n,
      }))
    : [];

  const lending =
    stableAssets !== undefined && idle !== undefined
      ? stableAssets > idle
        ? stableAssets - idle
        : 0n
      : undefined;

  return {
    ready: stableAssets !== undefined,
    stableAssets,
    basketAssets,
    idle,
    lending,
    currentStableBps,
    targetStableBps,
    hasBasket,
    stocks,
  };
}
