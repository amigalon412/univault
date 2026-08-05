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
 * yet, and a warning that any address claiming to be $UNIVAULT today is fake.
 *
 * The address comes from useBlurToken, which reads it at runtime -- publishing
 * it from /admin takes effect on the next page load with no rebuild.
 */
export function CaBar({ initialToken }: { initialToken?: Address | null }) {
  const { token, copied, copy } = useBlurToken(initialToken);

  if (!token) {
    return (
      <div className="w-full border-b border-wire-border px-4 py-2 text-center">
        <span className="text-[11px] sm:text-xs text-wire-muted">
          <span className="font-semibold text-wire-cyan">$UNIVAULT CA</span>
          <span className="mx-2 text-white/15">·</span>
          Not launched yet — any address claiming to be $UNIVAULT today is fake
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-center gap-2 sm:gap-3 border-b border-wire-border px-4 py-2">
      <span className="text-[11px] sm:text-xs font-semibold text-wire-cyan shrink-0">
        $UNIVAULT CA
      </span>
      <code className="text-[11px] sm:text-xs text-wire-muted truncate max-w-[52vw] sm:max-w-none">
        {token}
      </code>
      <button
        type="button"
        onClick={copy}
        className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] sm:text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors shrink-0"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
      <a
        href={explorerAddressUrl(token)}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline text-[11px] text-wire-muted hover:text-wire-cyan shrink-0"
      >
        ↗
      </a>
    </div>
  );
}
