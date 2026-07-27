#!/usr/bin/env node
/**
 * Reads back what a deposit transaction actually did.
 *
 * A deposit into a BALANCED or GROWTH vault buys the basket and lends the rest
 * in the depositor's own transaction. When it works there is nothing to see;
 * when a pool cannot fill inside the slippage bound the contract quietly sweeps
 * that leg's stable back and carries on, so the transaction still succeeds and
 * the only trace is a purchase missing from the logs. That is the failure this
 * script exists to catch: `ok` from the explorer is not evidence the money was
 * allocated.
 *
 * Everything is derived from the receipt and the chain — no assumptions about
 * which vault, which tokens, or how many. Read-only, needs no key.
 *
 *   node scripts/check-deposit.mjs 0x<txhash>
 */
import { createPublicClient, http, formatUnits, getAddress, erc20Abi } from "viem";

const RPC = process.env.RPC ?? "https://rpc.mainnet.chain.robinhood.com";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO = "0x0000000000000000000000000000000000000000";

const hash = process.argv[2];
if (!/^0x[0-9a-fA-F]{64}$/.test(hash ?? "")) {
  console.error("usage: node scripts/check-deposit.mjs 0x<txhash>");
  process.exit(1);
}

const chain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};
const client = createPublicClient({ chain, transport: http(RPC) });

const vaultAbi = [
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "basket", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "yieldVault", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "targetStableBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "bufferBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "isPriceable", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "convertToAssets", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
];
const basketAbi = [
  { type: "function", name: "tokensLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokens", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "valueOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
];

const meta = new Map();
async function token(address) {
  const key = address.toLowerCase();
  if (!meta.has(key)) {
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address, abi: erc20Abi, functionName: "symbol" }).catch(() => "?"),
      client.readContract({ address, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
    ]);
    meta.set(key, { symbol, decimals });
  }
  return meta.get(key);
}

const receipt = await client.getTransactionReceipt({ hash });
const tx = await client.getTransaction({ hash });

if (receipt.status !== "success") {
  console.log(`REVERTED — the deposit did not happen. Nothing was moved.`);
  process.exit(1);
}

// The vault is whatever the deposit was sent to. Deriving it rather than taking
// it as an argument means this cannot be pointed at the wrong vault by mistake.
const vault = getAddress(receipt.to);
const read = (functionName, args = []) =>
  client.readContract({ address: vault, abi: vaultAbi, functionName, args });

let asset, basket, yieldVault, targetStableBps, bufferBps;
try {
  [asset, basket, yieldVault, targetStableBps, bufferBps] = await Promise.all([
    read("asset"), read("basket"), read("yieldVault"), read("targetStableBps"), read("bufferBps"),
  ]);
} catch {
  console.log(`${vault} does not answer like a BLUR vault — is this the right transaction?`);
  process.exit(1);
}

const stable = await token(asset);
const fmt = (v, d = stable.decimals) => Number(formatUnits(v, d));
const usd = (v) => `${fmt(v).toFixed(6)} ${stable.symbol}`;

// ---------------------------------------------------------------------------
// What the logs say happened
// ---------------------------------------------------------------------------
const transfers = [];
for (const log of receipt.logs) {
  if (log.topics[0] !== TRANSFER || log.topics.length < 3) continue;
  transfers.push({
    address: getAddress(log.address),
    from: getAddress(`0x${log.topics[1].slice(-40)}`),
    to: getAddress(`0x${log.topics[2].slice(-40)}`),
    value: BigInt(log.data === "0x" ? 0 : log.data),
  });
}

const eq = (a, b) => a.toLowerCase() === b.toLowerCase();
const deposited = transfers
  .filter((t) => eq(t.address, asset) && eq(t.to, vault) && !eq(t.from, ZERO))
  .reduce((a, t) => a + t.value, 0n);
const sharesMinted = transfers
  .filter((t) => eq(t.address, vault) && eq(t.from, ZERO))
  .reduce((a, t) => a + t.value, 0n);
