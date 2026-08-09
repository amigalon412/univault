import { defineChain, getAddress, type Address } from "viem";
import type { StrategyId } from "@/lib/strategies";

/**
 * Robinhood Chain. An Arbitrum Orbit L2 whose gas token is ETH; the stablecoin
 * we take deposits in (USDG) is an ordinary ERC-20 on top.
 *
 * Confirmed against the live chain: eth_chainId returns 0x1237 (4663), and the
 * explorer's own stats endpoint reports ETH as the native coin.
 */
export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
  contracts: {
    // Multicall3 at its canonical cross-chain address; confirmed deployed here.
    // Without this viem refuses to batch, and every read becomes its own call.
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});

/** Global Dollar. Six decimals, not eighteen -- do not assume. */
export const USDG: Address = getAddress(
  "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
);
export const USDG_DECIMALS = 6;

/**
 * Steakhouse USDG, the MetaMorpho vault the lending leg supplies into. Its
 * share price is where the base yield actually shows up.
 */
export const STEAK_USDG: Address = getAddress(
  "0xBeEff033F34C046626B8D0A041844C5d1A5409dd",
);

/**
 * The rest of the BALANCED vault's machinery, addressed here rather than in a
 * component because that is where every other address on this chain lives.
 *
 * BALANCED is the strategy the homepage diagram traces: it is the only one of
 * the three that exercises both legs, so it is the only one that shows the
 * whole machine. GROWTH has its own adapter, oracle and guard; STEADY has no
 * basket at all. See contracts/DEPLOYMENTS.md.
 */
export const BASKET_ADAPTER: Address = getAddress(
  "0x8449202B6525F9632eB25809B91B50c1820fAAE4",
);
export const PRICE_ORACLE: Address = getAddress(
  "0x932aa45036045540dbfab7252bd3398f35f32e76",
);
export const KEEPER_GUARD: Address = getAddress(
  "0x35304Ceb350C6ab8d93f99C002d268DbA4Ff0613",
);

/**
 * The deployed ExitRouter, for display only.
 *
 * `EXIT_ROUTER` below reads the environment and is null until it is set, which
 * is right for the app -- it must not offer a button backed by nothing. The
 * homepage is describing what exists on chain, not offering to call it, so it
 * uses this constant and always has something to link to.
 */
export const EXIT_ROUTER_FALLBACK: Address = getAddress(
  "0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0",
);

/**
 * Chainlink USD feeds for the basket, 8 decimals each, confirmed on-chain.
 *
 * A feed is not a tradable asset -- SPY has a feed here and no token, which is
 * exactly the trap that put SPY in the basket copy once. These are listed for
 * display only.
 *
 * Exactly the four the baskets hold, and no more. AMD's feed was in this list
 * and it put an AMD price card on the landing page next to four the vault
 * actually owns, which reads as a fifth holding. Its pool is hooked and empty
 * so it can never be one -- see BASKET_STOCKS below.
 */
export const STOCK_FEEDS: { symbol: string; feed: Address }[] = [
  { symbol: "NVDA", feed: getAddress("0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15") },
  { symbol: "AAPL", feed: getAddress("0x6B22A786bAa607d76728168703a39Ea9C99f2cD0") },
  { symbol: "TSLA", feed: getAddress("0x4A1166a659A55625345e9515b32adECea5547C38") },
  { symbol: "AMZN", feed: getAddress("0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C") },
];

/**
 * The tradable stock tokens the BALANCED and GROWTH baskets hold, four names at
 * 25% each. Addresses read on-chain from the deployed BasketAdapter; the same
 * four in both baskets. AMD is deliberately absent -- its pool is hooked and
 * empty, so it was never added as a constituent.
 *
 * These are the tokens, not the price feeds in STOCK_FEEDS: a feed is a number,
 * a token is a thing the vault can actually own.
 */
export const BASKET_STOCKS: { symbol: string; token: Address }[] = [
  { symbol: "NVDA", token: getAddress("0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC") },
  { symbol: "AAPL", token: getAddress("0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9") },
  { symbol: "TSLA", token: getAddress("0x322F0929c4625eD5bAd873c95208D54E1c003b2d") },
  { symbol: "AMZN", token: getAddress("0x12f190a9F9d7D37a250758b26824B97CE941bF54") },
];

