#!/usr/bin/env node
/**
 * Audits a live deployment against the properties the site claims for it.
 *
 * A deploy script that ran without reverting is not evidence that the result is
 * safe: it proves the calls succeeded, not that the finished state is the one
 * intended. This reads the deployment back and checks each property that
 * matters, including the ones that are supposed to be impossible.
 *
 * Read-only. It sends nothing and needs no key.
 *
 *   VAULT=0x... GUARD=0x... [BASKET=0x...] [ORACLE=0x...] [OWNER=0x...] \
 *   [KEEPER=0x...] [BUYBACK=0x...] node scripts/verify-deployment.mjs
 */
import { createPublicClient, http, formatUnits, getAddress } from "viem";
import { univaultAbi } from "../src/lib/abis.ts";

const RPC = process.env.RPC ?? "https://rpc.mainnet.chain.robinhood.com";

const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`missing ${name}`);
    process.exit(1);
  }
  return getAddress(v);
};
const optional = (name) => (process.env[name] ? getAddress(process.env[name]) : null);

const VAULT = need("VAULT");
const GUARD = need("GUARD");
const BASKET = optional("BASKET");
const ORACLE = optional("ORACLE");
const OWNER = optional("OWNER");
const KEEPER = optional("KEEPER");
const BUYBACK = optional("BUYBACK");

const chain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};
const client = createPublicClient({ chain, transport: http(RPC) });

const guardAbi = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "isVault", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { name: "isKeeper", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { name: "isBuyback", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "cooldown", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  { name: "maxDeployPerCall", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "maxSlippageBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
];

const basketAbi = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "vault", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "stable", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "oracle", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "tokensLength", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "tokens", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "isValuable", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    name: "poolKeys",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { type: "address", name: "currency0" },
      { type: "address", name: "currency1" },
      { type: "uint24", name: "fee" },
      { type: "int24", name: "tickSpacing" },
      { type: "address", name: "hooks" },
    ],
  },
  {
    name: "constituents",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { type: "uint16", name: "weightBps" },
      { type: "uint8", name: "decimals" },
      { type: "uint256", name: "acknowledgedMultiplier" },
      { type: "bool", name: "set" },
    ],
  },
];

const erc20Abi = [
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];

let failures = 0;
let warnings = 0;

function ok(label, detail = "") {
  console.log(`  [32mok[0m   ${label}${detail ? ` — ${detail}` : ""}`);
}
function bad(label, detail = "") {
  failures++;
  console.log(`  [31mFAIL[0m ${label}${detail ? ` — ${detail}` : ""}`);
}
function warn(label, detail = "") {
  warnings++;
  console.log(`  [33mwarn[0m ${label}${detail ? ` — ${detail}` : ""}`);
}
function check(condition, label, detail = "") {
  condition ? ok(label, detail) : bad(label, detail);
}

const readVault = (functionName, args = []) =>
  client.readContract({ address: VAULT, abi: univaultAbi, functionName, args });
const readGuard = (functionName, args = []) =>
  client.readContract({ address: GUARD, abi: guardAbi, functionName, args });
// Prefer the basket the vault actually points at; fall back to a BASKET given
// on the command line. Reading it off-chain means the equity checks work with
// only VAULT set, instead of firing an eth_call at `to: null`.
let basketAddress = BASKET;
const readBasket = (functionName, args = []) =>
  client.readContract({ address: basketAddress, abi: basketAbi, functionName, args });

const same = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

