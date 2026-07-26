import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { DocBody } from "@/components/docs/DocBody";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DOC_PAGES, getDocNeighbours, getDocPage, resolveDocPage } from "@/lib/docs";
import { readSiteConfig } from "@/lib/site-config";
import { AsciiRule } from "@/components/AsciiRule";
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
  if (!stored) return { title: "BLUR — Docs" };
  // Resolved here too, or the share card for /docs/blur-token keeps announcing
  // that the token has not launched after it has.
  const { blurToken } = await readSiteConfig();
  const page = resolveDocPage(stored, blurToken);
  return {
    title: `${page.title} — BLUR docs`,
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
  const { blurToken } = await readSiteConfig();
  const page = resolveDocPage(stored, blurToken);

  const { prev, next } = getDocNeighbours(slug);

  return (
    <main className="min-h-screen bg-black text-wire-cyan overflow-x-hidden page-enter">
      <AnimationGovernor />
      <NavBar />
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_210px] gap-10">
          <aside className="hidden lg:block border-r border-wire-border pr-5">
            <DocsSidebar />
          </aside>

          <article className="min-w-0">
            <div className="font-mono text-sm text-wire-muted tracking-[0.4em] mb-3">
              {"// DOCS"}
            </div>
            <h1 className="font-mono text-4xl md:text-5xl text-wire-cyan glow-cyan mb-8 leading-tight">
              {page.title}
            </h1>
            {page.intro.map((text) => (
              <p
                key={text}
                className="font-mono text-base text-wire-muted leading-relaxed mb-5"
              >
                {text}
              </p>
            ))}

            {page.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24 mt-12">
                <h2 className="font-mono text-2xl text-wire-cyan glow-cyan mb-3 tracking-wide">
                  {section.title}
                </h2>
                <AsciiRule className="text-xs text-wire-cyan/40 mb-6" length={44} />
                <DocBody blocks={section.blocks} />
              </section>
            ))}

            <div className="flex flex-col sm:flex-row gap-4 mt-16 pt-8 border-t border-wire-border">
              {prev && (
                <Link
                  href={`/docs/${prev.slug}`}
                  className="flex-1 border border-wire-border px-5 py-4 hover:border-wire-cyan transition-all group"
                >
                  <div className="font-mono text-xs text-wire-muted tracking-[0.3em] mb-1.5">
                    ← PREVIOUS
                  </div>
                  <div className="font-mono text-base text-wire-cyan group-hover:glow-cyan transition-all">
                    {prev.title}
                  </div>
                </Link>
              )}
              {next && (
                <Link
                  href={`/docs/${next.slug}`}
                  className="flex-1 border border-wire-border px-5 py-4 hover:border-wire-cyan transition-all group sm:text-right"
                >
                  <div className="font-mono text-xs text-wire-muted tracking-[0.3em] mb-1.5">
                    NEXT →
                  </div>
                  <div className="font-mono text-base text-wire-cyan group-hover:glow-cyan transition-all">
                    {next.title}
                  </div>
                </Link>
              )}
            </div>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <div className="font-mono text-sm text-wire-muted tracking-[0.3em] mb-4">
                {"// ON THIS PAGE"}
              </div>
              <ul className="space-y-2.5">
                {page.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="font-mono text-sm text-wire-cyan/85 hover:text-wire-cyan hover:glow-cyan transition-all leading-relaxed"
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
      <Footer />
    </main>
  );
}
