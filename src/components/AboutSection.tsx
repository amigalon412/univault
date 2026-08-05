import { Reveal } from "@/components/Reveal";

type AboutCard = {
  title: string;
  body: string;
};

const cards: AboutCard[] = [
  {
    title: "Real lending yield",
    body: "Your USDG earns actual on-chain lending interest — not emissions, not inflationary farm rewards.",
  },
  {
    title: "Curated stock basket",
    body: "A slice of your balance grows into tokenized stock tokens (NVDA · AAPL · TSLA · AMZN), not random tokens.",
  },
  {
    title: "Auto-rebalanced",
    body: "A keeper drifts each vault back to its target split for you — no clicks, no timing the market.",
  },
  {
    title: "Non-custodial",
    body: "Shares live at your own address. Nobody can move, freeze or seize them, and no admin can redirect the assets behind them.",
  },
  {
    title: "In-kind redemption",
    body: "Redeem anytime and get your pro-rata slice of the basket back — even when markets are closed.",
  },
  {
    title: "Honest fee",
    body: "One 5% fee, designed to touch only gains above a high-water mark — never your deposit.",
  },
];

export function AboutSection() {
  return (
    <section id="about" className="px-6 sm:px-8 py-20 md:py-24 scroll-mt-16">
      <div className="max-w-5xl mx-auto">
        {/* Prose first, then the cards a beat later: the paragraph is what the
            section is, the cards are its evidence. */}
        <Reveal>
          <div className="text-sm font-semibold text-wire-cyan mb-3">What is UNIVAULT</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] text-white mb-5 leading-tight">
            Your idle stablecoin, working.
          </h2>
          <p className="text-base text-wire-muted leading-relaxed max-w-3xl mb-12">
            UNIVAULT is a non-custodial auto-yield vault on Robinhood Chain. Deposit{" "}
            <span className="text-white font-medium">USDG</span> once and it earns real
            lending yield, grows a slice into a curated basket of tokenized stocks, and
            rebalances itself toward your target split. An off-chain keeper harvests and
            rebalances, but on-chain guards cap its reach — designed so a compromised keeper
            can never touch your principal. Redeem in-kind, anytime.
          </p>
        </Reveal>
        <Reveal delay={180}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((card) => (
              <div
                key={card.title}
                className="uni-card p-6 hover:border-white/12 hover:bg-wire-raised transition-colors"
              >
                <div className="text-base font-semibold text-white mb-2">{card.title}</div>
                <div className="text-sm text-wire-muted leading-relaxed">{card.body}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
