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
 * Chainlink USD feeds for the basket, 8 decimals each, confirmed on-chain.
 *
 * A feed is not a tradable asset -- SPY has a feed here and no token, which is
 * exactly the trap that put SPY in the basket copy once. These are listed for
 * display only.
 */
export const STOCK_FEEDS: { symbol: string; feed: Address }[] = [
  { symbol: "NVDA", feed: getAddress("0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15") },
  { symbol: "AAPL", feed: getAddress("0x6B22A786bAa607d76728168703a39Ea9C99f2cD0") },
  { symbol: "TSLA", feed: getAddress("0x4A1166a659A55625345e9515b32adECea5547C38") },
  { symbol: "AMZN", feed: getAddress("0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C") },
  { symbol: "AMD", feed: getAddress("0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72") },
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
 * One BlurVault per strategy. These are read from the environment because they
 * do not exist yet -- nothing is deployed to Robinhood Chain mainnet.
 *
 * Next.js inlines NEXT_PUBLIC_* only at literal property accesses, so each one
 * has to be spelled out here rather than looked up by a computed key.
 */
export const VAULT_ADDRESSES: Record<StrategyId, Address | null> = {
  steady: optionalAddress(process.env.NEXT_PUBLIC_VAULT_STEADY),
  balanced: optionalAddress(process.env.NEXT_PUBLIC_VAULT_BALANCED),
  growth: optionalAddress(process.env.NEXT_PUBLIC_VAULT_GROWTH),
};

export const DEPLOYED_VAULTS = Object.entries(VAULT_ADDRESSES).filter(
  (entry): entry is [StrategyId, Address] => entry[1] !== null,
);

/**
 * The $BLUR token, once it exists. Null until then, and the UI says so rather
 * than showing a placeholder anyone could mistake for the real contract --
 * before a launch a wrong "CA" is exactly what a scammer wants circulating.
 */
export const BLUR_TOKEN = optionalAddress(process.env.NEXT_PUBLIC_BLUR_TOKEN);

/**
 * The ExitRouter, if deployed. Lets a holder of a basketed vault sell the stock
 * leg to USDG in one transaction instead of receiving stock tokens in kind.
 * Null until deployed, and the "sell all" control simply doesn't render.
 */
export const EXIT_ROUTER = optionalAddress(process.env.NEXT_PUBLIC_EXIT_ROUTER);

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
