import type { Address } from "viem";
import { KEEPER_GUARD, PRICE_ORACLE, STEAK_USDG, USDG, VAULT_ADDRESSES } from "@/lib/chain";

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

export const NAV_LINKS = [
  { label: "How it works", href: "/#how" },
  { label: "Vaults", href: "/#vaults" },
  { label: "Ecosystem", href: "/#ecosystem" },
  { label: "Live", href: "/#community" },
] as const;

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
  eyebrow: "// UNIVAULT engine",
  body: "Deposit once. The vault lends the balance out for real interest, grows a slice into tokenized stocks, and a guarded keeper pulls it back on target — on-chain, on Robinhood Chain.",
} as const;

/** A step in "how one deposit moves", with the contracts it touches. */
export interface HowStep {
  num: string;
  caption: string;
  title: string;
  body: string;
  links: { label: string; address: Address | null }[];
}

export const HOW_STEPS: HowStep[] = [
  {
    num: "[ 01 ]",
    caption: "deposit",
    title: "You send USDG",
    body: "An ordinary ERC-20 transfer into an ERC-4626 vault. Shares are minted to your own address, and no function on the vault can move the assets behind them anywhere but back to a holder.",
    links: [
      { label: "USDG", address: USDG },
      { label: "Vault", address: VAULT_ADDRESSES.balanced },
    ],
  },
  {
    num: "[ 02 ]",
    caption: "split",
    title: "It splits in the same transaction",
    body: "Part is supplied to the lending venue for real interest; the rest buys the four stock tokens, evenly weighted. Your strategy sets the ratio — nobody has to come along later and apply it.",
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

export const ECOSYSTEM_LOGOS: EcosystemLogo[] = [
  { name: "Robinhood Chain", mask: "/images/logos/robinhood.png", accent: "#00c805" },
  { name: "USDG", mask: "/images/logos/usdg.png", accent: "#2775ca" },
  { name: "Uniswap", mask: "/images/logos/uniswap.png", accent: "#ff007a" },
  { name: "MetaMask", mask: "/images/logos/metamask.png", accent: "#e2761b" },
  { name: "Blockscout", mask: "/images/logos/blockscout.png", accent: "#5353d3" },
  { name: "Ethereum", mask: "/images/logos/ethereum.png", accent: "#627eea" },
];

/** The satellites orbiting the launchpad core — the basket, literally. */
export const ORBIT_SATELLITES = [
  { sym: "NVDA", duration: "22s" },
  { sym: "AAPL", duration: "28s", delay: "-7s" },
  { sym: "TSLA", duration: "34s", delay: "-14s" },
  { sym: "AMZN", duration: "40s", delay: "-21s" },
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
  "UNIVAULT is non-custodial software running on Robinhood Chain. Nothing here is financial advice, and no return is promised or guaranteed — yield comes from third-party lending venues and the market value of tokenized stocks, both of which can fall. Tokenized stock exposure is not available to US persons. Read the contracts before you deposit.";
