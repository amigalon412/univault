"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { robinhoodChain } from "@/lib/chain";
import { useMounted } from "@/hooks/useMounted";
import { cn } from "@/lib/utils";

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface ConnectButtonProps {
  className?: string;
  /** Shown before a wallet is connected. */
  label?: string;
}

/**
 * Connect / switch-network / disconnect in one control.
 *
 * The switch step is not optional: a wallet pointed at another chain would
 * otherwise send a deposit to an address that holds a different contract, or
 * nothing at all.
 */
export function ConnectButton({
  className,
  label = "Connect wallet",
}: ConnectButtonProps) {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const injected = connectors[0];
  const wrongChain = isConnected && chainId !== robinhoodChain.id;

  const base = cn("transition-all", className);

  if (!mounted) {
    return (
      <button type="button" className={base} disabled>
        {label}
      </button>
    );
  }

  if (!injected) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className={base}
      >
        No wallet found
      </a>
    );
  }

  if (wrongChain) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: robinhoodChain.id })}
        disabled={isSwitching}
        className={base}
      >
        {isSwitching ? "Switching…" : "Switch to Robinhood Chain"}
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        title="Disconnect"
        className={base}
      >
        {shortAddress(address)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => connect({ connector: injected })}
      disabled={isPending}
      className={base}
      title={error ? error.message : undefined}
    >
      {isPending ? "Connecting…" : label}
    </button>
  );
}
