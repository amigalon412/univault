# Deployments

Two chains. **BNB Chain is the live product**; Robinhood Chain is the previous
deployment, still on chain and still holding nothing.

Addresses live in this file because `.env.local` and the Foundry broadcast logs
are both gitignored -- without it the only record of what is deployed would be
on one machine. `scripts/check-addresses.mjs` reads it back against
`src/lib/chain.ts`, so an address that reaches the site and not this file fails
the build.

---

# BNB Chain (chain id 56) -- LIVE

Deployed 2026-08-13 in one batch, 53 transactions, all successful, 25,686,496
gas. Owner and fee recipient for every contract:
`0x13fB1e4C02bEC80377d17c2D187f85b27DD90222`.

Every figure below was read back off the chain after the fact, not copied from
the broadcast log.

## Vaults

| Strategy | Split (stable/equity) | Vault | Shares |
|----------|----------------------|-------|--------|
| STEADY   | 100 / 0  | `0x8F6154E79471CE8538f0DCEb9D0cf90d48D883E6` | `sfxSTEADY` |
| BALANCED | 60 / 40  | `0x0c892E668a20a4fE82d7963580ebD0C6A66Ba8F4` | `sfxBALANCED` |
| GROWTH   | 30 / 70  | `0x12a2DC45Cd51F26075129332ceD4bC6e1e190ae5` | `sfxGROWTH` |

All three take **USDT** (`0x55d398326f99059fF775485246999027B3197955`), which is
**18 decimals, not 6**. Shares are therefore **24 decimals**: ERC-4626's
inflation-attack offset is 6 and it is added to the asset's. On Robinhood Chain
the asset was 6dp and shares were 12dp. Anything off chain that hard-coded 12
is wrong by a million-fold here.

## Per-vault machinery

| Strategy | Oracle | Guard | Basket |
|----------|--------|-------|--------|
| STEADY   | `0x624f480665aA4eF84f15a53cc76ce9a9F07735cf` | `0x4FB1425bAe5E05C7De959B1bBDdA49ce6DEFCf8A` | — (none by design) |
| BALANCED | `0xf1C6503a26fB311281E7C588999E837d2Aac4362` | `0xB6312EcAA70B72f2cbec53741A7D2FF5Bdb217CE` | `0x0C55a91caBDbD63000983286dd78ABC889a513BE` |
| GROWTH   | `0xA6888102e9e13613db8cB747d52F301059b86Dd9` | `0x8caB9f8c22AF2823485ef3aBc9eDFE99a72B212B` | `0xEb25dE433C682D26b29EA7b9d543cDd935bE6090` |

## Lending leg

`0xf9ABEa4Bf8FeBEDB9FEd8eCF7a7F1272C49f5424` — `Safex USDT (Venus)` / `sfxUSDT`,
our ERC-4626 wrapper over Venus's core USDT market
(`0xfD5840Cd36d94D7229439859C0112a4185BC0255`). Shared by all three vaults.

A wrapper and not the venue itself because Venus's core market is a Compound v2
vToken. Venus ships an official 4626 factory
(`0xC2f7924809830886EB04c6b40725Fd68F1891fA2`) and it was tried first:
`createERC4626` on the core market reverts with
`VenusERC4626Factory__InvalidVToken`, because that factory only accepts vTokens
registered in the isolated-pool registry. Measured, those isolated USDT pools
hold four to five figures at ~3% utilisation while the core market holds ~$90M
of cash against ~$117M of borrows. The wrapper Venus provides is available
exactly where the yield is not.

## Basket — five names, 2000 bps each

Both adapters report `tokensLength() == 5` and `isValuable() == true`.

| Ticker | Token | Chainlink feed | Pool tier |
|--------|-------|----------------|-----------|
| SPYB   | `0x7138b48df7D98D7e3cc221BfE7192D0a178182D8` | `0xb24D1DeE5F9a3f761D286B56d2bC44CE1D02DF7e` | 0.01% |
| QQQB   | `0x205812CdBed920aFf76C6580abD681a46D11efc7` | `0x9A41B56b2c24683E2f23BdE15c14BC7c4a58c3c4` | 0.01% |
| GOOGLB | `0x3F53De71c126BdaBAe20f9cD64848d317f6C3238` | `0xeDA73F8acb669274B15A977Cb0cdA57a84F18c2a` | 0.25% |
| MSFTB  | `0x80106cb3EAD06659A5ad19DF39D9b4733863B9b0` | `0x5D209cE1fBABeAA8E6f9De4514A74FFB4b34560F` | 0.25% |
| METAB  | `0x7425889FE94F9d693E8daefE88BCCed6AcFEf4c0` | `0xfc76E9445952A3C31369dFd26edfdfb9713DF5Bb` | 0.25% |

