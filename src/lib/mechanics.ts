import type { Address } from "viem";
import {
  BASKET_ADAPTER,
  BASKET_STOCKS,
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
  /**
   * Constituents to link individually, when the node's own contract is not
   * the useful thing to open.
   */
  holdings?: { symbol: string; token: Address }[];
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
  role: "What you send",
  address: USDG,
};

/** The hub everything passes through. */
export const VAULT_NODE: FlowNode = {
  glyph: VAULT,
  name: "UNIVAULT Vault",
  role: "Mints your shares",
  address: VAULT_ADDRESSES.balanced,
};

/**
 * The two legs it splits into.
 *
 * Deliberately without a ratio. The diagram used to label the connectors 60%
 * and 40%, which is BALANCED's target and nobody else's -- STEADY sends
 * nothing to the basket and GROWTH sends most of it. A number that is right
 * for one vault of three does not belong on a diagram of the machine.
 */
export const LEG_NODES: FlowNode[] = [
  {
    glyph: YIELD,
    name: "Lending leg",
    role: "Steakhouse USDG",
    address: STEAK_USDG,
  },
  {
    glyph: BASKET,
    name: "Stock basket",
    role: "Four names, evenly weighted",
    address: BASKET_ADAPTER,
    /*
     * The four tickers link to the token contracts, not to the adapter.
     *
     * Opening the adapter answers nothing: an explorer's token tab lists
     * balances, and the constituents are configuration held in storage, so
     * until someone deposits it shows an empty contract -- decorated, in
     * practice, with airdropped spam tokens impersonating USDG. Somebody
     * checking whether this is really NVIDIA needs the token contract itself,
     * which is Robinhood's, not ours.
     */
    holdings: BASKET_STOCKS,
  },
];

/** Machinery that keeps it on target. Listed, not wired into the path. */
export const RAIL_NODES: FlowNode[] = [
  { glyph: ORACLE, name: "Oracle", role: "Prices the basket", address: PRICE_ORACLE },
  { glyph: GUARD, name: "Keeper guard", role: "Caps the keeper", address: KEEPER_GUARD },
  { glyph: EXIT, name: "Exit router", role: "Sells a position out", address: EXIT_ROUTER_FALLBACK },
];

/**
 * The same path in words. Each sentence is written against the contract, not
 * against the marketing copy: step 3 says "in the same transaction" because
 * Univault._allocateOnDeposit runs inside deposit(), and step 4 says the
 * keeper is capped because KeeperGuard holds per-call size and slippage caps.
 */
/**
 * Which vault the linked addresses belong to. The machine is identical across
 * the three strategies -- only the target ratio differs -- but the adapter,
 * oracle and guard are deployed per vault, so the diagram has to name whose
 * addresses it is showing.
 */
export const DIAGRAM_VAULT = "BALANCED";

export const TRACE_STEPS: TraceStep[] = [
  {
    num: "01",
    title: "You send USDG",
    body: "An ordinary ERC-20 transfer. Six decimals, not eighteen.",
    links: [{ label: "USDG", address: USDG }],
  },
  {
    num: "02",
    title: "The vault mints shares to your address",
    body:
      "Standard ERC-4626. The shares are yours, and no function on the vault moves the assets behind them anywhere but back to a holder.",
    links: [{ label: "Vault", address: VAULT_ADDRESSES.balanced }],
  },
  {
    num: "03",
    title: "It splits itself in the same transaction",
    body:
      "Part is supplied to the lending venue and the rest buys the four stock tokens, evenly weighted. Your strategy sets the ratio; nobody has to come along later and apply it.",
    links: [
      { label: "Lending", address: STEAK_USDG },
      { label: "Basket", address: BASKET_ADAPTER },
    ],
  },
  {
    num: "04",
    title: "A keeper pulls it back on target",
    body:
      "When the split drifts, automation trades it back. Per-call size and slippage caps live on the guard, so what it may move is bounded on chain.",
    links: [
      { label: "Guard", address: KEEPER_GUARD },
      { label: "Oracle", address: PRICE_ORACLE },
    ],
  },
];
