import { createPublicClient, createWalletClient, http, defineChain, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC_URL = process.env.RPC_URL ?? "https://bsc-dataseed.binance.org";
const VAULT = required("VAULT_ADDRESS");
const GUARD = required("GUARD_ADDRESS");

// Optional: without it the keeper simply runs the vault half of its job.
const BUYBACK = process.env.BUYBACK_ADDRESS ?? null;

// Do not act on dust. A call that moves less than this is not worth the gas or
// the block space, and spamming small allocations only feeds venue rounding.
//
// WHOLE TOKENS, scaled by the asset's own decimals once the chain has told us
// what they are -- see `dust()` below. They used to be raw base units with a
// six-decimal assumption baked into the number (100_000_000 meaning 100 USDG),
// which is correct on Robinhood Chain and wrong by a factor of a million on
// BNB, where USDT has EIGHTEEN decimals. A keeper reading `100_000_000` as its
// floor there would treat anything under 0.0000000001 USDT as worth acting on
// -- that is, it would never skip, and would burn gas allocating dust forever.
// Expressing the floor in tokens makes the units impossible to get wrong.
const MIN_DEPLOY_TOKENS = Number(process.env.MIN_DEPLOY_TOKENS ?? 100);
const MIN_FEE_TOKENS = Number(process.env.MIN_FEE_TOKENS ?? 10);
const MIN_BUYBACK_TOKENS = Number(process.env.MIN_BUYBACK_TOKENS ?? 50);

/** Whole tokens -> base units, at the asset's real precision. */
function dust(tokens, decimals) {
  return BigInt(Math.round(tokens * 1e6)) * 10n ** BigInt(decimals) / 1_000_000n;
}

// How far below the simulated fill a buyback may still settle. The protocol
// token has no price feed, so this is the only bound on the price and it is
// measured against a quote taken moments earlier, not against an oracle.
const BUYBACK_SLIPPAGE_BPS = BigInt(process.env.BUYBACK_SLIPPAGE_BPS ?? 100); // 1%

const POLL_MS = Number(process.env.POLL_MS ?? 60_000);

// Dry run is the default on purpose. Sending transactions requires opting in.
const DRY_RUN = process.env.DRY_RUN !== "false";
const ONCE = process.argv.includes("--once");

// BNB Chain. Gas is BNB, not ETH -- viem only uses nativeCurrency for
// formatting, but a keeper that prints "0.004 ETH" of gas on BSC is a keeper
// nobody can sanity-check against an explorer.
const bnb = defineChain({
  id: 56,
  name: "BNB Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

// ---------------------------------------------------------------------------
// ABIs — only what is used
// ---------------------------------------------------------------------------

const vaultAbi = [
  { name: "asset", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "totalAssets", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "bufferBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { name: "guard", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "basket", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "needsRebalance", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "driftBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "int256" }] },
  { name: "isPriceable", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "convertToAssets", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
];

const basketAbi = [
  { name: "tokensLength", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "tokens", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "valueOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "totalValueUsd", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
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

const guardAbi = [
  { name: "isKeeper", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { name: "isVault", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { name: "isBuyback", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "cooldown", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  { name: "maxDeployPerCall", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "maxBuybackPerCall", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "lastActionAt", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "deployIdle", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "rebalance", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "collectFees", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "address" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "buyback", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
];

const buybackAbi = [
  { name: "buyback", type: "function", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
];

const erc20Abi = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
];

// ---------------------------------------------------------------------------

const publicClient = createPublicClient({ chain: bnb, transport: http(RPC_URL) });

// The key is only read when actually sending. A dry run never touches it, so
// the bot can be inspected and left running without one present.
let account = null;
let walletClient = null;
if (!DRY_RUN) {
  const pk = required("KEEPER_PRIVATE_KEY");
  account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  walletClient = createWalletClient({ account, chain: bnb, transport: http(RPC_URL) });
}

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

const readVault = (functionName, args = []) =>
  publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName, args });
const readGuard = (functionName, args = []) =>
  publicClient.readContract({ address: GUARD, abi: guardAbi, functionName, args });

// ---------------------------------------------------------------------------
// Planning
//
// Each planner returns either a skip with a stated reason, or an action ready
// to simulate. Nothing decides to send here; that keeps every reason to stay
// quiet visible in the log rather than buried in control flow.
// ---------------------------------------------------------------------------

/// Which constituent to trade, and which way.
///
/// The vault decides direction and size from the live gap; the keeper only
/// names a token. Naming the wrong one is not unsafe but it is wasteful, so
/// pick the constituent furthest from its own target weight in the direction
/// the trade is going: buy what is most under-weight, sell what is most over.
async function pickConstituent(basket, buying, fmt) {
  const length = await publicClient.readContract({
    address: basket, abi: basketAbi, functionName: "tokensLength",
  });
  if (length === 0n) return null;

  const total = await publicClient.readContract({
    address: basket, abi: basketAbi, functionName: "totalValueUsd",
  });

  let best = null;
  for (let i = 0n; i < length; i++) {
    const token = await publicClient.readContract({
      address: basket, abi: basketAbi, functionName: "tokens", args: [i],
    });
    const [value, constituent, symbol] = await Promise.all([
      publicClient.readContract({ address: basket, abi: basketAbi, functionName: "valueOf", args: [token] }),
      publicClient.readContract({ address: basket, abi: basketAbi, functionName: "constituents", args: [token] }),
      publicClient.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).catch(() => token),
    ]);

    const targetBps = BigInt(constituent[0]);
    // An empty basket has no weights to compare, so everything is equally
    // under-weight and the first name is as good as any.
    const actualBps = total === 0n ? 0n : (value * 10_000n) / total;
    const gap = actualBps - targetBps; // negative means under-weight

    const score = buying ? -gap : gap;
    if (best === null || score > best.score) {
      best = { token, symbol, score, gap, targetBps, actualBps, value };
    }
  }

  if (best) {
    log(
      `  pick ${best.symbol}: target=${best.targetBps}bps actual=${best.actualBps}bps ` +
        `value=${fmt(best.value / 1_000_000_000_000n)}`,
    );
  }
  return best;
}

/// deployIdle and rebalance share one cooldown slot on the guard, so at most
/// one of them can run per period. Rebalancing wins: it is about the vault
/// holding what it says it holds, while allocating idle cash is an
/// optimisation that keeps just as well until the next tick.
async function planVaultAction(ctx) {
  const { fmt, asset, decimals, now } = ctx;

  const paused = await readGuard("paused");
  if (paused) return { skip: "guard is paused" };

  const cooldown = await readGuard("cooldown");
  const lastAt = await readGuard("lastActionAt", [VAULT]);
  if (lastAt !== 0n && now < lastAt + BigInt(cooldown)) {
    return { skip: `vault cooling down, ${Number(lastAt + BigInt(cooldown) - now)}s left` };
  }

  const basket = await readVault("basket");
  if (basket !== "0x0000000000000000000000000000000000000000") {
    const priceable = await readVault("isPriceable");
    if (!priceable) {
      // Not an error: the vault is refusing to value a stale feed or an
      // unacknowledged split, and trading against that is exactly the mistake
      // the halt exists to prevent. Allocating idle cash is withheld too, not
      // only rebalancing -- it accrues the fee first, which needs the same
      // valuation and would revert.
      return { skip: "vault cannot price its basket, all automation withheld" };
    }

    const needs = await readVault("needsRebalance");
    if (needs) {
      const drift = await readVault("driftBps");
      // Positive drift means over-weight stablecoin, so the trade buys stocks.
      const buying = drift > 0n;
      const pick = await pickConstituent(basket, buying, fmt);
      if (pick) {
        return {
          name: "rebalance",
          describe: `rebalance ${buying ? "into" : "out of"} ${pick.symbol} | drift=${drift}bps`,
          call: { functionName: "rebalance", args: [VAULT, pick.token] },
        };
      }
    }
  }

  const [totalAssets, bufferBps, idle, cap] = await Promise.all([
    readVault("totalAssets"),
    readVault("bufferBps"),
    publicClient.readContract({ address: asset, abi: erc20Abi, functionName: "balanceOf", args: [VAULT] }),
    readGuard("maxDeployPerCall"),
  ]);

  const target = (totalAssets * BigInt(bufferBps)) / 10_000n;
  const deployable = idle > target ? idle - target : 0n;
  const wouldDeploy = deployable > cap ? cap : deployable;
  const state = `idle=${fmt(idle)} buffer=${fmt(target)} deployable=${fmt(deployable)} cap=${fmt(cap)}`;

  const minDeploy = dust(MIN_DEPLOY_TOKENS, decimals);
  if (wouldDeploy < minDeploy) {
    return { skip: `nothing to allocate (${fmt(wouldDeploy)} < ${fmt(minDeploy)})`, state };
  }
  return {
    name: "deployIdle",
    describe: `allocate ${fmt(wouldDeploy)}`,
    state,
    call: { functionName: "deployIdle", args: [VAULT] },
  };
}

/// Turning accrued fee shares into stable. No cooldown applies, so this can run
/// alongside a vault action in the same tick.
async function planCollect(ctx) {
  const { fmt } = ctx;

  const shares = await readVault("balanceOf", [BUYBACK]);
  if (shares === 0n) return { skip: "no fee shares to collect" };

  const worth = await readVault("convertToAssets", [shares]);
  const minFee = dust(MIN_FEE_TOKENS, ctx.decimals);
  if (worth < minFee) {
    return { skip: `fees below threshold (${fmt(worth)} < ${fmt(minFee)})` };
  }

  return {
    name: "collectFees",
    describe: `collect ${fmt(worth)} of fees`,
    call: { functionName: "collectFees", args: [BUYBACK, VAULT, shares] },
  };
}

/// Spending collected stable on the protocol token.
///
/// `minAmountOut` cannot come from an oracle -- the protocol token has no feed.
/// It is derived instead by simulating the swap to see what the pool would
/// actually return right now, then demanding all but a small margin of that.
/// The bound is therefore against a quote seconds old, not against a price
/// anyone has attested to, which is why the guard's size cap matters more here
/// than in any other action.
async function planBuyback(ctx) {
  const { fmt, asset, now } = ctx;

  const paused = await readGuard("paused");
  if (paused) return { skip: "guard is paused" };

  const cooldown = await readGuard("cooldown");
  const lastAt = await readGuard("lastActionAt", [BUYBACK]);
  if (lastAt !== 0n && now < lastAt + BigInt(cooldown)) {
    return { skip: `buyback cooling down, ${Number(lastAt + BigInt(cooldown) - now)}s left` };
  }

  const [balance, cap] = await Promise.all([
    publicClient.readContract({ address: asset, abi: erc20Abi, functionName: "balanceOf", args: [BUYBACK] }),
    readGuard("maxBuybackPerCall"),
  ]);
  const spend = balance > cap ? cap : balance;

  const minBuyback = dust(MIN_BUYBACK_TOKENS, ctx.decimals);
  if (spend < minBuyback) {
    return { skip: `too little to buy back (${fmt(spend)} < ${fmt(minBuyback)})` };
  }

  // A quote, taken by asking the chain what would happen with no lower bound.
  //
  // Asked of the module with the guard as the caller, not of the guard itself:
  // the guard would reject an unregistered caller, and in a dry run there is no
  // key and therefore no registered address to ask with. The module accepts its
  // guard, so this quotes in both modes and the spend matches what the guard
  // would pass through.
  let quoted;
  try {
    const { result } = await publicClient.simulateContract({
      address: BUYBACK,
      abi: buybackAbi,
      functionName: "buyback",
      args: [cap, 1n],
      account: GUARD,
    });
    quoted = result;
  } catch (err) {
    return { skip: `quote failed: ${err.shortMessage ?? err.message}` };
  }

  const minOut = (quoted * (10_000n - BUYBACK_SLIPPAGE_BPS)) / 10_000n;
  if (minOut === 0n) return { skip: "quote returned nothing" };

  return {
    name: "buyback",
    describe: `spend ${fmt(spend)}, expect ${quoted} units, floor ${minOut}`,
    call: { functionName: "buyback", args: [BUYBACK, minOut] },
  };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function execute(action) {
  log(`${action.name}: ${action.describe}${action.state ? ` | ${action.state}` : ""}`);

  if (DRY_RUN) {
    log("  dry run, not sending. set DRY_RUN=false to act.");
    return;
  }

  try {
    // Simulate first. The guard reverts on every limit it enforces, and finding
    // that out locally is free where finding it out on-chain is not.
    const { request } = await publicClient.simulateContract({
      address: GUARD,
      abi: guardAbi,
      account,
      ...action.call,
    });
    const hash = await walletClient.writeContract(request);
    log("  sent", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    log("  mined in block", receipt.blockNumber, "status", receipt.status);
  } catch (err) {
    log(`  ${action.name} failed:`, err.shortMessage ?? err.message);
  }
}

async function tick() {
  let ctx;
  try {
    const asset = await readVault("asset");
    const [decimals, vaultGuard, block] = await Promise.all([
      publicClient.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" }),
      readVault("guard"),
      publicClient.getBlock(),
    ]);

    if (vaultGuard.toLowerCase() !== GUARD.toLowerCase()) {
      log(`skip: vault trusts a different guard (${vaultGuard})`);
      return;
    }

    // Cooldowns are measured in chain time. Comparing them against this host's
    // clock means a skewed clock either idles the keeper or sends a call the
    // guard will revert, and neither failure announces itself.
    ctx = { asset, decimals, now: block.timestamp, fmt: (v) => formatUnits(v, decimals) };
  } catch (err) {
    log("read failed:", err.shortMessage ?? err.message);
    return;
  }

  const plans = [planVaultAction(ctx)];
  if (BUYBACK) plans.push(planCollect(ctx), planBuyback(ctx));

  const settled = await Promise.allSettled(plans);
  const labels = BUYBACK ? ["vault", "collect", "buyback"] : ["vault"];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "rejected") {
      log(`${labels[i]}: planning failed:`, outcome.reason?.shortMessage ?? outcome.reason?.message);
      continue;
    }
    const plan = outcome.value;
    if (plan.skip) {
      log(`skip ${labels[i]}: ${plan.skip}${plan.state ? ` | ${plan.state}` : ""}`);
      continue;
    }
    await execute(plan);
  }
}

async function main() {
  log(`keeper starting | vault=${VAULT} guard=${GUARD}${BUYBACK ? ` buyback=${BUYBACK}` : ""}`);
  log(
    `mode=${DRY_RUN ? "DRY RUN" : "LIVE"} poll=${POLL_MS}ms ` +
      `minDeploy=${MIN_DEPLOY_TOKENS} minFee=${MIN_FEE_TOKENS} minBuyback=${MIN_BUYBACK_TOKENS} (whole tokens) ` +
      `buybackSlippage=${BUYBACK_SLIPPAGE_BPS}bps`,
  );

  if (!DRY_RUN) {
    const registered = await readGuard("isKeeper", [account.address]);
    log(`keeper address ${account.address} registered=${registered}`);
    if (!registered) {
      log("this address is not an allowed keeper; every call would revert. exiting.");
      process.exit(1);
    }

    const vaultAllowed = await readGuard("isVault", [VAULT]);
    if (!vaultAllowed) {
      log("the guard does not know this vault; every call would revert. exiting.");
      process.exit(1);
    }

    if (BUYBACK) {
      const buybackAllowed = await readGuard("isBuyback", [BUYBACK]);
      if (!buybackAllowed) {
        log("the guard does not know this buyback module; skipping buyback actions.");
      }
    }
  }

  await tick();
  if (ONCE) return;

  setInterval(tick, POLL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
