"use client";

import type { Address } from "viem";
import { explorerAddressUrl } from "@/lib/chain";
import { useBlurToken } from "@/hooks/useBlurToken";

/**
 * The contract-address strip every memecoin site wears at the top.
 *
 * Before launch there is no address, and this says so plainly instead of
 * showing a placeholder. A fake-looking "CA" in the one spot people copy from
 * is precisely what a scammer would want circulating in the window before a
 * token is real, so the bar refuses to show anything but the truth: nothing
 * yet, and a warning that any address claiming to be $BLUR today is fake.
 *
 * The address comes from useBlurToken, which reads it at runtime -- publishing
 * it from /admin takes effect on the next page load with no rebuild.
 */
export function CaBar({ initialToken }: { initialToken?: Address | null }) {
  const { token, copied, copy } = useBlurToken(initialToken);

  if (!token) {
    return (
      <div data-no-matrix className="w-full border-b border-wire-border bg-black/90 px-4 py-1.5 text-center">
        <span className="font-mono text-[11px] sm:text-xs tracking-widest text-wire-muted">
          <span className="text-wire-cyan">$BLUR CA</span>
          <span className="mx-2 text-wire-border">·</span>
          NOT LAUNCHED YET — ANY ADDRESS CLAIMING TO BE $BLUR TODAY IS FAKE
        </span>
      </div>
    );
  }

  return (
    <div data-no-matrix className="flex w-full items-center justify-center gap-2 sm:gap-3 border-b border-wire-border bg-black/90 px-4 py-1.5">
      <span className="font-mono text-[11px] sm:text-xs tracking-widest text-wire-cyan shrink-0">
        $BLUR CA
      </span>
      <code className="font-mono text-[11px] sm:text-xs text-wire-muted truncate max-w-[52vw] sm:max-w-none">
        {token}
      </code>
      <button
        type="button"
        onClick={copy}
        className="font-mono text-[10px] sm:text-[11px] tracking-widest text-wire-cyan border border-wire-border px-2 py-0.5 hover:border-wire-cyan hover:glow-cyan transition-all shrink-0"
      >
        {copied ? "COPIED ✓" : "COPY"}
      </button>
      <a
        href={explorerAddressUrl(token)}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline font-mono text-[11px] text-wire-border hover:text-wire-cyan tracking-widest shrink-0"
      >
        ↗
      </a>
    </div>
  );
}
