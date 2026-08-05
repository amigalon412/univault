import Link from "next/link";
import { VaultMark, XIcon } from "@/components/icons";

const LINKS = [
  { href: "/app", label: "App" },
  { href: "/#vaults", label: "Vaults" },
  { href: "/#mechanics", label: "How it works" },
  { href: "/#token", label: "$UNIVAULT" },
  { href: "/docs", label: "Docs" },
];

export function Footer() {
  return (
    <footer className="px-6 sm:px-8 py-12 border-t border-wire-border">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <VaultMark className="h-6 w-6 text-wire-cyan shrink-0" />
          <span className="wire-title text-base text-white">UNIVAULT</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-wire-muted">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white transition-colors">
              {l.label}
            </Link>
          ))}
          <a
            href="https://x.com/BlurYield"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="UNIVAULT on X"
            className="hover:text-white transition-colors"
          >
            <XIcon width={13} height={13} />
          </a>
        </div>

        <div className="text-[11px] text-wire-muted/70 text-center md:text-right max-w-xs leading-relaxed">
          Non-custodial software on Robinhood Chain · Not financial advice ·
          Stock tokens not available to US persons
        </div>
      </div>
    </footer>
  );
}
