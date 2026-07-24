import Link from "next/link";
import { CaBar } from "@/components/CaBar";
import { ConnectButton } from "@/components/ConnectButton";
import { XIcon } from "@/components/icons";

export function NavBar() {
  return (
    // The CA strip and the nav stick to the top as one unit, so the address
    // stays reachable on every page without stacking two sticky offsets.
    <header className="sticky top-0 z-50 bg-black/85 backdrop-blur">
      <CaBar />
      <nav className="grid grid-cols-2 lg:grid-cols-3 items-center px-6 py-3 border-b border-wire-border">
      <div className="flex items-center gap-3">
        <span className="wire-title text-2xl text-wire-cyan glow-cyan tracking-widest">
          BLUR
        </span>
      </div>
      <div className="hidden lg:flex items-center justify-center gap-8 font-mono text-xs tracking-widest text-wire-cyan/80">
        <Link href="/app" className="hover:text-wire-cyan hover:glow-cyan transition-all">
          APP
        </Link>
        <Link href="/#vaults" className="hover:text-wire-cyan hover:glow-cyan transition-all">
          VAULTS
        </Link>
        <Link href="/#flywheel" className="hover:text-wire-cyan hover:glow-cyan transition-all">
          HOW IT WORKS
        </Link>
        <Link href="/#token" className="hover:text-wire-cyan hover:glow-cyan transition-all">
          $BLUR
        </Link>
        <Link href="/#feed" className="hover:text-wire-cyan hover:glow-cyan transition-all">
          LIVE
        </Link>
        <Link href="/docs" className="hover:text-wire-cyan hover:glow-cyan transition-all">
          DOCS
        </Link>
      </div>
      <div className="flex items-center justify-end gap-2 sm:gap-3">
        <a
          href="https://x.com/BlurOnRh"
          target="_blank"
          rel="noopener noreferrer"
          title="@BlurOnRh on X"
          className="flex items-center justify-center border border-wire-cyan text-wire-cyan glow-box-cyan p-2 hover:bg-wire-cyan hover:text-black transition-all"
        >
          <XIcon width={15} height={15} className="glow-svg-cyan" />
        </a>
        {/* The BUY $BLUR button belongs here once a $BLUR token exists. It is
            absent rather than pointed somewhere plausible: a buy link is the
            one control on this page that costs money to click. */}
        <ConnectButton
          label="CONNECT"
          className="flex items-center gap-2 border border-wire-cyan text-wire-cyan text-xs px-4 py-2 hover:bg-wire-cyan hover:text-black disabled:opacity-30 whitespace-nowrap"
        />
      </div>
      </nav>
    </header>
  );
}
