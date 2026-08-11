# Basket expansion — adding GOOGL, MSFT, SPCX and PLTR

Owner-only configuration. **No funds move**; the only cost is gas, and the
simulation puts that at ~0.000113 ETH per vault. The owner is
`0x13fB1e4C02bEC80377d17c2D187f85b27DD90222`, which owns both adapters and both
oracles.

## Run it

`script/ExpandBasket.s.sol` does all sixteen calls for one vault. Run it twice,
once per vault. Dry run first — it takes no key and changes nothing:

```
cd contracts
ORACLE=0x6EEd6275c580C43A97825e9870397f96FA181ea8 \
BASKET=0xA36f535E0035bb068cc27ca59137eF36b193f273 \
forge script script/ExpandBasket.s.sol:ExpandBasket \
  --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --sender 0x13fB1e4C02bEC80377d17c2D187f85b27DD90222
```

It should end with `constituents now: 8`. Then the same command with
`--broadcast` and a signer, and again with the GROWTH pair:

| vault | ORACLE | BASKET |
|---|---|---|
| BALANCED | `0x6EEd6275c580C43A97825e9870397f96FA181ea8` | `0xA36f535E0035bb068cc27ca59137eF36b193f273` |
| GROWTH | `0x7C3Ff9e01Dcb472D297648AbeDF5c1F595D3Deff` | `0x76d58d2cF50BdB37e50117c5b7DfB6d579c7c609` |

The script reads no key. `--ledger`, `--private-key` or any other signer flag
forge accepts all work, so the key never has to live in the environment the way
the older scripts here require.

Every step checks current state before acting, so a run that dies halfway can
be repeated without reverting on the part that already landed.

## The order, and why it is what it is

1. **Feeds.** A constituent whose price is not registered makes every
   valuation revert, and deposits go with it.
2. **Weights down.** The four current names sit at 2500 bps each — exactly the
   10000 ceiling — so `addConstituent` reverts with `WeightsExceedTotal` until
   they come down. Eight at 1250 lands back on 10000.
3. **Constituents.**
4. **Pools last.** `setPool` opens with
   `if (!constituents[token].set) revert UnknownToken(token)`. Wiring the
   market before adding the holding is the intuitive order and it reverts —
   the first draft of this document had it that way round, and the dry run is
   what caught it.

## What was checked, and how

Both new pool tiers and every feed were read off mainnet rather than assumed:

- **Pools.** The pool the adapter would actually address — USDG paired, no hook
  — was read out of the v4 singleton by computing its id and loading
  `liquidity` from storage. GOOGL and MSFT hold liquidity at 0.30%; **SPCX and
  PLTR only at 1%**, their 0.30% pools being uninitialised. AMD was run through
  the same check as a control and came back empty, which is why it has never
  been a constituent.
- **Feeds.** Found by reading `description()` off every EACAggregatorProxy on
  the chain — the explorer indexes them by contract name and the ticker only
  exists inside the contract. Naming is inconsistent: most read
  `Robinhood X / USD`, Microsoft's reads `RHMSFT / USD`.
- **maxAge** is 259200 (72h), the value already on all four existing feeds.
  These are equity feeds that stop updating when the market closes — GOOGL and
  MSFT read 17 and 19 hours stale over a weekend — so a maxAge that does not
  span one halts valuation every Saturday.
- **NFLX and CRCL were requested and cannot be added.** NFLX has no Chainlink
  feed on this chain at all, and neither has liquidity in any standard tier.

## Afterwards

Deposits self-allocate, so the next deposit buys all eight. **Start small.**
SPCX and PLTR are the thinnest pools in the set and trade at 1%; a swap that
blows through the guard's slippage ceiling reverts the whole deposit, not just
its own leg.

The site is already built for eight and is running on the staging host
(`:5015`). It must not go to production until this script has run against both
vaults, or it will name holdings the vaults do not have.
