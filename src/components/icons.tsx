import type { SVGProps } from "react";

/**
 * The UNIVAULT brand mark.
 *
 * Drawn rather than borrowed on purpose: the site it takes its look from puts a
 * trademarked animal in this slot, and that is the one part of a visual language
 * you cannot copy. This is a plain accent-filled squircle with the wordmark's
 * initial knocked out of it, which sits in the same place and carries the same
 * weight without pretending to be someone else's logo.
 *
 * The knockout is painted in the page surface colour rather than left
 * transparent, so the mark reads the same over the falling-logo canvas as it
 * does over a card.
 */
export function VaultMark({
  width = 28,
  height = 28,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...props}
    >
      <rect width="24" height="24" rx="7.5" fill="currentColor" />
      <path
        d="M8.4 6.6v6.2a3.6 3.6 0 0 0 7.2 0V6.6"
        stroke="#131313"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function XIcon({
  width = 15,
  height = 15,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}
