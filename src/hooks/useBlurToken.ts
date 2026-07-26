"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { BLUR_TOKEN } from "@/lib/chain";

/**
 * The published $BLUR contract address, and a copy button for it.
 *
 * Fetched from /api/ca at runtime rather than read out of the bundle, so the
 * operator can publish it from /admin on launch day and every surface picks it
 * up on the next load with no rebuild.
 *
 * Shared by the header strip and the $BLUR section so the two can never
 * disagree about whether the token exists -- which is exactly what happened
 * when the section hardcoded "NOT LAUNCHED YET" while the header showed a
 * live address.
 *
 * BLUR_TOKEN (the build-time env var) is the initial value, so a deploy that
 * still bakes it in renders correctly before the fetch resolves.
 */
export function useBlurToken(initial?: Address | null) {
  // `initial` is the server's own read of the published address. Without it the
  // first paint after launch says NOT LAUNCHED YET -- and that strip also calls
  // any $BLUR address a fake, so the flash would be the site briefly disowning
  // its own contract, on the one day everybody is looking at it.
  const [token, setToken] = useState<Address | null>(initial ?? BLUR_TOKEN);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/ca", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!live || !data) return;
        // Re-checked rather than trusted: this is what the copy button puts on
        // someone's clipboard, and a wrong CA is the whole scam.
        const next: unknown = data.address;
        setToken(
          typeof next === "string" && isAddress(next) ? getAddress(next) : null,
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const copy = useCallback(async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [token]);

  return { token, copied, copy };
}