async function main() {
  console.log(`\nverifying ${VAULT} on ${RPC}\n`);

  const code = await client.getCode({ address: VAULT });
  if (!code || code === "0x") {
    console.error("nothing deployed at VAULT");
    process.exit(1);
  }

  const [asset, name, symbol, decimals, vaultOwner, vaultGuard, basket, targetStableBps, bufferBps, feeBps, feeRecipient, totalAssets, priceable] =
    await Promise.all([
      readVault("asset"),
      readVault("name"),
      readVault("symbol"),
      readVault("decimals"),
      readVault("owner"),
      readVault("guard"),
      readVault("basket"),
      readVault("targetStableBps"),
      readVault("bufferBps"),
      readVault("performanceFeeBps"),
      readVault("feeRecipient"),
      readVault("totalAssets"),
      readVault("isPriceable"),
    ]);

  const assetSymbol = await client.readContract({ address: asset, abi: erc20Abi, functionName: "symbol" });
  const assetDecimals = await client.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" });

  console.log(`${name} (${symbol})  ${formatUnits(totalAssets, assetDecimals)} ${assetSymbol} held\n`);

  console.log("wiring");
  check(same(vaultGuard, GUARD), "vault trusts the guard it was given", vaultGuard);
  check(await readGuard("isVault", [VAULT]), "guard knows the vault");
  if (OWNER) {
    check(same(vaultOwner, OWNER), "vault owner", vaultOwner);
    check(same(await readGuard("owner"), OWNER), "guard owner");
  } else {
    warn("no OWNER given, ownership not checked", vaultOwner);
  }
  if (KEEPER) check(await readGuard("isKeeper", [KEEPER]), "keeper registered", KEEPER);
  check(same(feeRecipient, OWNER ?? feeRecipient), "fee recipient", feeRecipient);

  console.log("\nparameters");
  check(Number(feeBps) <= 2000, "performance fee within the hard cap", `${Number(feeBps) / 100}%`);
  check(Number(bufferBps) <= 10000, "buffer in range", `${Number(bufferBps) / 100}%`);
  check(Number(targetStableBps) <= 10000, "target split in range", `${Number(targetStableBps) / 100}% stable`);
  const cooldown = await readGuard("cooldown");
  check(Number(cooldown) > 0, "guard cooldown set", `${Number(cooldown)}s`);
  const cap = await readGuard("maxDeployPerCall");
  check(cap > 0n, "per-call allocation cap set", `${formatUnits(cap, assetDecimals)} ${assetSymbol}`);
  const guardSlippage = await readGuard("maxSlippageBps");
  check(Number(guardSlippage) <= 1000, "guard slippage within the vault's ceiling", `${Number(guardSlippage) / 100}%`);
  const paused = await readGuard("paused");
  paused ? warn("guard is paused — automation will not run") : ok("guard is live");

  console.log("\nthe equity leg");
  if (basket === "0x0000000000000000000000000000000000000000") {
    check(Number(targetStableBps) === 10000, "no basket, so the target must be all stable");
    if (BASKET) bad("BASKET was given but the vault has none");
  } else {
    if (BASKET) check(same(basket, BASKET), "basket matches the one given", basket);
    basketAddress = BASKET ?? basket;
    check(same(await readBasket("vault"), VAULT), "basket points back at this vault");
    check(same(await readBasket("stable"), asset), "basket trades the vault's asset");
    if (ORACLE) check(same(await readBasket("oracle"), ORACLE), "basket uses the oracle given");
    check(priceable, "vault can price its basket right now");

    const n = await readBasket("tokensLength");
    check(n > 0n, "basket has constituents", `${n}`);
    for (let i = 0n; i < n; i++) {
      const token = await readBasket("tokens", [i]);
      const sym = await client
        .readContract({ address: token, abi: erc20Abi, functionName: "symbol" })
        .catch(() => token);
      const [weightBps, , , set] = await readBasket("constituents", [token]);
      const [c0, c1, fee] = await readBasket("poolKeys", [token]);
      const pairOk =
        (same(c0, asset) && same(c1, token)) || (same(c0, token) && same(c1, asset));
      check(set && pairOk, `${sym}: registered with a pool for the right pair`, `weight ${weightBps / 100}%, fee ${fee / 10000}%`);
    }
  }

  console.log("\nthe buyback");
  if (!BUYBACK) {
    warn("no BUYBACK given, skipped");
  } else {
    check(await readGuard("isBuyback", [BUYBACK]), "guard knows the module");
    check(same(feeRecipient, BUYBACK), "fees are routed to it", feeRecipient);
  }

  console.log("\nwhat must be impossible");

  const supply = await readVault("totalSupply");
  if (basket === "0x0000000000000000000000000000000000000000" && supply === 0n) {
    // Truthfully: on this vault it is still possible, and that is the point of
    // saying so. The slot closes the moment a share exists or a basket is set.
    warn(
      "the basket slot is still open",
      "no basket and no shares yet, so one can still be attached — finish the deployment before publishing this address",
    );
  } else {
    // setBasket is the drain that was closed. It has to fail now, and it has to
    // fail for the right reason -- a revert from something else would prove
    // nothing.
    try {
      await client.simulateContract({
        address: VAULT,
        abi: univaultAbi,
        functionName: "setBasket",
        args: [basket === "0x0000000000000000000000000000000000000000" ? VAULT : basket, 5000],
        account: vaultOwner,
      });
      bad("the owner can still substitute the basket");
    } catch (err) {
    // The decoded custom error is on the cause, not in shortMessage, which only
    // ever says "the function reverted". Reverting for some unrelated reason
    // would prove nothing, so the name has to be checked rather than the fact.
      const name =
        err.cause?.data?.errorName ?? err.cause?.cause?.data?.errorName ?? "unknown";
      check(
        ["BasketAlreadySet", "VaultInUse", "BasketNotBound"].includes(name),
        "the basket cannot be substituted, even by the owner",
        name,
      );
    }
  }

  console.log(
    `\n${failures === 0 ? "[32mall checks passed[0m" : `[31m${failures} failed[0m`}` +
      `${warnings ? `, ${warnings} warning(s)` : ""}\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