These are Binance's bStocks, trading on PancakeSwap v3 against USDT. **The tier
is not uniform and is stored per token** -- deriving it from a constant is what
broke the first ExitRouter on the other chain.

Why these five and not the eight from Robinhood Chain: a name has to exist here,
have a pool with depth, and have a Chainlink feed on this chain. NVDA, AAPL,
TSLA and AMZN have feeds on BSC but Binance never issued them as bStocks;
Backed's xStocks do exist and are unusable ($16k in one NVDAx pool, $37 and $21
for TSLAx, no AAPLx pair). MSTRB, INTCB and SOXLB trade but have no feed. Nine
more are issued with zero liquidity. Full reasoning in `src/BnbChain.sol`.

## Exit router

`0x795A0bEAB813Ea9BefB6124997FE2a3522096abc` — **BnbExitRouter**, deployed
2026-08-13, block 115725204, tx
`0x86f11093bf2a4c9fda7d83919597b1329a927fbd9a02eba7aaa99f3a31ed0f2e`,
755,091 gas.

Ownerless, holds no funds between calls, nothing to configure — no `Ownable`,
no privileged functions. It could therefore have been deployed from any
address without changing a thing about it.

Market-sells a whole position, stock leg included, to USDT in one transaction
via `redeemInKind` plus PancakeSwap v3 swaps. Powers the "sell everything"
button on BALANCED and GROWTH. It reads each leg's fee tier off the basket
adapter on every call rather than keeping its own copy — the tier is not
uniform here, and a stored copy is what broke the first ExitRouter on the
other chain.

## Not deployed here yet
- **A keeper.** `setKeeper` was never called, so no address may rebalance. The
  guard is still the owner's, so this is one transaction whenever an address
  exists for it. Until then the vaults hold their split only as deposits set it.
- **$SAFEX token, staking, BuybackModule.**

## Wiring the site

```
NEXT_PUBLIC_VAULT_STEADY=0x8F6154E79471CE8538f0DCEb9D0cf90d48D883E6
NEXT_PUBLIC_VAULT_BALANCED=0x0c892E668a20a4fE82d7963580ebD0C6A66Ba8F4
NEXT_PUBLIC_VAULT_GROWTH=0x12a2DC45Cd51F26075129332ceD4bC6e1e190ae5
```

These are also the defaults compiled into `src/lib/chain.ts`, so a clean
checkout builds against them with no `.env.local` at all.

---

# Robinhood Chain (chain id 4663) -- PREVIOUS

The live contracts. Addresses live here because `.env.local` and the Foundry
broadcast logs are both gitignored — without this file the only record of what
is deployed would be on one machine.

Redeployed 2026-08-10 to carry the rename. The vaults these replace were
deployed as `BlurVault` and minted shares called `BLUR Balanced` /
`blurBALANCED`; a share token's name and symbol are constructor arguments with
no setter, so deploying again was the only way to change them. These mint
`Univault Balanced` / `uvBALANCED` — confirmed by reading `name()` and
`symbol()` back off each address. The whole redeploy cost 0.00066793 ETH.

For every vault: `owner = feeRecipient = 0x13fB1e4C02bEC80377d17c2D187f85b27DD90222`.
Each was read back with `scripts/verify-deployment.mjs`: splits 100 / 60 / 30,
fee 5%, guards live, both baskets holding NVDA · AAPL · TSLA · AMZN at 25% and
already sealed against substitution.

## Vaults (live — allocate-on-deposit)

| Strategy | Split (stable/equity) | Vault | Guard | Basket | Oracle |
|----------|----------------------|-------|-------|--------|--------|
| STEADY   | 100 / 0  | `0xcd0898066b8345fE23b94Cf6Ea5Ffdd560a1ad37` | `0x101183e175EA27E059Fd44E6B36e5fBF1f466F26` | — (none by design) | `0xc5fF460259034d15AA0a149Bc035f4AF98a47139` |
| BALANCED | 60 / 40  | `0x3601c09C4F84885454cCbd46B9dF3DaB244c1150` | `0x9a2aA7D2dd221aF99410215E5904146a7c96e1E7` | `0xA36f535E0035bb068cc27ca59137eF36b193f273` | `0x6EEd6275c580C43A97825e9870397f96FA181ea8` |
| GROWTH   | 30 / 70  | `0xa809DC62C6fc723E04B061cbE6271AaA093eC75b` | `0x56CAceC02cc8DCb729b209cA1b8EdF5609da091B` | `0x76d58d2cF50BdB37e50117c5b7DfB6d579c7c609` | `0x7C3Ff9e01Dcb472D297648AbeDF5c1F595D3Deff` |

