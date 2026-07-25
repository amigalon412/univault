/**
 * L-shaped bracket at one corner of a panel. The same device the launch films
 * use, and the thing that makes the three panels on the homepage read as a set
 * rather than as three unrelated boxes.
 *
 * The parent must be `position: relative`.
 */
export function Bracket({ at }: { at: "tl" | "tr" | "bl" | "br" }) {
  const v = at[0] === "t" ? "top-[-1px]" : "bottom-[-1px]";
  const h = at[1] === "l" ? "left-[-1px]" : "right-[-1px]";
  const bv = at[0] === "t" ? "border-t-2" : "border-b-2";
  const bh = at[1] === "l" ? "border-l-2" : "border-r-2";
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${v} ${h} ${bv} ${bh} z-20 h-4 w-4 border-wire-cyan`}
    />
  );
}
