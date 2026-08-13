import Link from "next/link";
import { XIcon } from "@/components/icons";
import { FOOTER_DISCLAIMER, FOOTER_LINKS } from "@/lib/landing";

/**
 * Full-viewport footer, fixed at z-0 behind #page.
 *
 * It is uncovered as the page scrolls past its end — <ScrollEffects /> sets
 * `#page { margin-bottom: <this footer's height> }` so there is somewhere to
 * scroll to. It must therefore render as a sibling of #page, never inside it,
 * or it scrolls away with everything else and the effect is nothing.
 */
export function SiteFooter() {
  return (
    <footer className="bigfoot" id="bigfoot">
      <div className="wrap">
        <div className="bf-top">
          <h2 className="bf-head">Grow your bag, automatically.</h2>
          <div className="bf-links">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.label} href={link.href}>
                {link.label}
              </Link>
            ))}
            <a href="https://x.com/SafexBNB" target="_blank" rel="noopener noreferrer">
              X
            </a>
          </div>
        </div>

        <div className="bf-bottom">
          <div className="bf-name">
            <span className="wm">SAFEX</span>
          </div>
          <div className="bf-legal">
            © SAFEX 2026
            <br />
            Non-custodial · BNB Chain
          </div>
        </div>

        <p className="bf-disc">{FOOTER_DISCLAIMER}</p>
      </div>
      <a
        className="bf-x"
        href="https://x.com/SafexBNB"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="SAFEX on X"
      >
        <XIcon width={16} height={16} />
      </a>
    </footer>
  );
}
