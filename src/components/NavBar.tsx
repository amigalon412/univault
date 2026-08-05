import Link from "next/link";
import { CaBar } from "@/components/CaBar";
import { ConnectButton } from "@/components/ConnectButton";
import { VaultMark, XIcon } from "@/components/icons";
import { readSiteConfig } from "@/lib/site-config";

const LINKS = [
  { href: "/app", label: "App" },
  { href: "/#vaults", label: "Vaults" },
  { href: "/#mechanics", label: "How it works" },
  { href: "/#feed", label: "Live" },
  { href: "/docs", label: "Docs" },
];

export async function NavBar() {
  // Server-side read so the CA strip is correct in the HTML itself rather than
  // corrected a moment later by the client fetch.
  const { blurToken } = await readSiteConfig();

  return (
    // The CA strip and the nav stick to the top as one unit, so the address
    // stays reachable on every page without stacking two sticky offsets.
    //
    // No backdrop-blur: a blurred backdrop on a sticky bar has to be re-sampled
    // and re-blurred on every frame anything underneath it moves, and on this
    // page something is always moving (the marquee sits directly beneath it,
    // and the logo field falls behind everything).
    <header className="sticky top-0 z-50 bg-black/92">
      <CaBar initialToken={blurToken} />
      <nav className="grid grid-cols-2 lg:grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2.5">
          {/* The wordmark is the way home from /app and /docs, which is where
              everyone reaches for it first. */}
          <Link
            href="/"
            aria-label="UNIVAULT — home"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <VaultMark className="h-7 w-7 text-wire-cyan shrink-0" />
            <span className="wire-title text-lg sm:text-xl text-white">
              UNIVAULT
            </span>
          </Link>
        </div>

        {/* Uniswap keeps its sections as a row of quiet pills that only take a
            fill on hover, rather than as underlined links. */}
        <div className="hidden lg:flex items-center justify-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-wire-muted hover:text-white hover:bg-white/5 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <a
            href="https://x.com/BlurYield"
            target="_blank"
            rel="noopener noreferrer"
            title="Follow on X"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-wire-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <XIcon width={14} height={14} />
          </a>
          <ConnectButton
            label="Connect"
            className="uni-pill bg-wire-cyan/[0.14] text-wire-cyan text-sm font-semibold px-4 sm:px-5 py-2.5 hover:bg-wire-cyan/25 disabled:opacity-40 whitespace-nowrap"
          />
        </div>
      </nav>
    </header>
  );
}