/**
 * Reads an address out of the environment, returning null rather than throwing
 * when it is absent or malformed.
 *
 * A missing vault address is the normal state before a deployment, and the UI
 * is built to say so. What it must never do is silently treat a typo as a real
 * contract: getAddress rejects a bad checksum, and anything it rejects becomes
 * null, which surfaces as "not deployed" instead of failed calls to nowhere.
 */
function optionalAddress(value: string | undefined): Address | null {
  if (!value) return null;
  try {
    return getAddress(value.trim());
  } catch {
    return null;
  }
}

/**
 * The deployed vaults, one per strategy. Live and source-verified on Robinhood
 * Chain mainnet since 2026-07-23 -- the addresses, their deploy blocks and
 * their oracles are recorded in contracts/DEPLOYMENTS.md, which is the source
 * these are copied from.
 *
 * They are defaults in the code rather than environment-only values because
 * NEXT_PUBLIC_* is inlined at build time from .env.local, and .env.local is
 * gitignored. A fresh clone therefore built with no addresses at all, and the
 * app said "no contracts deployed" -- correct about its own configuration, and
 * wrong about the world, which is the worst combination a notice can manage.
 *
 * Nothing is lost by committing them: NEXT_PUBLIC_* ships in the client bundle
 * regardless, so these are public the moment anyone loads the page.
 */
const MAINNET_VAULTS: Record<StrategyId, string> = {
  steady: "0x583bce228448814bc42235d4761290f3ac710a09",
  balanced: "0x796c05567cf6e00b3a9c453c3c67a5b2a7cd65e7",
  growth: "0xd9a66ef89fe6b2a129b6b78f953d2a89bb7ce04c",
};

/**
 * An environment value still wins, which is what a fork, a testnet build or a
 * redeployment sets.
 *
 * Next.js inlines NEXT_PUBLIC_* only at literal property accesses, so each one
 * has to be spelled out here rather than looked up by a computed key.
 */
export const VAULT_ADDRESSES: Record<StrategyId, Address | null> = {
  steady: optionalAddress(process.env.NEXT_PUBLIC_VAULT_STEADY || MAINNET_VAULTS.steady),
  balanced: optionalAddress(
    process.env.NEXT_PUBLIC_VAULT_BALANCED || MAINNET_VAULTS.balanced,
  ),
  growth: optionalAddress(process.env.NEXT_PUBLIC_VAULT_GROWTH || MAINNET_VAULTS.growth),
};

export const DEPLOYED_VAULTS = Object.entries(VAULT_ADDRESSES).filter(
  (entry): entry is [StrategyId, Address] => entry[1] !== null,
);

/**
 * The $UNIVAULT token, once it exists. Null until then, and the UI says so rather
 * than showing a placeholder anyone could mistake for the real contract --
 * before a launch a wrong "CA" is exactly what a scammer wants circulating.
 */
export const BLUR_TOKEN = optionalAddress(process.env.NEXT_PUBLIC_BLUR_TOKEN);

/**
 * The ExitRouter. Lets a holder of a basketed vault sell the stock leg to USDG
 * in one transaction instead of receiving stock tokens in kind; without it the
 * "sell everything" control simply doesn't render.
 *
 * Deployed 2026-07-24 at block 17686207, ownerless and holding no funds. A
 * committed default for the same reason the vaults have one -- a clone with no
 * .env.local was hiding a control that works.
 */
export const EXIT_ROUTER = optionalAddress(
  process.env.NEXT_PUBLIC_EXIT_ROUTER || "0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0",
);

/** Minimal ExitRouter ABI: the one function the UI calls. */
export const exitRouterAbi = [
  {
    type: "function",
    name: "exitToStable",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "shares", type: "uint256" },
      { name: "minStableOut", type: "uint256" },
    ],
    outputs: [{ name: "totalStable", type: "uint256" }],
  },
] as const;

/** True when no vault has been deployed yet, i.e. the app is display-only. */
export const NOTHING_DEPLOYED = DEPLOYED_VAULTS.length === 0;

export function explorerAddressUrl(address: Address): string {
  return `${robinhoodChain.blockExplorers.default.url}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${robinhoodChain.blockExplorers.default.url}/tx/${hash}`;
}