const lent = transfers
  .filter((t) => eq(t.address, asset) && eq(t.to, yieldVault))
  .reduce((a, t) => a + t.value, 0n);

// Stock purchases: any non-stable token that arrived at the basket.
const bought = new Map();
if (basket !== ZERO) {
  for (const t of transfers) {
    if (eq(t.address, asset) || !eq(t.to, basket)) continue;
    const k = getAddress(t.address);
    bought.set(k, (bought.get(k) ?? 0n) + t.value);
  }
}

console.log(`transaction ${hash}`);
console.log(`  block ${receipt.blockNumber}, gas ${receipt.gasUsed}, from ${tx.from}`);
console.log(`  vault ${vault}  (target ${100 - targetStableBps / 100}% equity, ${bufferBps / 100}% buffer)\n`);
console.log(`deposited      ${usd(deposited)}`);
console.log(`shares minted  ${formatUnits(sharesMinted, 18)}`);

// ---------------------------------------------------------------------------
// Did every constituent get bought?
// ---------------------------------------------------------------------------
let missing = [];
if (basket !== ZERO) {
  const n = await client.readContract({ address: basket, abi: basketAbi, functionName: "tokensLength" });
  const constituents = await Promise.all(
    Array.from({ length: Number(n) }, (_, i) =>
      client.readContract({ address: basket, abi: basketAbi, functionName: "tokens", args: [BigInt(i)] }),
    ),
  );

  console.log(`\nequity leg`);
  for (const c of constituents) {
    const { symbol, decimals } = await token(c);
    const amount = bought.get(getAddress(c)) ?? 0n;
    if (amount === 0n) {
      missing.push(symbol);
      console.log(`  ${symbol.padEnd(8)} NOT BOUGHT`);
    } else {
      console.log(`  ${symbol.padEnd(8)} +${formatUnits(amount, decimals)}`);
    }
  }
} else {
  console.log(`\nequity leg    none — this vault is lending-only by design`);
}

console.log(`\nlending leg`);
console.log(`  ${(await token(yieldVault)).symbol.padEnd(8)} ${usd(lent)} deposited`);

const buffer = deposited - lent - transfers
  .filter((t) => eq(t.address, asset) && eq(t.from, vault) && eq(t.to, basket))
  .reduce((a, t) => a + t.value, 0n);
console.log(`\nheld as buffer ${usd(buffer > 0n ? buffer : 0n)}  (target ${usd((deposited * BigInt(bufferBps)) / 10000n)})`);

// ---------------------------------------------------------------------------
// Verdict — and where the vault stands now, which is the thing that matters
// ---------------------------------------------------------------------------
const [totalAssets, priceable, depositorShares] = await Promise.all([
  read("totalAssets"), read("isPriceable"), read("balanceOf", [tx.from]),
]);
const worth = await read("convertToAssets", [depositorShares]);

console.log(`\nvault now`);
console.log(`  totalAssets   ${usd(totalAssets)}`);
console.log(`  isPriceable   ${priceable}`);
console.log(`  depositor holds ${formatUnits(depositorShares, 18)} shares = ${usd(worth)}`);

console.log("");
if (basket === ZERO) {
  console.log(lent > 0n ? "OK — stable lent, which is all this vault does." : "PROBLEM — nothing reached the lending venue.");
} else if (missing.length === 0 && lent > 0n) {
  console.log("OK — every constituent was bought and the remainder was lent.");
} else if (missing.length) {
  console.log(`PARTIAL — ${missing.join(", ")} did not fill inside the 1% deposit slippage bound.`);
  console.log("The stable for those legs was swept back into the vault, so nothing is lost,");
  console.log("but the basket is underweight there. Thin pool: retry smaller, or leave it");
  console.log("for a rebalance once there is more liquidity.");
} else {
  console.log("PARTIAL — stocks bought but nothing was lent. Check the buffer figure above.");
}
