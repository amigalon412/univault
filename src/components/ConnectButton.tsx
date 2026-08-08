"use client";

import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ArrowRightIcon } from "@/components/icons";
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
  /**
   * Renders the label inside the nav pill's shell — a `.lbl` span plus the
   * circular arrow badge — instead of as bare text.
   *
   * A boolean rather than a render prop on purpose: <SiteNav /> is a server
   * component, and a function cannot cross that boundary. Every state this
   * control cycles through (connect / switch / address / pending) has to wear
   * the same chrome, so the chrome lives here.
   */
  pill?: boolean;
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
  pill = false,
}: ConnectButtonProps) {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const injected = connectors[0];
  const wrongChain = isConnected && chainId !== robinhoodChain.id;

  const base = cn(className);
  const wrap = (text: string): ReactNode =>
    pill ? (
      <>
        <span className="lbl">{text}</span>
        <span className="arw">
          <ArrowRightIcon />
        </span>
      </>
    ) : (
      text
    );

  // Until hydration the wallet is unknown, so the first client render has to
  // match the server's: the resting label, disabled.
  if (!mounted) {
    return (
      <button type="button" className={base} disabled>
        {wrap(label)}
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
        {wrap("No wallet found")}
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
        {wrap(isSwitching ? "Switching…" : "Switch network")}
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
        {wrap(shortAddress(address))}
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
      {wrap(isPending ? "Connecting…" : label)}
    </button>
  );
}
