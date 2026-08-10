"use client";

import type { Address } from "viem";
import { useBlurToken } from "@/hooks/useBlurToken";

/**
 * The $UNIVAULT contract address in the nav, click to copy.
 *
 * Before launch there is no address, and this deliberately does not go quiet:
 * it says so and says that anything claiming otherwise is fake. A nav that
 * simply omits the CA leaves nothing to contradict the first scam address that
 * circulates, and launch day is exactly when people go looking for one.
 *
 * The address is never rendered from the bundle — <useBlurToken /> re-fetches
 * and re-checksums it, because this is the control that puts a string on
 * somebody's clipboard.
 */
export function CaPill({ initial }: { initial: Address | null }) {
  const { token, copied, copy } = useBlurToken(initial);

  if (!token) {
    return (
      <span className="ca-pill is-pending" title="No $UNIVAULT contract exists yet">
        <span className="ca-k">CA</span>
        <span className="ca-v">not live yet</span>
      </span>
    );
  }

  const short = `${token.slice(0, 6)}…${token.slice(-4)}`;

  return (
    <button
      type="button"
      className={`ca-pill${copied ? " is-copied" : ""}`}
      onClick={copy}
      /* The full address in the tooltip: the pill shows a truncation, and
         nobody should have to paste it somewhere to find out what they got. */
      title={token}
      aria-label={`Copy the $UNIVAULT contract address, ${token}`}
    >
      <span className="ca-k">CA</span>
      <span className="ca-v">{copied ? "Copied" : short}</span>
    </button>
  );
}
