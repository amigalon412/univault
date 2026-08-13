import type { Address } from "viem";
import { KEEPER_GUARD, PRICE_ORACLE, STABLE_SYMBOL, STEAK_USDG, USDG, VAULT_ADDRESSES } from "@/lib/chain";

/**
 * Copy for the landing page.
 *
 * Kept out of the components so the page reads as one document when you want
 * to change what it says, rather than as nine files you have to visit in turn.
 * Everything factual here — addresses, splits, the fee — is sourced from
 * lib/chain.ts and lib/strategies.ts, never retyped.
 */

export interface TextSegment {
  text: string;
  /** Rendered in the hero's bright accent. */
  highlight?: boolean;
}

/** One rotating headline. Two stacked lines, each a run of segments. */
export interface HeroSlide {
  lineOne: TextSegment[];
  lineTwo: TextSegment[];
}

/**
 * One item in the top nav.
 *
 * `soon` items render inert -- no href, not focusable, not a link. A greyed
 * anchor that still navigates is worse than no anchor at all, because the one
 * person who clicks it is the one who came looking for that exact thing.
 */
export interface NavLink {
  label: string;
  href?: string;
  soon?: boolean;
}

export const NAV_LINKS: readonly NavLink[] = [
  { label: "How it works", href: "/#how" },
  { label: "Vaults", href: "/#vaults" },
  /* Announced, not built. There is no staking contract and no token yet, so
     this points nowhere on purpose -- see contracts/DEPLOYMENTS.md. */
  { label: "Staking", soon: true },
  { label: "Ecosystem", href: "/#ecosystem" },
  { label: "Live", href: "/#community" },
];

export const HERO_SLIDES: HeroSlide[] = [
  {
    lineOne: [{ text: "Your stablecoin," }],
    lineTwo: [{ text: "working", highlight: true }, { text: " by itself" }],
  },
  {
    lineOne: [{ text: "Earn " }, { text: "real", highlight: true }],
    lineTwo: [{ text: "lending yield" }],
  },
  {
    lineOne: [{ text: "A basket that" }],
    lineTwo: [{ text: "rebalances", highlight: true }, { text: " itself" }],
  },
];

export const HERO_NOTE = {
  eyebrow: "// SAFEX engine",
  body: "Deposit once. The vault lends the balance out for real interest, grows a slice into tokenized stocks, and a guarded keeper pulls it back on target — on-chain, on BNB Chain.",
} as const;

/** Which diagram <StepDiagram /> draws on a step's plate. */
export type StepArt = "deposit" | "split" | "rebalance";

/** A step in "how one deposit moves", with the contracts it touches. */
export interface HowStep {
  num: string;
  /** Doubles as the plate's label and the key for its diagram. */
  caption: StepArt;
  title: string;
  body: string;
  links: { label: string; address: Address | null }[];
}

export const HOW_STEPS: HowStep[] = [
  {
    num: "[ 01 ]",
    caption: "deposit",
    title: `You send ${STABLE_SYMBOL}`,
    body: "An ordinary ERC-20 transfer into an ERC-4626 vault. Shares are minted to your own address, and no function on the vault can move the assets behind them anywhere but back to a holder.",
    links: [
      { label: STABLE_SYMBOL, address: USDG },
      { label: "Vault", address: VAULT_ADDRESSES.balanced },
    ],
  },
  {
    num: "[ 02 ]",
    caption: "split",
    title: "It splits in the same transaction",
    body: "Part is supplied to the lending venue for real interest; the rest buys the stock tokens, evenly weighted. Your strategy sets the ratio — nobody has to come along later and apply it.",
    links: [{ label: "Lending", address: STEAK_USDG }],
  },
  {
    num: "[ 03 ]",
    caption: "rebalance",
    title: "A keeper pulls it back on target",
    body: "When the split drifts, automation trades it back. Per-call size and slippage ceilings live on the guard contract, so what the keeper may move is bounded on-chain rather than promised.",
    links: [
      { label: "Guard", address: KEEPER_GUARD },
      { label: "Oracle", address: PRICE_ORACLE },
    ],
  },
];

