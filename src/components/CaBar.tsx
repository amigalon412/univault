"use client";

import { useState } from "react";
import { BLUR_TOKEN, explorerAddressUrl } from "@/lib/chain";

/**
 * The contract-address strip every memecoin site wears at the top.
 *
 * Before launch there is no address, and this says so plainly instead of
 * showing a placeholder. A fake-looking "CA" in the one spot people copy from
 * is precisely what a scammer would want circulating in the window before a
 * token is real, so the bar refuses to show anything but the truth: nothing
 * yet, and a warning that any address claiming to be $BLUR today is fake.
 *
 * Set NEXT_PUBLIC_BLUR_TOKEN and it turns into the real address with a copy
 * button and an explorer link, no code change.
 */
export function CaBar() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!BLUR_TOKEN) return;
    try {
      await navigator.clipboard.writeText(BLUR_TOKEN);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (!BLUR_TOKEN) {
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
        {BLUR_TOKEN}
      </code>
      <button
        type="button"
        onClick={copy}
        className="font-mono text-[10px] sm:text-[11px] tracking-widest text-wire-cyan border border-wire-border px-2 py-0.5 hover:border-wire-cyan hover:glow-cyan transition-all shrink-0"
      >
        {copied ? "COPIED ✓" : "COPY"}
      </button>
      <a
        href={explorerAddressUrl(BLUR_TOKEN)}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline font-mono text-[11px] text-wire-border hover:text-wire-cyan tracking-widest shrink-0"
      >
        ↗
      </a>
    </div>
  );
}
