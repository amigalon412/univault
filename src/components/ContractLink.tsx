import type { Address } from "viem";
import { explorerAddressUrl } from "@/lib/chain";

interface ContractLinkProps {
  address: Address | null;
  /** Shown before the address, e.g. "VAULT". Omit for a bare chip. */
  label?: string;
  /** `chip` is bordered, for diagram nodes. `bare` is inline, for lists. */
  variant?: "chip" | "bare";
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
      {short} ↗
    </a>
  );
}
