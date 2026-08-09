import type { StrategyId } from "@/lib/strategies";

/**
 * The three vaults, drawn as how much the position moves.
 *
 * Not the split. The split is already printed beside every one of these
 * ("100 / 0", "60 / 40", "30 / 70"), and the app's picker draws it a second
 * time as a two-tone track — a pie or a ratio bar here would be the same fact
 * three times over in one row.
 *
 * What the numbers do not say is what holding the thing feels like, and that
 * is the one axis the three vaults actually differ along: how far the position
 * wanders off target. So each is one line, and only the amplitude and the
 * frequency change — straight, gentle, choppy.
 *
 * All three start and end at the same height on purpose. A line that climbed
 * would read as a return, and these are vaults, not a track record.
 */
const WAVES: Record<StrategyId, string> = {
  /* Never leaves target — the line sits exactly on the dotted rule beneath it,
     which is the whole claim Steady makes. */
  steady: "M2 11 H26",
  balanced: "M2 11 Q6 5 10 11 T18 11 T26 11",
  growth: "M2 11 Q5 -3 8 11 T14 11 T20 11 T26 11",
};

interface StrategyGlyphProps {
  id: StrategyId;
  className?: string;
}

export function StrategyGlyph({ id, className = "" }: StrategyGlyphProps) {
  return (
    <svg
      className={`strat-glyph ${className}`.trim()}
      viewBox="0 0 28 22"
      width="28"
      height="22"
      aria-hidden="true"
      focusable="false"
    >
      <path className="sg-base" d="M2 11 H26" />
      <path className="sg-wave" d={WAVES[id]} />
    </svg>
  );
}
