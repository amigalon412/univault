import { defineChain, getAddress, type Address } from "viem";
import type { StrategyId } from "@/lib/strategies";

/**
 * BNB Chain. Gas is BNB, not ETH -- every fee estimate and every "you need gas"
 * string downstream reads nativeCurrency, so this one field carries a lot.
 *
 * PORTED, NOT VERIFIED. The build this replaced pointed at BNB Chain
 * (id 4663), which is where the whole contract set is actually deployed:
 * vaults, guards, oracles, the exit router, the Steakhouse USDG lending vault
 * and Robinhood's own stock tokens all live there and NONE of them exist here.
 * Until the stack is redeployed on BNB and contracts/DEPLOYMENTS.md is rewritten
 * against it, every address in this file is wrong -- the reads will fail and
 * the app will show its not-deployed state. That is the intended behaviour of
 * a half-finished port: fail visibly rather than quote figures from a chain
 * nobody is on.
 */
export const bnbChain = defineChain({
  id: 56,
  name: "BNB Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://bsc-dataseed.binance.org"] },
  },
  blockExplorers: {
    default: {
      name: "BscScan",
      url: "https://bscscan.com",
    },
  },
  contracts: {
    // Multicall3 at its canonical cross-chain address. Without this viem
    // refuses to batch, and every read becomes its own call.
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});

/**
 * Tether USD on BNB Chain. EIGHTEEN decimals, not six -- the opposite of USDG
 * on Robinhood Chain, and the likeliest source of a silent off-by-1e12 in code
 * ported between the two.
 *
 * USDT and not USDC because that is what the tokenised equities trade against:
 * every bStock pool is quoted in USDT and not one has a USDC pair.
 */
export const USDG: Address = getAddress(
  "0x55d398326f99059fF775485246999027B3197955",
);
export const USDG_DECIMALS = 18;

/**
 * What to CALL the stable in the interface.
 *
 * The constant above is still named USDG for the same reason the keystore is:
 * renaming an identifier across the codebase is churn, and the address is what
 * matters. What must not be stale is the word on screen -- the vault takes
 * USDT here, and a page that says USDG sends somebody to approve the wrong
 * token. Every user-facing mention reads this, so the next chain move is one
 * line rather than a hunt.
 */
export const STABLE_SYMBOL = "USDT";

/**
 * The lending leg: our ERC-4626 wrapper over Venus's core USDT market. Its
 * share price is where the base yield actually shows up.
 *
 * A wrapper rather than the venue itself because Venus's core market is a
 * Compound v2 vToken, and Venus's own 4626 factory refuses it -- that factory
 * only accepts vTokens in the isolated-pool registry, which hold four to five
 * figures while the core market holds nine.
 */
export const STEAK_USDG: Address = getAddress(
  "0xf9ABEa4Bf8FeBEDB9FEd8eCF7a7F1272C49f5424",
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
  "0x0C55a91caBDbD63000983286dd78ABC889a513BE",
);
export const PRICE_ORACLE: Address = getAddress(
  "0xf1C6503a26fB311281E7C588999E837d2Aac4362",
);
export const KEEPER_GUARD: Address = getAddress(
  "0xB6312EcAA70B72f2cbec53741A7D2FF5Bdb217CE",
);

/**
 * BnbExitRouter, deployed 2026-08-13 at block 115725204, tx 0x86f11093…0f2e.
 *
 * Ownerless and holds no funds between calls -- it has no `Ownable`, no
 * privileged functions and nothing to configure, which is why it could be
 * deployed from any address without changing anything about it.
 */
export const EXIT_ROUTER_FALLBACK: Address = getAddress(
  "0x795A0bEAB813Ea9BefB6124997FE2a3522096abc",
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
  { symbol: "SPY", feed: getAddress("0xb24D1DeE5F9a3f761D286B56d2bC44CE1D02DF7e") },
  { symbol: "QQQ", feed: getAddress("0x9A41B56b2c24683E2f23BdE15c14BC7c4a58c3c4") },
  { symbol: "GOOGL", feed: getAddress("0xeDA73F8acb669274B15A977Cb0cdA57a84F18c2a") },
  { symbol: "MSFT", feed: getAddress("0x5D209cE1fBABeAA8E6f9De4514A74FFB4b34560F") },
  { symbol: "META", feed: getAddress("0xfc76E9445952A3C31369dFd26edfdfb9713DF5Bb") },
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
  { symbol: "SPYB", token: getAddress("0x7138b48df7D98D7e3cc221BfE7192D0a178182D8") },
  { symbol: "QQQB", token: getAddress("0x205812CdBed920aFf76C6580abD681a46D11efc7") },
  { symbol: "GOOGLB", token: getAddress("0x3F53De71c126BdaBAe20f9cD64848d317f6C3238") },
  { symbol: "MSFTB", token: getAddress("0x80106cb3EAD06659A5ad19DF39D9b4733863B9b0") },
  { symbol: "METAB", token: getAddress("0x7425889FE94F9d693E8daefE88BCCed6AcFEf4c0") },
];

/**
 * How many names the live adapters actually hold.
 *
 * Read back off BNB Chain after the deploy: both BnbBasketAdapters report
 * tokensLength() == 5, all five at 2000 bps, and isValuable() == true, which
 * means every Chainlink feed answered. The two ETFs route through the 0.01%
 * tier and the three single names through 0.25% -- the tier is stored per token
 * for exactly that reason.
 *
 * This constant exists because the last build shipped a basket the chain did
 * not have yet. Keep it equal to what the adapters report, not to what the
 * copy hopes for.
 */
export const BASKET_LIVE_ON_CHAIN = 5;

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
 * The deployed vaults, one per strategy. Live on BNB Chain mainnet since
 * 2026-08-10 -- addresses, guards, oracles and baskets are recorded in
 * contracts/DEPLOYMENTS.md, which is the source these are copied from.
 *
 * This is the post-rename set. The vaults it replaced were deployed as
 * `BlurVault` and minted shares called `blurBALANCED`; a share token's name and
 * symbol are constructor arguments with no setter, so the only way to change
 * them was to deploy again. These mint `Safex Balanced` / `sfxBALANCED`.
 * The old vaults still answer calls and still hold nothing -- do not point
 * anything at them.
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
  steady: "0x8F6154E79471CE8538f0DCEb9D0cf90d48D883E6",
  balanced: "0x0c892E668a20a4fE82d7963580ebD0C6A66Ba8F4",
  growth: "0x12a2DC45Cd51F26075129332ceD4bC6e1e190ae5",
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
 * The $SAFEX token, once it exists. Null until then, and the UI says so rather
 * than showing a placeholder anyone could mistake for the real contract --
 * before a launch a wrong "CA" is exactly what a scammer wants circulating.
 */
export const BLUR_TOKEN = optionalAddress(process.env.NEXT_PUBLIC_BLUR_TOKEN);

/**
 * The ExitRouter. Lets a holder of a basketed vault sell the stock leg to USDT
 * in one transaction instead of receiving stock tokens in kind; without it the
 * "sell everything" control simply doesn't render.
 *
 * A committed default for the same reason the vaults have one -- a clone with
 * no .env.local was hiding a control that works. It was deliberately empty
 * between the BNB port and 2026-08-13, while the router existed only as source.
 */
export const EXIT_ROUTER = optionalAddress(
  process.env.NEXT_PUBLIC_EXIT_ROUTER || EXIT_ROUTER_FALLBACK,
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
  return `${bnbChain.blockExplorers.default.url}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${bnbChain.blockExplorers.default.url}/tx/${hash}`;
}
