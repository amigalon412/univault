# Mainnet deployments — Robinhood Chain (chain id 4663)

The live contracts. Addresses live here because `.env.local` and the Foundry
broadcast logs are both gitignored — without this file the only record of what
is deployed would be on one machine.

Redeployed 2026-07-25 with the allocate-on-deposit vault (a deposit self-
allocates in the same transaction, paid by the depositor). For every vault:
`owner = keeper = feeRecipient = 0x56D89b63192677c72fCf4C9CB64de592F2833A63`.
Every vault address below was confirmed on mainnet with `cast codesize` and the
expected `targetStableBps` / `autoAllocate=true`.

## Vaults (live — allocate-on-deposit)

| Strategy | Split (stable/equity) | Vault | Guard | Basket | Oracle |
|----------|----------------------|-------|-------|--------|--------|
| STEADY   | 100 / 0  | `0x583bce228448814bc42235d4761290f3ac710a09` | `0xedc4d302ab6c87f77ed084462dc82530e460da11` | — (none by design) | `0x42fd413f655b9b66cef3fd5a3de469e5800a8fed` |
| BALANCED | 60 / 40  | `0x796c05567cf6e00b3a9c453c3c67a5b2a7cd65e7` | `0x35304Ceb350C6ab8d93f99C002d268DbA4Ff0613` | `0x8449202B6525F9632eB25809B91B50c1820fAAE4` | `0x932aa45036045540dbfab7252bd3398f35f32e76` |
| GROWTH   | 30 / 70  | `0xd9a66ef89fe6b2a129b6b78f953d2a89bb7ce04c` | `0xFa71F59495e8c5E4d935b0dC76c327f9eCEf123A` | `0x15AD8f555e1f9Ac05115f88C25cFF76B8121720A` | `0x73723a588c1f6696b13fd1d0d4b86794f641b4da` |

The BALANCED and GROWTH baskets each hold NVDA, AAPL, TSLA and AMZN at 25% via
Uniswap v4 pools (0.30% fee). AMD is deliberately excluded — its pool is hooked
and holds no liquidity.

ExitRouter (`0xB31E70…b7F0`, in the Periphery table) takes the vault as a
parameter and is unaffected by the redeploy — it works against the new vaults.

### Superseded (2026-07-23, pre-allocate-on-deposit, now empty — do not use)

| Strategy | Vault |
|----------|-------|
| STEADY   | `0xFd7223d33335c5A7bdFA44C8Fa0B212cA045A996` |
| BALANCED | `0x066d4661A5419A68b64a0dCF51f5c295185dB175` |
| GROWTH   | `0xBF2b621E86e762C6f4C78aCAc4F1C41087CaB787` |

## Periphery

| Contract | Address | Notes |
|----------|---------|-------|
| ExitRouter | `0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0` | Deployed 2026-07-24, block 17686207. Ownerless, holds no funds. Market-sells a whole position (stocks included) to USDG in one tx via `redeemInKind` + v4 swaps. Powers the "SELL EVERYTHING → USDG" button on BALANCED/GROWTH. |

## Wiring the site

These are what `NEXT_PUBLIC_VAULT_*` / `NEXT_PUBLIC_EXIT_ROUTER` point at. Set the
same values in the Vercel project settings to make the public site read the live
contracts:

```
NEXT_PUBLIC_VAULT_STEADY=0x583bce228448814bc42235d4761290f3ac710a09
NEXT_PUBLIC_VAULT_BALANCED=0x796c05567cf6e00b3a9c453c3c67a5b2a7cd65e7
NEXT_PUBLIC_VAULT_GROWTH=0xd9a66ef89fe6b2a129b6b78f953d2a89bb7ce04c
NEXT_PUBLIC_EXIT_ROUTER=0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0
```

## Not deployed yet

- **$BLUR token** — `script/DeployToken.s.sol`, separate track.
- **BuybackModule** — nothing to do until fees accrue.

## Abandoned (ignore)

A first BALANCED attempt ran out of gas after deploying only its oracle
(`0xdb92799238e329d35cf6a0df6ba75f040205d95c`) and guard
(`0xb2610e0a5400eca01720b5fa39840b46712048ea`). Those two are orphaned — no
vault, no funds, wired to nothing. The real BALANCED is the one in the table.
