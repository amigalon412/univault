export type StrategyId = "steady" | "balanced" | "growth";

export interface Strategy {
  id: StrategyId;
  num: string;
  name: string;
  split: string;
  /** Share of the vault kept in stablecoin lending yield. */
  stablePct: number;
  /** Share of the vault held as tokenized stocks. */
  stockPct: number;
  tag: string;
  /** One-line label used in the app's strategy picker. */
  short: string;
  description: string;
  rows: { label: string; pct: string }[];
}

export const STRATEGIES: Strategy[] = [
  {
    id: "steady",
    num: "[01]",
    name: "Steady",
    split: "100 / 0",
    stablePct: 100,
    stockPct: 0,
    tag: "USDG yield · open 24/7",
    short: "Yield floor only",
    description:
      "All stablecoin. Your USDG earns real on-chain lending yield. No stocks, no lockups.",
    rows: [{ label: "USDG yield", pct: "100%" }],
  },
  {
    id: "balanced",
    num: "[02]",
    name: "Balanced",
    split: "60 / 40",
    stablePct: 60,
    stockPct: 40,
    tag: "Yield floor · stocks",
    short: "Yield plus a slice of the market",
    description:
      "60% earning yield, 40% in a curated basket of stock tokens (NVDA · AAPL · TSLA · AMZN), auto-rebalanced.",
    rows: [
      { label: "USDG yield", pct: "60%" },
      { label: "Stocks", pct: "40%" },
    ],
  },
  {
    id: "growth",
    num: "[03]",
    name: "Growth",
    split: "30 / 70",
    stablePct: 30,
    stockPct: 70,
    tag: "Yield floor · stocks",
    short: "Mostly market",
    description:
      "30% yield floor, 70% tokenized stocks. For savers who want their idle cash to chase the market.",
    rows: [
      { label: "USDG yield", pct: "30%" },
      { label: "Stocks", pct: "70%" },
    ],
  },
];

export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
