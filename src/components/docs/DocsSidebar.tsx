"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_GROUPS } from "@/lib/docs";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Documentation"
      className="docs-sidebar"
    >
      {DOC_GROUPS.map((group) => (
        <div key={group.label} className="docs-sidebar-group">
          <div className="ui-label">{group.label}</div>
          <ul>
            {group.pages.map((page) => {
              const href = `/docs/${page.slug}`;
              const active = pathname === href;
              return (
                <li key={page.slug}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={
                      "docs-sidebar-link" + (active ? " is-active" : "")
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
