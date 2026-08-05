"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { erc20Abi, parseUnits, type Hash } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import { ExitAllButton } from "@/components/app/ExitAllButton";
import { useMounted } from "@/hooks/useMounted";
import { formatUsdg, useUsdg, useVault } from "@/hooks/useVault";
import { blurVaultAbi } from "@/lib/abis";
import { explorerTxUrl, robinhoodChain, USDG, USDG_DECIMALS } from "@/lib/chain";
import type { Strategy } from "@/lib/strategies";

type Mode = "deposit" | "withdraw";

interface DepositPanelProps {
  strategy: Strategy;
}

/** Strips the stack trace off a wallet/RPC error and keeps the first line. */
function readableError(error: unknown): string {
  if (!(error instanceof Error)) return "Transaction failed.";
  const [first] = error.message.split("\n");
  return first.length > 140 ? `${first.slice(0, 137)}…` : first;
}

export function DepositPanel({ strategy }: DepositPanelProps) {
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [hash, setHash] = useState<Hash | undefined>();
  const [error, setError] = useState<string | null>(null);

  const mounted = useMounted();
  const queryClient = useQueryClient();
  const { address: account, isConnected, chainId } = useAccount();
  const vault = useVault(strategy.id);
  const { balance, allowance } = useUsdg(vault.address);

  const { writeContractAsync, isPending: isSigning } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: Boolean(hash) },
  });

  // Re-read chain state only once a transaction has actually confirmed.
  // writeContractAsync resolves when the tx is *sent*, not mined, so refetching
  // right after sending an approval still reads the old allowance and leaves the
  // button stuck on "APPROVE USDG" -- the user just approves again and again.
  // Invalidating every query (rather than one hook's refetch) is what refreshes
  // the sibling components too: TVL, position and wallet balance live in their
  // own hook instances up in VaultApp and would otherwise stay stale.
  useEffect(() => {
    if (isSuccess) queryClient.invalidateQueries();
  }, [isSuccess, queryClient]);

  // parseUnits throws on "" and on a bare "." -- both are reachable from the
  // input's own filter, so the parse has to be guarded rather than trusted.
  let parsed: bigint | null = null;
  try {
    parsed = amount && amount !== "." ? parseUnits(amount, USDG_DECIMALS) : null;
  } catch {
    parsed = null;
  }

  const ready = mounted && isConnected && chainId === robinhoodChain.id;
  const needsApproval =
    parsed !== null && allowance !== undefined && allowance < parsed;
  const busy = isSigning || isConfirming;

  // Withdrawals are bounded by maxWithdraw, not by the position. With a basket
  // attached the two differ: only the lending leg can fund a priced exit, and
  // the remainder leaves through in-kind redemption.
  const insufficient =
    mode === "deposit"
      ? parsed !== null && balance !== undefined && parsed > balance
      : parsed !== null &&
        vault.maxWithdraw !== undefined &&
        parsed > vault.maxWithdraw;

  async function submit() {
    if (!vault.address || !account || parsed === null) return;
    setError(null);
    try {
      if (mode === "deposit") {
        if (needsApproval) {
          // Approve exactly what is being deposited. An unlimited approval
          // would leave the vault able to pull the rest of the wallet later.
          const approvalHash = await writeContractAsync({
            address: USDG,
            abi: erc20Abi,
            functionName: "approve",
            args: [vault.address, parsed],
          });
          setHash(approvalHash);
          return;
        }
        setHash(
          await writeContractAsync({
            address: vault.address,
            abi: blurVaultAbi,
            functionName: "deposit",
            args: [parsed, account],
          }),
        );
      } else {
        setHash(
          await writeContractAsync({
            address: vault.address,
            abi: blurVaultAbi,
            functionName: "withdraw",
            args: [parsed, account, account],
          }),
        );
      }
    } catch (e) {
      setError(readableError(e));
    }
  }

  async function redeemInKind() {
    if (!vault.address || !account || !vault.shares) return;
    setError(null);
    try {
      setHash(
        await writeContractAsync({
          address: vault.address,
          abi: blurVaultAbi,
          functionName: "redeemInKind",
          args: [vault.shares, account, account],
        }),
      );
    } catch (e) {
      setError(readableError(e));
    }
  }

  const rows: { label: string; value: string; numeric?: boolean }[] = [
    {
      label: mode === "deposit" ? "Wallet balance" : "Your position",
      value:
        !ready
          ? "—"
          : mode === "deposit"
            ? balance === undefined
              ? "—"
              : formatUsdg(balance)
            : vault.positionAssets === undefined
              ? "—"
              : formatUsdg(vault.positionAssets),
      numeric: true,
    },
    { label: "Strategy", value: strategy.name },
    {
      label: mode === "deposit" ? "You receive" : "You redeem",
      value: mode === "deposit" ? "UNIVAULT shares" : "USDG",
    },
  ];

  if (mode === "withdraw" && ready) {
    rows.splice(1, 0, {
      label: "Withdrawable in USDG",
      value: vault.maxWithdraw === undefined ? "—" : formatUsdg(vault.maxWithdraw),
      numeric: true,
    });
  }

  function actionLabel(): string {
    if (busy) return isConfirming ? "CONFIRMING…" : "CHECK YOUR WALLET…";
    if (!vault.address) return "NOT DEPLOYED";
    if (vault.isPriceable === false) return "PRICING HALTED";
    if (parsed === null) return mode === "deposit" ? "ENTER AMOUNT" : "ENTER AMOUNT";
    if (insufficient) return mode === "deposit" ? "INSUFFICIENT BALANCE" : "MORE THAN IS WITHDRAWABLE";
    if (mode === "deposit") return needsApproval ? "APPROVE USDG" : "DEPOSIT";
    return "WITHDRAW";
  }

  const disabled =
    busy ||
    !vault.address ||
    vault.isPriceable === false ||
    parsed === null ||
    insufficient;

  return (
    <div className="uni-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-wire-border">
        <span className="text-sm font-semibold text-white capitalize">{mode}</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-wire-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-wire-cyan animate-blink" />
          USDG
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* The deposit/withdraw switch, as the segmented control on a recessed
            track that the app this borrows from uses for every binary mode. */}
        <div className="flex gap-1 rounded-2xl bg-white/[0.04] p-1">
          {(["deposit", "withdraw"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              aria-pressed={mode === m}
              className={
                "flex-1 rounded-xl py-2.5 text-sm font-semibold capitalize transition-colors " +
                (mode === m
                  ? "bg-wire-cyan text-black"
                  : "text-wire-muted hover:text-white hover:bg-white/5")
              }
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 uni-raised px-5 py-5 border border-transparent focus-within:border-wire-cyan/50 transition-colors">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            aria-label={`Amount to ${mode}`}
            className="flex-1 min-w-0 bg-transparent font-digits text-3xl font-semibold text-white placeholder:text-white/20 outline-none"
          />
          <span className="flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-sm font-medium text-white shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-wire-cyan" />
            USDG
          </span>
        </div>

        <div className="space-y-2.5">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-4 text-sm"
            >
              <span className="text-wire-muted">{r.label}</span>
              <span className={"text-white" + (r.numeric ? " font-digits" : "")}>
                {r.value}
              </span>
            </div>
          ))}
        </div>

        {!ready ? (
          <ConnectButton className="uni-pill w-full bg-wire-cyan text-black font-semibold text-base py-4 hover:shadow-[0_10px_34px_rgba(252,114,255,0.3)]" />
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled}
            className="uni-pill w-full bg-wire-cyan text-black font-semibold text-base py-4 hover:shadow-[0_10px_34px_rgba(252,114,255,0.3)] disabled:opacity-40 disabled:hover:shadow-none disabled:hover:translate-y-0"
          >
            {actionLabel()}
          </button>
        )}

        {ready && mode === "withdraw" && Boolean(vault.shares) && (
          <button
            type="button"
            onClick={redeemInKind}
            disabled={busy}
            className="uni-pill w-full text-sm font-medium text-wire-cyan bg-wire-cyan/10 py-3 hover:bg-wire-cyan/20 disabled:opacity-40"
          >
            Redeem everything in kind
          </button>
        )}

        {/* Sell the whole position — stocks included — to USDG in one go. Only
            meaningful for a basketed vault; Steady already exits fully in USDG. */}
        {ready && mode === "withdraw" && Boolean(vault.shares) &&
          strategy.id !== "steady" && vault.address && (
            <ExitAllButton vault={vault.address} shares={vault.shares!} />
          )}

        {vault.isPriceable === false && (
          <div className="rounded-2xl border border-wire-cyan/35 bg-wire-cyan/[0.06] p-4 text-xs text-white/85 leading-relaxed">
            The vault cannot value its basket right now — a price feed is stale
            or a stock split has not been acknowledged. Deposits and USDG
            withdrawals are halted until it clears. In-kind redemption still
            works: it consults no price.
          </div>
        )}

        {error && (
          <div className="text-xs text-wire-muted leading-relaxed break-words">
            {error}
          </div>
        )}

        {hash && (
          <a
            href={explorerTxUrl(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs font-medium text-wire-cyan hover:underline"
          >
            {isSuccess ? "✓ Confirmed — view on explorer" : "View on explorer"}
          </a>
        )}

        <div className="text-xs text-wire-muted text-center leading-relaxed">
          Non-custodial · nobody can move your shares
        </div>
      </div>
    </div>
  );
}
