import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/landing/SiteNav";
import { PageFooter } from "@/components/landing/PageFooter";
import { DocBody } from "@/components/docs/DocBody";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DOC_PAGES, getDocNeighbours, getDocPage, resolveDocPage } from "@/lib/docs";
import { readSiteConfig } from "@/lib/site-config";
import { AnimationGovernor } from "@/components/AnimationGovernor";

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const stored = getDocPage(slug);
  if (!stored) return { title: "SAFEX — Docs" };
  // Resolved here too, or the share card for the token page keeps announcing
  // that the token has not launched after it has.
  const { safexToken } = await readSiteConfig();
  const page = resolveDocPage(stored, safexToken);
  return {
    title: `${page.title} — SAFEX docs`,
    description: page.intro[0],
  };
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const stored = getDocPage(slug);
  if (!stored) notFound();

  // Read on the server, per request, so publishing the address from /admin
  // rewrites the docs on the next load -- no rebuild and no edit to docs.ts.
  const { safexToken } = await readSiteConfig();
  const page = resolveDocPage(stored, safexToken);

  const { prev, next } = getDocNeighbours(slug);

  return (
    <main className="page-enter">
      <AnimationGovernor />
      <SiteNav />
      <div className="wrap docs-shell">
        <div className="docs-grid">
          <aside className="docs-aside">
            <DocsSidebar />
          </aside>

          <article className="docs-article">
            <span className="eyebrow">{"// Docs"}</span>
            <h1 className="docs-title">{page.title}</h1>
            {page.intro.map((text) => (
              <p key={text} className="docs-intro">
                {text}
              </p>
            ))}

            {page.sections.map((section) => (
              <section key={section.id} id={section.id} className="docs-section">
                <h2>{section.title}</h2>
                <DocBody blocks={section.blocks} />
              </section>
            ))}

            <div className="docs-nav">
              {prev && (
                <Link
                  href={`/docs/${prev.slug}`}
                  className="card docs-nav-card"
                >
                  <span className="ui-label">← Previous</span>
                  <b>{prev.title}</b>
                </Link>
              )}
              {next && (
                <Link
                  href={`/docs/${next.slug}`}
                  className="card docs-nav-card is-next"
                >
                  <span className="ui-label">Next →</span>
                  <b>{next.title}</b>
                </Link>
              )}
            </div>
          </article>

          <aside className="docs-toc">
            <div className="docs-toc-inner">
              <div className="ui-label">On this page</div>
              <ul>
                {page.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="docs-toc-link"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
      <PageFooter />
    </main>
  );
}