/** One cell of the ecosystem grid. PNGs are used as masks — alpha only. */
export interface EcosystemLogo {
  name: string;
  mask: string;
  /** Brand colour the mark takes on hover, via the --bc custom property. */
  accent: string;
}

/**
 * Three cells short of what it should be, and deliberately so.
 *
 * USDG, Uniswap and Blockscout were all true on Robinhood Chain and are all
 * false here: the stable is USDT, the venue is PancakeSwap v3, the explorer is
 * BscScan. There are no logo masks in the repo for the replacements, and a grid
 * that names venues this build does not touch is worse than a short one --
 * somebody checks a claim like that, and finds it wrong.
 *
 * To fill it back out, add usdt.png, pancakeswap.png and bscscan.png to
 * public/images/logos (alpha-only, they are used as CSS masks) and put the
 * three rows back with the accents #26a17b, #1fc7d4 and #f0b90b.
 */
export const ECOSYSTEM_LOGOS: EcosystemLogo[] = [
  { name: "BNB Chain", mask: "/images/logos/bnb.png", accent: "#f0b90b" },
  { name: "MetaMask", mask: "/images/logos/metamask.png", accent: "#e2761b" },
  { name: "Ethereum", mask: "/images/logos/ethereum.png", accent: "#627eea" },
];

/** The satellites orbiting the launchpad core — the basket, literally. */
/**
 * The holdings orbiting the vault mark.
 *
 * All eight, not a sample: the ring is the one place on the page that says
 * "this is what the basket is", and showing half of it read as the whole of
 * it while the picker below listed more.
 *
 * Durations are all different and none is a multiple of another, so the marks
 * never bunch into a line and then repeat the same arrangement. The delays are
 * spread across each orbit's own period rather than a shared step — with one
 * step the fast ones lap the slow ones into a cluster within a minute.
 */
export const ORBIT_SATELLITES = [
  { sym: "NVDA", duration: "22s" },
  { sym: "AAPL", duration: "28s", delay: "-7s" },
  { sym: "TSLA", duration: "34s", delay: "-14s" },
  { sym: "AMZN", duration: "40s", delay: "-21s" },
  { sym: "GOOGL", duration: "26s", delay: "-13s" },
  { sym: "MSFT", duration: "31s", delay: "-24s" },
  { sym: "SPCX", duration: "37s", delay: "-5s" },
  { sym: "PLTR", duration: "43s", delay: "-32s" },
] as const;

/** The three closing claims, after the evidence rather than before it. */
export const WHY_CARDS = [
  {
    num: "[ 01 ]",
    title: "Your keys",
    body: "Every position is a share balance at your own address. Withdrawal is permissionless and can be paid in-kind — your pro-rata slice of the basket comes back even when the market is closed.",
  },
  {
    num: "[ 02 ]",
    title: "The keeper is on a leash",
    body: "It harvests and rebalances, and that is all it can do. Per-call size and slippage limits are enforced by the guard contract, so a compromised keeper cannot reach your principal.",
  },
  {
    num: "[ 03 ]",
    title: "5% of gains only",
    body: "Charged above your high-water mark and never on the deposit itself. The yield underneath it is real lending interest paid by borrowers, not emissions from a token printer.",
  },
] as const;

export const FOOTER_LINKS = [
  { label: "App", href: "/app" },
  { label: "Docs", href: "/docs" },
  { label: "How it works", href: "/#how" },
  { label: "Vaults", href: "/#vaults" },
  { label: "Ecosystem", href: "/#ecosystem" },
  { label: "Live", href: "/#community" },
] as const;

export const FOOTER_DISCLAIMER =
  "SAFEX is non-custodial software running on BNB Chain. Nothing here is financial advice, and no return is promised or guaranteed — yield comes from third-party lending venues and the market value of tokenized stocks, both of which can fall. Tokenized stock exposure is not available to US persons. Read the contracts before you deposit.";
