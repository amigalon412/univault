import type { ReactNode } from "react";

interface EmptyCardProps {
  title: string;
  badge: string;
  body: string;
  /** Optional caption rendered under the card body, e.g. a guarantee line. */
  caption?: string;
  children?: ReactNode;
}

export function EmptyCard({ title, badge, body, caption, children }: EmptyCardProps) {
  return (
    <section className="uni-card p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-xs text-wire-muted">{badge}</span>
      </div>
      <div className="rounded-2xl border border-dashed border-wire-border px-8 py-12">
        <p className="text-sm text-wire-muted text-center leading-relaxed">{body}</p>
      </div>
      {children}
      {caption && (
        <div className="text-xs text-wire-muted text-center mt-5">{caption}</div>
      )}
    </section>
  );
}
