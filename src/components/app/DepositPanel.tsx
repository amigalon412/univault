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
      value: mode === "deposit" ? "blur-shares" : "USDG",
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
    <div className="border border-wire-border bg-black">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-wire-border bg-wire-card">
        <span className="font-mono text-xs text-wire-cyan/50 tracking-widest">
          ◉ ◉ ◉
        </span>
        <span className="font-mono text-sm text-wire-muted tracking-widest">
          root@blurvault:~$ {mode}
        </span>
        <span className="ml-auto font-mono text-sm text-wire-cyan animate-blink">
          █
        </span>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-px bg-wire-border">
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
                "font-mono text-sm py-3 tracking-widest transition-all " +
                (mode === m
                  ? "bg-wire-cyan text-black font-bold"
                  : "bg-black text-wire-muted hover:text-wire-cyan")
              }
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 border border-wire-border px-5 py-5 focus-within:border-wire-cyan transition-colors">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            aria-label={`Amount to ${mode}`}
            className="flex-1 min-w-0 bg-transparent font-digits text-3xl text-wire-cyan placeholder:text-wire-cyan/25 outline-none"
          />
          <span className="flex items-center gap-2 font-mono text-sm text-wire-muted tracking-widest shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-wire-cyan" />
            USDG
          </span>
        </div>

        <div className="space-y-2.5">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-4 font-mono text-sm border-b border-dashed border-wire-border pb-3"
            >
              <span className="text-wire-muted">{r.label}</span>
              <span className={"text-wire-cyan" + (r.numeric ? " font-digits" : "")}>
                {r.value}
              </span>
            </div>
          ))}
        </div>

        {!ready ? (
          <ConnectButton className="w-full bg-wire-cyan text-black font-bold text-base py-4 hover:opacity-90 hover:shadow-[0_0_40px_rgba(214,254,81,0.35)]" />
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled}
            className="w-full bg-wire-cyan text-black font-mono font-bold text-base py-4 tracking-widest hover:opacity-90 hover:shadow-[0_0_40px_rgba(214,254,81,0.35)] transition-all disabled:opacity-40 disabled:hover:shadow-none"
          >
            {actionLabel()}
          </button>
        )}

        {ready && mode === "withdraw" && Boolean(vault.shares) && (
          <button
            type="button"
            onClick={redeemInKind}
            disabled={busy}
            className="w-full font-mono text-xs text-wire-cyan border border-wire-border py-3 tracking-widest hover:border-wire-cyan hover:glow-cyan transition-all disabled:opacity-40"
          >
            REDEEM EVERYTHING IN KIND
          </button>
        )}

        {/* Sell the whole position — stocks included — to USDG in one go. Only
            meaningful for a basketed vault; STEADY already exits fully in USDG. */}
        {ready && mode === "withdraw" && Boolean(vault.shares) &&
          strategy.id !== "steady" && vault.address && (
            <ExitAllButton vault={vault.address} shares={vault.shares!} />
          )}

        {vault.isPriceable === false && (
          <div className="font-mono text-xs text-wire-cyan/80 leading-relaxed border border-wire-cyan/40 p-3">
            The vault cannot value its basket right now — a price feed is stale
            or a stock split has not been acknowledged. Deposits and USDG
            withdrawals are halted until it clears. In-kind redemption still
            works: it consults no price.
          </div>
        )}

        {error && (
          <div className="font-mono text-xs text-wire-muted leading-relaxed break-words">
            {error}
          </div>
        )}

        {hash && (
          <a
            href={explorerTxUrl(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-mono text-xs text-wire-cyan tracking-widest hover:glow-cyan"
          >
            {isSuccess ? "✓ CONFIRMED — VIEW ON EXPLORER" : "VIEW ON EXPLORER"}
          </a>
        )}

        <div className="font-mono text-xs text-wire-muted text-center tracking-[0.15em] leading-relaxed">
          NON-CUSTODIAL · NOBODY CAN MOVE YOUR SHARES
        </div>
      </div>
    </div>
  );
}
