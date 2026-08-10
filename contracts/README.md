# BLUR contracts

`Univault` is an ERC-4626 vault that takes USDG, issues shares, routes idle
balance into an external ERC-4626 lending vault, holds a basket of tokenized
stock tokens alongside it, rebalances between the two, charges a performance
fee above a high-water mark, and can be driven by a bounded keeper. Fee revenue
goes to `BuybackModule`, which buys the protocol token and retires it.

Nothing is deployed to mainnet.

## What a compromised keeper can do

Nothing that matters, and this is asserted rather than claimed. `KeeperGuard`
holds the keeper allowlist, the vault allowlist, a per-call size cap and a
cooldown; the vault accepts automation only from the guard. A keeper cannot
unwind a position, change the buffer, the fee or the fee recipient, take
ownership, widen its own limits, or reach the vault directly. The worst it can
do is allocate to the venue as often as the cooldown allows, which moves money
toward work rather than away from it. See `test_CompromisedKeeperCannotTouchAnythingThatMatters`
and `test_WorstCaseKeeperGriefCostsOnlyDust`.

Sentinels can halt automation but cannot resume it or run it. Halting is safe
to hand out; resuming is not.

## Setup

Dependencies are not vendored. Install them at their pinned versions:

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
cd contracts
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0
forge install Uniswap/v4-core
forge test
```

## Tests

| Suite | Needs network | Purpose |
|---|---|---|
| `Univault.t.sol` | no | Accounting, attacks, fuzz. The real test of our code. |
| `Fees.t.sol` | no | Reproduces the published fee table row for row. |
| `KeeperGuard.t.sol` | no | What automation can and, mostly, cannot do. |
| `Univault.invariant.t.sol` | no | Solvency and supply properties over random call sequences. |
| `Univault.fork.t.sol` | yes | Wiring against live Robinhood Chain, plus assertions that pin the current state of the lending venue. |
| `Diagnostics.fork.t.sol` | yes | Non-asserting probes. Prints what the venue is actually doing. |

Fork tests use the official RPC (`rpc.mainnet.chain.robinhood.com`), which
rate-limits under load. Point them at a local fork instead when that happens:

```bash
anvil --fork-url https://rpc.mainnet.chain.robinhood.com &
ROBINHOOD_RPC=http://localhost:8545 forge test
```

The
publicnode endpoint rejects the archive reads forking needs, and Blockscout's
JSON-RPC shim rejects forge's block parameter format — neither works here.

## Where the yield comes from

Traced on-chain, end to end:

```
USDG  ->  steakUSDG                     Morpho VaultV2, $163.8M
              |                          fees: 0 management, 0 performance
              |  $9.99M idle
              v  $153.8M allocated
          MorphoMarketV1AdapterV2       0x44ABc1d6cCFF2696d98890B92E2157AF242179c2
              |
              v
          Morpho Blue                   0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010
              |
    +---------+---------+-----------------+
    v                   v                 v
 syrupUSDG            USDe             spUSDG          <- collateral
 (Maple)             (Ethena)      (Spark Savings)
 $41.2M supplied   $151.7M supplied  $11.3M supplied
 89.2% utilised     89.6% utilised    89.9% utilised
```

All three markets lend USDG against yield-bearing stablecoin collateral at
91.5% LLTV. The interest is paid by leveraged loopers borrowing USDG against
Spark, Ethena and Maple positions. That is the whole of the "real lending
yield" — no equity exposure anywhere in it.

## Notes on the venue

1. **Its ERC-4626 limit views cannot be trusted.** `maxDeposit` and
   `maxWithdraw` both return zero while `deposit` and `redeem` execute in full
   — verified on a fork, both directions, for the whole balance. `_liquid()`
   deliberately ignores them; see the comment there.
2. **Accrual is lazy.** Interest lands in `_totalAssets` only when
   `accrueInterest()` runs, so a probe that interacts first and then warps sees
   a frozen share price while one that only warps sees it move. Neither reading
   is an APR. Do not quote a rate off a fork.
3. **It is VaultV2, not MetaMorpho.** Adapters rather than supply/withdraw
   queues, which is why every MetaMorpho selector reverts. Exits beyond
   available liquidity go through `forceDeallocate`, whose penalty is currently
   1e13 (0.001%).
4. **No audit.** Nothing here has been reviewed by anyone.

## What the vault deliberately cannot do

There is no function that sends depositor assets to an arbitrary address. The
owner chooses only how much sits idle versus deployed. `test_OwnerCannotTakeDepositorFunds`
asserts this rather than trusting it.


## Deploying

Everything below is one strategy. Run it once per vault, changing the split.

```bash
cd contracts

export OWNER=0x...            # holds every contract afterwards
export KEEPER=0x...           # the bot's address; may be omitted and set later
export SENTINEL=0x...         # may halt automation but not run it
export TARGET_STABLE_BPS=6000 # 10000 STEADY, 6000 BALANCED, 3000 GROWTH
export VAULT_NAME="Univault Balanced"
export VAULT_SYMBOL=uvBALANCED

forge script script/DeployStack.s.sol:DeployStack \
  --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --broadcast --verify
```

Feeds and pool keys are not parameters. They come from `RobinhoodChain`, where
every address was read on-chain and every pool proved by trading through it on
a fork. An operator should not be able to introduce a mistyped feed at deploy
time.

### Then check it, rather than assuming

A script that ran without reverting proves its calls succeeded, not that the
finished state is the one intended. Read the deployment back:

```bash
cd ..
VAULT=0x... GUARD=0x... BASKET=0x... ORACLE=0x... \
OWNER=0x... KEEPER=0x... node scripts/verify-deployment.mjs
```

It checks the wiring, the parameters, that every constituent has a feed and a
pool for the right pair, and — the part worth having — that the basket can no
longer be substituted. It sends nothing and needs no key.

Two states it will warn about rather than pass silently:

- **The basket slot is still open.** A vault with no basket and no shares can
  still have one attached. That is a half-finished deployment, and the address
  should not be published until it is not.
- **The guard is paused.** Automation will not run.

### Order of operations

1. Deploy with `TARGET_STABLE_BPS` set. The script attaches the basket in the
   same run, which matters: the basket can only ever be set once, and only
   while the vault has issued no shares. A vault that takes a deposit first can
   never have an equity leg.
2. Run the verifier. Do not skip this because the script printed addresses.
3. Deploy `BuybackModule`, point it at a pool, register it on the guard, and
   set it as the vault's fee recipient. It needs a protocol token to exist
   first.
4. Put the addresses in `NEXT_PUBLIC_VAULT_*` for the site, and in the docs
   address table.

### Who holds the owner key

The owner cannot move deposits to an address of its choosing — the basket is
fixed and rebalance slippage is a constant. What it can do is make the vault
trade pointlessly, and change the fee, the buffer and the split. Treat it as a
key worth protecting, not as a key that controls the money: a hardware wallet
at minimum, a Safe once anyone else has deposited. Safe is deployed on this
chain at the canonical addresses.
