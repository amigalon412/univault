"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type Address, type Hash } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { blurVaultAbi } from "@/lib/abis";
import { EXIT_ROUTER, exitRouterAbi, explorerTxUrl, robinhoodChain } from "@/lib/chain";

/** Slippage choices for the market exit, in basis points. */
const SLIPPAGE = [
  { label: "1%", bps: 100 },
  { label: "3%", bps: 300 },
  { label: "5%", bps: 500 },
];

interface ExitAllButtonProps {
  vault: Address;
  shares: bigint;
}

function readableError(error: unknown): string {
  if (!(error instanceof Error)) return "Transaction failed.";
  const [first] = error.message.split("\n");
  return first.length > 140 ? `${first.slice(0, 137)}…` : first;
}

/**
 * Market-sells the whole position — stable leg plus the stock basket — into USDG
 * through the ExitRouter, in one transaction. This is the opt-in alternative to
 * in-kind redemption for a holder who wants pure USDG and accepts the market
 * price on the stocks.
 *
 * Two steps, because the router moves the caller's shares: approve the router on
 * the vault token, then sell. The minimum out is quoted live by simulating the
 * exit and then discounted by the chosen slippage — the sole guard against a bad
 * or sandwiched fill.
 */
export function ExitAllButton({ vault, shares }: ExitAllButtonProps) {
  const { address: account, chainId } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [slippageBps, setSlippageBps] = useState(300);
  const [hash, setHash] = useState<Hash | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: Boolean(hash) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: vault,
    abi: blurVaultAbi,
    functionName: "allowance",
    args: [account ?? "0x0000000000000000000000000000000000000000", EXIT_ROUTER ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(account && EXIT_ROUTER) },
  });

  useEffect(() => {
    if (isSuccess) {
      refetchAllowance();
      queryClient.invalidateQueries();
    }
  }, [isSuccess, refetchAllowance, queryClient]);

  if (!EXIT_ROUTER || !account || chainId !== robinhoodChain.id || !shares) return null;

  const needsApproval = allowance === undefined || allowance < shares;
  const busy = isPending || isConfirming || quoting;

  async function approve() {
    if (!EXIT_ROUTER) return;
    setError(null);
    try {
      setHash(
        await writeContractAsync({
          address: vault,
          abi: blurVaultAbi,
          functionName: "approve",
          args: [EXIT_ROUTER, shares],
        }),
      );
    } catch (e) {
      setError(readableError(e));
    }
  }

  async function sell() {
    if (!EXIT_ROUTER || !account || !publicClient) return;
    setError(null);
    setQuoting(true);
    try {
      // Quote by simulating the exit with no floor, then discount by slippage.
      const sim = await publicClient.simulateContract({
        address: EXIT_ROUTER,
        abi: exitRouterAbi,
        functionName: "exitToStable",
        args: [vault, shares, 0n],
        account,
      });
      const quoted = sim.result as bigint;
      const minOut = (quoted * BigInt(10_000 - slippageBps)) / 10_000n;
      setQuoting(false);
      setHash(
        await writeContractAsync({
          address: EXIT_ROUTER,
          abi: exitRouterAbi,
          functionName: "exitToStable",
          args: [vault, shares, minOut],
        }),
      );
    } catch (e) {
      setQuoting(false);
      setError(readableError(e));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-wire-muted tracking-[0.2em]">
          MAX SLIPPAGE
        </span>
        <div className="flex gap-1">
          {SLIPPAGE.map((s) => (
            <button
              key={s.bps}
              type="button"
              onClick={() => setSlippageBps(s.bps)}
              className={
                "font-mono text-[11px] px-2.5 py-1 border transition-all " +
                (slippageBps === s.bps
                  ? "border-wire-cyan text-wire-cyan"
                  : "border-wire-border text-wire-muted hover:border-wire-cyan/50")
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={needsApproval ? approve : sell}
        disabled={busy}
        className="w-full font-mono text-xs text-black bg-wire-purple/80 py-3 tracking-widest hover:bg-wire-purple transition-all disabled:opacity-40"
      >
        {busy
          ? quoting
            ? "QUOTING…"
            : isConfirming
              ? "CONFIRMING…"
              : "CHECK YOUR WALLET…"
          : needsApproval
            ? "APPROVE SELL → USDG"
            : "SELL EVERYTHING → USDG (MARKET)"}
      </button>

      {error && (
        <div className="font-mono text-[11px] text-wire-muted leading-relaxed break-words">
          {error}
        </div>
      )}
      {hash && (
        <a
          href={explorerTxUrl(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-mono text-[11px] text-wire-cyan tracking-widest hover:glow-cyan"
        >
          {isSuccess ? "✓ SOLD — VIEW ON EXPLORER" : "VIEW ON EXPLORER"}
        </a>
      )}
    </div>
  );
}
