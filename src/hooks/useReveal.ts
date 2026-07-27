"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fires once, the first time the element reaches the viewport.
 *
 * Three components had grown their own copy of this observer -- identical apart
 * from the threshold -- and every section added since simply went without one,
 * because there was nothing to reuse. That is the actual reason the page reveals
 * in three places and not the rest.
 *
 * It latches: `seen` never goes back to false, so a reveal cannot replay when
 * the user scrolls back up. Components that want motion on every arrival
 * (VaultPreview replays its meter on each strategy click) drive that from their
 * own state, not from this.
 *
 * Where IntersectionObserver is missing the content is revealed immediately.
 * Failing open is the only safe direction: the alternative leaves a section
 * that never appears.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Deferred by a tick rather than set here: a synchronous setState inside an
    // effect cascades a second render pass before paint. The observer path is
    // already async, so this keeps both paths behaving the same way.
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(id);
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, seen };
}
