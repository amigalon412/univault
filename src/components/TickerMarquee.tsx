const PHRASES = [
  "Grow your bag",
  "Real lending yield",
  "Auto-rebalanced",
  "Curated stock basket",
  "Yield floor always on",
  "Your address, your funds",
  "Robinhood Chain",
  "Non-custodial",
];

export function TickerMarquee() {
  return (
    <div className="border-y border-wire-border bg-wire-card/60 overflow-hidden py-3">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...PHRASES, ...PHRASES].map((phrase, i) => (
          <span key={`${phrase}-${i}`} className="flex items-center text-sm text-wire-muted mx-8">
            {phrase}
            <span aria-hidden className="ml-8 h-1.5 w-1.5 rounded-full bg-wire-cyan/70" />
          </span>
        ))}
      </div>
    </div>
  );
}
