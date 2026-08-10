# Mainnet deployments — Robinhood Chain (chain id 4663)

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
| ExitRouter | `0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0` | Deployed 2026-07-24, block 17686207. Ownerless, holds no funds. Market-sells a whole position (stocks included) to USDG in one tx via `redeemInKind` + v4 swaps. Powers the "SELL EVERYTHING → USDG" button on BALANCED/GROWTH. |

## Wiring the site

These are what `NEXT_PUBLIC_VAULT_*` / `NEXT_PUBLIC_EXIT_ROUTER` point at. Set the
same values in the Vercel project settings to make the public site read the live
contracts:

```
NEXT_PUBLIC_VAULT_STEADY=0xcd0898066b8345fE23b94Cf6Ea5Ffdd560a1ad37
NEXT_PUBLIC_VAULT_BALANCED=0x3601c09C4F84885454cCbd46B9dF3DaB244c1150
NEXT_PUBLIC_VAULT_GROWTH=0xa809DC62C6fc723E04B061cbE6271AaA093eC75b
NEXT_PUBLIC_EXIT_ROUTER=0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0
```

## Not deployed yet

- **$UNIVAULT token** — `script/DeployToken.s.sol`, separate track.
- **BuybackModule** — nothing to do until fees accrue.

## Abandoned (ignore)

A first BALANCED attempt ran out of gas after deploying only its oracle
(`0xdb92799238e329d35cf6a0df6ba75f040205d95c`) and guard
(`0xb2610e0a5400eca01720b5fa39840b46712048ea`). Those two are orphaned — no
vault, no funds, wired to nothing. The real BALANCED is the one in the table.
