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
    if (busy) return isConfirming ? "Confirming…" : "Check your wallet…";
    if (!vault.address) return "Not deployed";
    if (vault.isPriceable === false) return "Pricing halted";
    if (parsed === null) return "Enter amount";
    if (insufficient) return mode === "deposit" ? "Insufficient balance" : "More than is withdrawable";
    if (mode === "deposit") return needsApproval ? "Approve USDG" : "Deposit";
    return "Withdraw";
  }

  const disabled =
    busy ||
    !vault.address ||
    vault.isPriceable === false ||
    parsed === null ||
    insufficient;

  return (
    <div className="card panel deposit">
      <div className="panel-head">
        <h2 className="capitalize">{mode}</h2>
        <span className="ui-label deposit-asset">
          <span className="animate-blink">●</span> USDG
        </span>
      </div>

      <div className="panel-body">
        {/* Two modes, one row, on a recessed track. */}
        <div className="seg-control seg-control-flush">
          {(["deposit", "withdraw"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              aria-pressed={mode === m}
              className="seg-btn"
            >
              {m}
            </button>
          ))}
        </div>

        <div className="amount">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            aria-label={`Amount to ${mode}`}
            className="amount-input figure"
          />
          <span className="chip">USDG</span>
        </div>

        <dl className="rows">
          {rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd className={r.numeric ? "figure" : undefined}>{r.value}</dd>
            </div>
          ))}
        </dl>

        {!ready ? (
          <ConnectButton className="btn btn-primary btn-block" />
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled}
            className="btn btn-primary btn-block"
          >
            {actionLabel()}
          </button>
        )}

        {ready && mode === "withdraw" && Boolean(vault.shares) && (
          <button
            type="button"
            onClick={redeemInKind}
            disabled={busy}
            className="btn btn-ghost btn-block"
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
          <div className="notice notice-warn">
            The vault cannot value its basket right now — a price feed is stale
            or a stock split has not been acknowledged. Deposits and USDG
            withdrawals are halted until it clears. In-kind redemption still
            works: it consults no price.
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        {hash && (
          <a
            href={explorerTxUrl(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="form-link"
          >
            {isSuccess ? "Confirmed — view on explorer ↗" : "View on explorer ↗"}
          </a>
        )}

        <p className="form-foot">Non-custodial · nobody can move your shares</p>
      </div>
    </div>
  );
}
