import Link from "next/link";

const BOX = `╔══════════════════════════════════════════════════════════════════╗
║  BLUR · GROW YOUR BAG, AUTOMATICALLY · blurvault.pro             ║
╚══════════════════════════════════════════════════════════════════╝`;

export function Footer() {
  return (
    <footer className="px-8 py-12">
      <div className="font-mono text-xs text-wire-cyan/55 mb-6 text-center whitespace-pre overflow-x-auto">{BOX}</div>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="wire-title text-wire-cyan opacity-50 tracking-widest text-lg">
            BLUR
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-xs text-wire-muted tracking-widest">
          <Link href="/app" className="hover:text-wire-cyan transition-colors">
            APP
          </Link>
          <Link href="/#vaults" className="hover:text-wire-cyan transition-colors">
            VAULTS
          </Link>
          <Link href="/#flywheel" className="hover:text-wire-cyan transition-colors">
            HOW IT WORKS
          </Link>
          <Link href="/#token" className="hover:text-wire-cyan transition-colors">
            $BLUR
          </Link>
          <Link href="/docs" className="hover:text-wire-cyan transition-colors">
            DOCS
          </Link>
          <a
            href="https://x.com/BlurOnRh"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-wire-cyan transition-colors"
          >
            X
          </a>
        </div>
        <div className="font-mono text-[10px] text-wire-muted text-center max-w-xs">
          NON-CUSTODIAL SOFTWARE ON ROBINHOOD CHAIN · NOT FINANCIAL ADVICE ·
          STOCK TOKENS NOT AVAILABLE TO US PERSONS
        </div>
      </div>
    </footer>
  );
}
