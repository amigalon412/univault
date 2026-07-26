import type { Address } from "viem";
import {
  BASKET_ADAPTER,
  EXIT_ROUTER_FALLBACK,
  KEEPER_GUARD,
  PRICE_ORACLE,
  STEAK_USDG,
  USDG,
  VAULT_ADDRESSES,
} from "@/lib/chain";
import { BASKET, COIN, EXIT, GUARD, ORACLE, VAULT, YIELD } from "@/lib/pixel-glyphs";
import type { PixelLogo } from "@/lib/pixel-logos";

/**
 * The BALANCED deposit path, as data.
 *
 * Kept out of the component so that a wrong address or a wrong sentence is a
 * one-line edit and not a re-layout, and so scripts/check-addresses.mjs has a
 * single place to look.
 *
 * BALANCED and not one of the others: STEADY has no equity leg and GROWTH is
 * the same machine at a different ratio, so BALANCED is the only one of the
 * three that shows every part.
 */

export interface FlowNode {
  glyph: PixelLogo;
  name: string;
  /** One line, upper case on screen. What this part is for. */
  role: string;
  /** Null renders the node without a link rather than with a dead one. */
  address: Address | null;
}

export interface TraceStep {
  num: string;
  title: string;
  body: string;
  links: { label: string; address: Address | null }[];
}

/** Where the money enters. */
export const SOURCE_NODE: FlowNode = {
  glyph: COIN,
  name: "USDG",
  role: "WHAT YOU SEND",
  address: USDG,
};

/** The hub everything passes through. */
export const VAULT_NODE: FlowNode = {
  glyph: VAULT,
  name: "BLUR VAULT",
  role: "MINTS YOUR SHARES",
  address: VAULT_ADDRESSES.balanced,
};

/** The two legs it splits into, with the target split for BALANCED. */
export const LEG_NODES: (FlowNode & { pct: string })[] = [
  {
    glyph: YIELD,
    name: "LENDING LEG",
    role: "STEAKHOUSE USDG",
    address: STEAK_USDG,
    pct: "60%",
  },
  {
    glyph: BASKET,
    name: "STOCK BASKET",
    role: "NVDA · AAPL · TSLA · AMZN",
    address: BASKET_ADAPTER,
    pct: "40%",
  },
];

/** Machinery that keeps it on target. Listed, not wired into the path. */
export const RAIL_NODES: FlowNode[] = [
  { glyph: ORACLE, name: "ORACLE", role: "PRICES THE BASKET", address: PRICE_ORACLE },
  { glyph: GUARD, name: "KEEPER GUARD", role: "CAPS THE KEEPER", address: KEEPER_GUARD },
  { glyph: EXIT, name: "EXIT ROUTER", role: "SELLS A POSITION OUT", address: EXIT_ROUTER_FALLBACK },
];

/**
 * The same path in words. Each sentence is written against the contract, not
 * against the marketing copy: step 3 says "in the same transaction" because
 * BlurVault._allocateOnDeposit runs inside deposit(), and step 4 says the
 * keeper is capped because KeeperGuard holds per-call size and slippage caps.
 */
export const TRACE_STEPS: TraceStep[] = [
  {
    num: "01",
    title: "YOU SEND USDG",
    body: "An ordinary ERC-20 transfer. Six decimals, not eighteen.",
    links: [{ label: "USDG", address: USDG }],
  },
  {
    num: "02",
    title: "THE VAULT MINTS SHARES TO YOUR ADDRESS",
    body:
      "Standard ERC-4626. The shares are yours, and no function on the vault moves the assets behind them anywhere but back to a holder.",
    links: [{ label: "VAULT", address: VAULT_ADDRESSES.balanced }],
  },
  {
    num: "03",
    title: "IT SPLITS ITSELF IN THE SAME TRANSACTION",
    body:
      "60% is supplied to the lending venue, 40% buys the four stock tokens at 25% each. Nobody has to come along later and do it.",
    links: [
      { label: "LENDING", address: STEAK_USDG },
      { label: "BASKET", address: BASKET_ADAPTER },
    ],
  },
  {
    num: "04",
    title: "A KEEPER PULLS IT BACK ON TARGET",
    body:
      "When the split drifts, automation trades it back. Per-call size and slippage caps live on the guard, so what it may move is bounded on chain.",
    links: [
      { label: "GUARD", address: KEEPER_GUARD },
      { label: "ORACLE", address: PRICE_ORACLE },
    ],
  },
];
