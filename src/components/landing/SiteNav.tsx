import { Fragment } from "react";
import Link from "next/link";
import { CaPill } from "@/components/CaPill";
import { XIcon } from "@/components/icons";
import { ConnectButton } from "@/components/ConnectButton";
import { NAV_LINKS } from "@/lib/landing";
import { readSiteConfig } from "@/lib/site-config";

/**
 * Sticky nav.
 *
 * `.scrolled` and `.nav-over` are toggled by <ScrollEffects />: the first when
 * the page has moved at all, the second whenever a `[data-nav="over"]` band is
 * behind the bar. Over the hero and the tinted community section it goes
 * transparent with white type; everywhere else it is paper glass.
 *
 * Async because the CA pill needs the published address on the server: read on
 * the client only, the first paint after launch would say "not live yet" and
 * call the real contract a fake for a frame — on the one day everybody is
 * looking. <CaPill /> re-fetches after mount regardless, so publishing from
 * /admin still lands without a rebuild.
 */
export async function SiteNav() {
  const { blurToken } = await readSiteConfig();

  return (
    <nav className="nav">
      <div className="wrap nav-in">
        <Link className="brand" href="/#top">
          <span className="nm">UNIVAULT</span>
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
          <CaPill initial={blurToken} />
          <a
            className="nav-icon"
            href="https://x.com/univaultpro"
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
