"use client";

import { explorerAddressUrl } from "@/lib/chain";
import { useBlurToken } from "@/hooks/useBlurToken";

/**
 * The "CONTRACT ADDRESS" box in the $BLUR section.
 *
 * This used to hardcode "NOT LAUNCHED YET", which meant that the moment an
 * address was published the header showed it while this box, on the same
 * screen, told the reader that any address presented as $BLUR was fake. On
 * launch day that reads as the site disowning its own CA. It now shares
 * useBlurToken with the header, so the two cannot disagree.
 */
export function TokenAddressPanel() {
  const { token, copied, copy } = useBlurToken();

  return (
    <div className="bg-black border border-wire-border p-6 md:p-8">
      <div className="font-mono text-[10px] text-wire-muted tracking-[0.3em] mb-3">
        CONTRACT ADDRESS
      </div>

      {/* Keyed so React swaps the whole subtree instead of reconciling the two
          branches element by element. Without the key the trailing note -- same
          tag, same className in both branches -- kept its pre-launch text after
          the address arrived, leaving a live CA sitting directly above "There
          is no $BLUR contract to buy". Verified in a browser, not assumed. */}
      {token ? (
        <div key="published">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <code className="font-mono text-sm md:text-base text-wire-cyan glow-cyan break-all">
              {token}
            </code>
            <button
              type="button"
              onClick={copy}
              className="font-mono text-[10px] tracking-widest text-wire-cyan border border-wire-border px-2 py-1 hover:border-wire-cyan hover:glow-cyan transition-all shrink-0"
            >
              {copied ? "COPIED ✓" : "COPY"}
            </button>
            <a
              href={explorerAddressUrl(token)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] tracking-widest text-wire-muted border border-wire-border px-2 py-1 hover:border-wire-cyan hover:text-wire-cyan transition-all shrink-0"
            >
              EXPLORER ↗
            </a>
          </div>
          <div className="font-mono text-xs text-wire-muted leading-relaxed max-w-2xl">
            Verify it on the explorer before you buy. Any other address
            presented as $BLUR — anywhere, by anyone — is fake.
          </div>
        </div>
      ) : (
        <div key="pending">
          <div className="font-mono text-sm text-wire-cyan glow-cyan mb-3">
            NOT LAUNCHED YET
          </div>
          <div className="font-mono text-xs text-wire-muted leading-relaxed max-w-2xl">
            There is no $BLUR contract to buy. When one is deployed, its address
            will appear here. Until then, treat any address presented as $BLUR —
            anywhere, by anyone — as fake.
          </div>
        </div>
      )}
    </div>
  );
}