The BALANCED and GROWTH baskets each hold NVDA, AAPL, TSLA and AMZN at 25% via
Uniswap v4 pools (0.30% fee). AMD is deliberately excluded — its pool is hooked
and holds no liquidity.

ExitRouter (`0xB31E70…b7F0`, in the Periphery table) takes the vault as a
parameter and is unaffected by the redeploy — it works against the new vaults.

### Source verification — NOT DONE YET for this set

**These eleven contracts are live but not yet verified on Blockscout.** Until
they are, the explorer shows bytecode rather than Solidity, and the docs page
telling readers to "paste one into the explorer and you get the Solidity" is
ahead of reality. Run it:

```
cd contracts && bash script/verify-all.sh --dry-run   # check the plan first
cd contracts && bash script/verify-all.sh
```

It sends no transaction and needs no key.

The retired 07-24 guards needed a special dance — they predated `423d0b9`,
which lowered `MAX_SLIPPAGE_BPS` from `10_000` to `1_000`, so they only matched
a build from `423d0b9^`. **That does not apply here.** This set was built from
HEAD, after the change, so it verifies straight from the current source.

### Superseded — do not use

Both sets are still on chain and still answer calls. Neither holds anything.
The 07-24 set is the dangerous one to confuse: it worked, it was verified, and
it is what every link written before 2026-08-10 points at.

| Retired    | Why | Strategy | Vault |
|------------|-----|----------|-------|
| 2026-08-10 | minted `blurBALANCED`; replaced by the rename | STEADY   | `0x583Bce228448814BC42235d4761290F3ac710a09` |
|            |                                              | BALANCED | `0x796c05567cf6E00B3a9C453C3c67a5b2a7cD65e7` |
|            |                                              | GROWTH   | `0xD9a66EF89FE6B2a129B6B78F953d2a89bb7ce04C` |
| 2026-07-23 | pre-allocate-on-deposit                      | STEADY   | `0xFd7223d33335c5A7bdFA44C8Fa0B212cA045A996` |
|            |                                              | BALANCED | `0x066d4661A5419A68b64a0dCF51f5c295185dB175` |
|            |                                              | GROWTH   | `0xBF2b621E86e762C6f4C78aCAc4F1C41087CaB787` |

## Periphery

| Contract | Address | Notes |
|----------|---------|-------|
| ExitRouter | `0x2304d57bA6E5EecD3d4d8Cc657740D9aa5824035` | Deployed 2026-08-11, block 33782241. Ownerless, holds no funds. Market-sells a whole position (stocks included) to USDG in one tx via `redeemInKind` + v4 swaps. Powers the "SELL EVERYTHING → USDG" button on BALANCED/GROWTH. |

The router it replaced (`0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0`, deployed
2026-07-24) built each swap's PoolKey from `RobinhoodChain.basketPool()`, which
hard-codes the 0.30% tier. True of all four holdings the day it shipped; false
the moment the basket grew, because SPCX and PLTR trade at 1% and their 0.30%
pools are empty or absent. The swap reverted and took the whole exit with it —
unlike a deposit, that loop has no per-leg fallback, so the button simply
stopped working for anyone in BALANCED or GROWTH.

The replacement reads `poolKeys(token)` off the vault's own adapter instead, so
it cannot fall behind the basket again. Nothing points at the old one; it is
ownerless and holds nothing, so it was left where it is rather than touched.

## Wiring the site

These are what `NEXT_PUBLIC_VAULT_*` / `NEXT_PUBLIC_EXIT_ROUTER` point at. Set the
same values in the Vercel project settings to make the public site read the live
contracts:

```
NEXT_PUBLIC_VAULT_STEADY=0xcd0898066b8345fE23b94Cf6Ea5Ffdd560a1ad37
NEXT_PUBLIC_VAULT_BALANCED=0x3601c09C4F84885454cCbd46B9dF3DaB244c1150
NEXT_PUBLIC_VAULT_GROWTH=0xa809DC62C6fc723E04B061cbE6271AaA093eC75b
NEXT_PUBLIC_EXIT_ROUTER=0x2304d57bA6E5EecD3d4d8Cc657740D9aa5824035
```

## Not deployed yet

- **$UNIVAULT token** — `script/DeployToken.s.sol`, separate track.
- **BuybackModule** — nothing to do until fees accrue.

## Abandoned (ignore)

A first BALANCED attempt ran out of gas after deploying only its oracle
(`0xdb92799238e329d35cf6a0df6ba75f040205d95c`) and guard
(`0xb2610e0a5400eca01720b5fa39840b46712048ea`). Those two are orphaned — no
vault, no funds, wired to nothing. The real BALANCED is the one in the table.
