import type { Address } from "viem";
import { explorerAddressUrl } from "@/lib/chain";

interface ContractLinkProps {
  address: Address | null;
  /** Shown before the address, e.g. "VAULT". Omit for a bare chip. */
  label?: string;
  /**
   * `chip` is bordered, for diagram nodes. `bare` is inline, for lists.
   * `ticker` shows the label alone -- for a set of holdings, where four
   * truncated addresses side by side are noise and the symbol is the thing
   * being checked. The address stays in the title and in the href.
   */
  variant?: "chip" | "bare" | "ticker";
  className?: string;
}

/**
 * A truncated contract address that opens on Blockscout.
 *
 * Renders nothing at all when the address is null. That is the normal state
 * before a deployment -- VAULT_ADDRESSES reads the environment -- and a link
 * to nowhere under a heading about verifiable contracts is worse than no link.
 */
export function ContractLink({
  address,
  label,
  variant = "chip",
  className = "",
}: ContractLinkProps) {
  if (!address) return null;

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const base =
    variant === "chip"
      ? "inline-block border border-wire-cyan/25 px-3 py-1 text-xs text-wire-muted hover:text-wire-cyan hover:border-wire-cyan transition-colors"
      : variant === "ticker"
        ? "inline-block border border-wire-cyan/25 px-2.5 py-1 text-xs tracking-[0.1em] text-wire-cyan/85 hover:text-wire-cyan hover:border-wire-cyan transition-colors"
        : "text-xs text-wire-muted hover:text-wire-cyan border-b border-dotted border-wire-cyan/30 transition-colors";

  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
      className={`${base} ${className}`}
    >
      {label ? `${label} ` : ""}
      {variant === "ticker" ? "↗" : `${short} ↗`}
    </a>
  );
}
