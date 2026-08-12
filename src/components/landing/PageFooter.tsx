import Link from "next/link";
import { XIcon } from "@/components/icons";
import { FOOTER_DISCLAIMER, FOOTER_LINKS } from "@/lib/landing";

/**
 * The ordinary footer, for /app and /docs.
 *
 * The landing page's `.bigfoot` is fixed behind the page and uncovered by
 * scrolling past it, which only works because that page is long enough and
 * ends in a section built to hand off to it. On a docs page of unknown length
 * the same trick reads as a bug, so these routes get a footer that simply sits
 * at the bottom.
 */
export function PageFooter() {
  return (
    <footer className="pagefoot">
      <div className="wrap">
        <div className="pagefoot-top">
          <Link className="pagefoot-brand" href="/">
            <span>SAFEX</span>
          </Link>

          <nav className="pagefoot-links">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.label} href={link.href}>
                {link.label}
              </Link>
            ))}
            <a href="https://x.com/safexpro" target="_blank" rel="noopener noreferrer">
              <XIcon width={12} height={12} />
            </a>
          </nav>
        </div>

        <p className="pagefoot-disc">{FOOTER_DISCLAIMER}</p>
      </div>
    </footer>
  );
}
