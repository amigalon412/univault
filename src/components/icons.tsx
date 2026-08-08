import type { SVGProps } from "react";

/** X (Twitter) glyph. Sized by `.nav-icon svg` where it appears in the nav. */
export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** Arrow-right, for the circular `.arw` badge inside a primary pill. */
export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * The UNIVAULT mark: a vault door, drawn flat.
 *
 * A squircle with a ring and four bolts. Deliberately geometric and monoline
 * so it reads at 24px in the nav and at 60px in the footer without a second
 * artwork, and so it inherits `currentColor` — the nav flips the whole bar to
 * white over a dark band, and the mark has to come with it.
 */
export function VaultMark({
  width = 28,
  height = 28,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" width={width} height={height} {...props}>
      <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="9" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M16 6.5v3M16 22.5v3M6.5 16h3M22.5 16h3"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}
