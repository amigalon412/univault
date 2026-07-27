"use client";

import type { CSSProperties, ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";

/**
 * Wraps a block so it fades up out of a blur when it first reaches the screen.
 *
 * A component rather than a hook call at each site because most of the sections
 * that wanted this -- About, the footer -- are server components, and a hook
 * would have dragged each of them across to the client for the sake of one
 * boolean. Children passed through here stay server-rendered; only this
 * wrapper ships.
 *
 * `delay` staggers siblings. It is spent once, on arrival, so a column of three
 * at 0/120/240ms resolves top-down and then behaves like ordinary markup --
 * there is no ongoing cost and nothing to clean up.
 *
 * The resting state is the visible one. Read .reveal in globals.css before
 * changing anything here: the hidden state is gated on `scripting: enabled`
 * precisely so that this component failing to mount leaves the content on
 * screen rather than erasing it.
 */
export function Reveal({
  children,
  delay = 0,
  threshold,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  threshold?: number;
  className?: string;
  as?: "div" | "section";
}) {
  const { ref, seen } = useReveal<HTMLDivElement>(threshold);

  return (
    <Tag
      ref={ref}
      className={`reveal${seen ? " reveal-in" : ""}${className ? ` ${className}` : ""}`}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
