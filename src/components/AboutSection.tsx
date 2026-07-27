import { AsciiRule } from "@/components/AsciiRule";
import { Reveal } from "@/components/Reveal";

type AboutCard = {
  title: string;
  body: string;
};

const cards: AboutCard[] = [
  {
    title: "REAL LENDING YIELD",
    body: "Your USDG earns actual on-chain lending interest — not emissions, not inflationary farm rewards.",
  },
  {
    title: "CURATED STOCK BASKET",
    body: "A slice of your balance grows into tokenized stock tokens (NVDA · AAPL · TSLA · AMZN), not random tokens.",
  },
  {
    title: "AUTO-REBALANCED",
    body: "A keeper drifts each vault back to its target split for you — no clicks, no timing the market.",
  },
  {
    title: "NON-CUSTODIAL",
    body: "Shares live at your own address. Nobody can move, freeze or seize them, and no admin can redirect the assets behind them.",
  },
  {
    title: "IN-KIND REDEMPTION",
    body: "Redeem anytime and get your pro-rata slice of the basket back — even when markets are closed.",
  },
  {
    title: "HONEST FEE",
    body: "One 5% fee, designed to touch only gains above a high-water mark — never your deposit.",
  },
];

export function AboutSection() {
  return (
    <section id="about" className="border-b border-wire-border px-8 py-20 scroll-mt-16">
      <div className="max-w-5xl mx-auto">
        {/* Prose first, then the cards a beat later: the paragraph is what the
            section is, the three cards are its evidence. */}
        <Reveal>
          <div className="font-mono text-xs text-wire-muted tracking-[0.4em] mb-2">{"// WHAT IS BLUR"}</div>
          <AsciiRule className="text-[10px] text-wire-border mb-10" />
          <h2 className="font-mono text-2xl md:text-3xl text-wire-cyan glow-cyan mb-6 leading-snug md:leading-9">Your idle stablecoin, working.</h2>
          <p className="font-mono text-sm text-wire-muted leading-relaxed max-w-3xl mb-10">
            BLUR is a non-custodial auto-yield vault on Robinhood Chain. Deposit{" "}
            <span className="text-wire-cyan">USDG</span> once and it earns real lending yield, grows a
            slice into a curated basket of tokenized stocks, and rebalances itself toward your target
            split. An off-chain keeper harvests and rebalances, but on-chain guards cap its reach —
            designed so a compromised keeper can never touch your principal. Redeem in-kind, anytime.
          </p>
        </Reveal>
        <Reveal delay={180}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-wire-border">
            {cards.map((card) => (
              <div key={card.title} className="bg-black p-6 hover:bg-wire-card transition-colors">
                <div className="font-mono text-sm text-wire-cyan glow-cyan mb-2">{card.title}</div>
                <div className="font-mono text-xs text-wire-muted leading-relaxed">{card.body}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
