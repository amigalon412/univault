import { Bracket } from "@/components/Bracket";
import { PixelLogo } from "@/components/PixelLogo";
import { GLYPH_GRID, KEY, PERCENT, ROBOT } from "@/lib/pixel-glyphs";
import type { PixelLogo as PixelLogoData } from "@/lib/pixel-logos";

interface SecurityCard {
  glyph: PixelLogoData;
  num: string;
  title: string;
  body: string;
}

/**
 * Three claims, each drawn rather than labelled.
 *
 * The cards used to be headed with an ASCII box reading `[KEY] 01`, which is a
 * caption pretending to be an illustration: it tells you the word "key" in a
 * frame and shows you nothing. A key, a keeper and a percent sign carry the
 * idea before the heading is read, and they are drawn in the same cell grid as
 * the company marks and the mechanics diagram, so nothing new is introduced.
 *
 * On the fee: the copy no longer says the rate. `setPerformanceFeeBps` is
 * onlyOwner and capped at 2_000 bps, so the current 5% is a setting rather
 * than a property of the vault, and a card is the wrong place to explain that.
 * What is structural — that it touches gains above a high-water mark and never
 * the deposit — is what the card says.
 */
const cards: SecurityCard[] = [
  {
    glyph: KEY,
    num: "01",
    title: "NON-CUSTODIAL BY DESIGN",
    body: "Every position is yours. Withdrawals are permissionless and in-kind, so you get your pro-rata slice back even when markets are closed.",
  },
  {
    glyph: ROBOT,
    num: "02",
    title: "AUTOMATED, BOUNDED",
    body: "An off-chain keeper harvests and rebalances, but on-chain guards cap what it may move — per-call size and slippage limits live on the guard, not in a promise.",
  },
  {
    glyph: PERCENT,
    num: "03",
    title: "REAL YIELD, HONEST FEE",
    body: "Yield is real lending interest, not emissions. The fee is charged on gains above your high-water mark, and never on the deposit itself.",
  },
];

export function SecuritySection() {
  return (
    <section className="border-b border-wire-border px-4 sm:px-6 md:px-8 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-xs text-wire-muted tracking-[0.4em] mb-2">
          {"// WHY BLUR"}
        </div>
        <h2 className="font-mono text-2xl md:text-3xl text-wire-cyan glow-cyan mb-10 leading-snug">
          Built to be trusted.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.map((card) => (
            <div
              key={card.num}
              className="group relative border border-wire-cyan/20 bg-black/30 px-6 py-8 transition-colors hover:border-wire-cyan/45"
            >
              <Bracket at="tl" />
              <Bracket at="br" />

              <div className="flex items-start justify-between">
                <PixelLogo
                  logo={card.glyph}
                  grid={GLYPH_GRID}
                  size={72}
                  className="text-wire-cyan drop-shadow-[0_0_14px_rgba(214,254,81,0.35)]"
                />
                <span className="font-mono text-sm text-wire-cyan/30">
                  {card.num}
                </span>
              </div>

              <div className="font-mono text-sm text-wire-cyan glow-cyan tracking-[0.14em] mt-7">
                {card.title}
              </div>
              <div className="font-mono text-[13px] text-wire-muted leading-relaxed mt-3">
                {card.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
