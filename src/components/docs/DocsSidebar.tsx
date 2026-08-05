"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_GROUPS } from "@/lib/docs";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Documentation"
      className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto pb-6"
    >
      {DOC_GROUPS.map((group) => (
        <div key={group.label} className="mb-9">
          <div className="text-xs font-semibold uppercase tracking-wider text-wire-muted mb-4">
            {group.label}
          </div>
          <ul className="space-y-1">
            {group.pages.map((page) => {
              const href = `/docs/${page.slug}`;
              const active = pathname === href;
              return (
                <li key={page.slug}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={
                      "flex items-center gap-2.5 rounded-xl text-sm px-3 py-2 transition-colors " +
                      (active
                        ? "bg-wire-cyan/12 text-wire-cyan font-medium"
                        : "text-wire-muted hover:text-white hover:bg-white/5")
                    }
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
