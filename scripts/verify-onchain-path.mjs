#!/usr/bin/env node
/**
 * End-to-end check of the layer between the browser and the vault.
 *
 * The Solidity suite proves the contracts. What it cannot prove is that the
 * frontend talks to them correctly: a six-decimal amount parsed as eighteen, a
 * swapped argument, a stale ABI. This script runs deposit -> deploy -> withdraw
 * -> redeem-in-kind using the exact ABI the browser imports, so any drift
 * between the two shows up here instead of on mainnet.
 *
 * Usage, against a fork with a vault already deployed:
 *
 *   anvil --fork-url https://rpc.mainnet.chain.robinhood.com
 *   cd contracts && ASSET=... YIELD_VAULT=... OWNER=... \
 *     forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 \
 *     --broadcast --private-key <anvil key 0>
 *   VAULT=0x... OWNER=0x... node scripts/verify-onchain-path.mjs
 */
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { univaultAbi } from "../src/lib/abis.ts";

const RPC = process.env.RPC ?? "http://127.0.0.1:8545";
const VAULT = process.env.VAULT;
const OWNER = process.env.OWNER ?? "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
/** A large USDG holder to impersonate; any of the top holders will do. */
const DEPOSITOR =
  process.env.DEPOSITOR ?? "0x2d4d2A025b10C09BDbd794B4FCe4F7ea8C7d7bB4";

if (!VAULT) {
  console.error("VAULT=0x... is required (a deployed Univault on the fork)");
  process.exit(1);
}

const chain = {
  id: 4663,
  name: "Robinhood Chain (fork)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const pub = createPublicClient({ chain, transport: http(RPC) });

async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

const usd = (value) =>
  `${Number(formatUnits(value, 6)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })} USDG`;

const read = (functionName, args = []) =>
  pub.readContract({ address: VAULT, abi: univaultAbi, functionName, args });

for (const account of [DEPOSITOR, OWNER]) {
  await rpc("anvil_impersonateAccount", [account]);
  await rpc("anvil_setBalance", [account, "0xde0b6b3a7640000"]);
}

const depositor = createWalletClient({
  account: DEPOSITOR,
  chain,
  transport: http(RPC),
});
// deployIdle is gated on the vault's owner or a registered keeper, so the
// automation step cannot come from the depositor.
const owner = createWalletClient({ account: OWNER, chain, transport: http(RPC) });

const send = async (wallet, request) => {
  const hash = await wallet.writeContract(request);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`reverted: ${hash}`);
  return receipt;
};

const amount = parseUnits("25000", 6);
const usdgOf = (who) =>
  pub.readContract({
    address: USDG,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [who],
  });

console.log("--- what the app reads before any signature ---");
console.log("totalAssets   ", usd(await read("totalAssets")));
console.log("isPriceable   ", await read("isPriceable"));
const startingUsdg = await usdgOf(DEPOSITOR);
console.log("wallet USDG   ", usd(startingUsdg));

console.log("\n--- approve, then deposit ---");
await send(depositor, {
  address: USDG,
  abi: erc20Abi,
  functionName: "approve",
  args: [VAULT, amount],
});
await send(depositor, {
  address: VAULT,
  abi: univaultAbi,
  functionName: "deposit",
  args: [amount, DEPOSITOR],
});
const shares = await read("balanceOf", [DEPOSITOR]);
console.log("shares        ", shares);
console.log("position      ", usd(await read("convertToAssets", [shares])));
console.log("totalAssets   ", usd(await read("totalAssets")));

console.log("\n--- put idle cash into the lending venue ---");
await send(owner, {
  address: VAULT,
  abi: univaultAbi,
  functionName: "deployIdle",
  args: [],
});
console.log("totalAssets   ", usd(await read("totalAssets")));
// Must stay whole: the venue under-reports its own maxWithdraw, and the vault
// deliberately does not believe it.
console.log("maxWithdraw   ", usd(await read("maxWithdraw", [DEPOSITOR])));

console.log("\n--- withdraw half in USDG ---");
await send(depositor, {
  address: VAULT,
  abi: univaultAbi,
  functionName: "withdraw",
  args: [parseUnits("12500", 6), DEPOSITOR, DEPOSITOR],
});
console.log("wallet USDG   ", usd(await usdgOf(DEPOSITOR)));

console.log("\n--- redeem the rest in kind ---");
await send(depositor, {
  address: VAULT,
  abi: univaultAbi,
  functionName: "redeemInKind",
  args: [await read("balanceOf", [DEPOSITOR]), DEPOSITOR, DEPOSITOR],
});
const endingUsdg = await usdgOf(DEPOSITOR);
console.log("wallet USDG   ", usd(endingUsdg));
console.log("shares left   ", await read("balanceOf", [DEPOSITOR]));

const drift = endingUsdg - startingUsdg;
console.log("\nround trip    ", usd(drift));
if (drift > 0n) {
  console.error("FAIL: the round trip returned more than it took in");
  process.exit(1);
}
console.log("OK");
