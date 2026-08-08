import { Fragment } from "react";
import Link from "next/link";
import { VaultMark, XIcon } from "@/components/icons";
import { ConnectButton } from "@/components/ConnectButton";
import { NAV_LINKS } from "@/lib/landing";

/**
 * Sticky nav.
 *
 * `.scrolled` and `.nav-over` are toggled by <ScrollEffects />: the first when
 * the page has moved at all, the second whenever a `[data-nav="over"]` band is
 * behind the bar. Over the hero and the tinted community section it goes
 * transparent with white type; everywhere else it is paper glass.
 */
export function SiteNav() {
  return (
    <nav className="nav">
      <div className="wrap nav-in">
        <Link className="brand" href="/#top">
          <VaultMark className="h-7 w-7 shrink-0" />
          <span className="nm">UNIVAULT</span>
          <span className="beta">Beta</span>
        </Link>

        <div className="nav-links">
          {NAV_LINKS.map((link, i) => (
            <Fragment key={link.href}>
              <a href={link.href}>{link.label}</a>
              {i < NAV_LINKS.length - 1 && <span className="sep">{"//"}</span>}
            </Fragment>
          ))}
        </div>

        <div className="nav-cta">
          <a
            className="nav-icon"
            href="https://x.com/BlurYield"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow on X"
          >
            <XIcon />
          </a>
          <Link className="btn btn-ghost" href="/docs">
            <span className="lbl">Docs</span>
          </Link>
          {/* The connect control lives in the nav on every route, so the app
              page never has to ask twice. Its shell is the primary pill. */}
          <ConnectButton label="Connect" className="btn btn-primary" pill />
        </div>
      </div>
    </nav>
  );
}
