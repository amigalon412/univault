# Mainnet deployments — Robinhood Chain (chain id 4663)

The live contracts. Addresses live here because `.env.local` and the Foundry
broadcast logs are both gitignored — without this file the only record of what
is deployed would be on one machine.

Deployed 2026-07-23. For every vault:
`owner = keeper = feeRecipient = 0x56D89b63192677c72fCf4C9CB64de592F2833A63`.

All three passed `scripts/verify-deployment.mjs` with only the expected
warning (no buyback module wired yet).

## Vaults

| Strategy | Split (stable/equity) | Vault | Guard | Basket | Oracle |
|----------|----------------------|-------|-------|--------|--------|
| STEADY   | 100 / 0  | `0xFd7223d33335c5A7bdFA44C8Fa0B212cA045A996` | `0x7f51f8b63376c2c744f3ec11834db14149ac8b1b` | — (none by design) | `0x67d269191c92caf3cd7723f116c85e6e9bf55933` |
| BALANCED | 60 / 40  | `0x066d4661A5419A68b64a0dCF51f5c295185dB175` | `0x706ABbA724aFB0A4580D8CDC670A00FE2096Dfd9` | `0x445ecDbe8111aF7cA70434519429be58e044b9e5` | `0x2d3f68B6cd68f02Edc2591c26BD8b24e1Fea7ebF` |
| GROWTH   | 30 / 70  | `0xBF2b621E86e762C6f4C78aCAc4F1C41087CaB787` | `0xd95480270452b6a53a6613ee368A918060404839` | `0x09c6e6207801BDfe8b784D29e1621EF448D07fCB` | `0x0D68494113EF334fb1b4bD2b083c7E655CE9A7B0` |

The BALANCED and GROWTH baskets each hold NVDA, AAPL, TSLA and AMZN at 25% via
Uniswap v4 pools (0.30% fee). AMD is deliberately excluded — its pool is hooked
and holds no liquidity.

## Wiring the site

These are what `NEXT_PUBLIC_VAULT_*` point at. Set the same three in the Vercel
project settings to make the public site read the live vaults:

```
NEXT_PUBLIC_VAULT_STEADY=0xFd7223d33335c5A7bdFA44C8Fa0B212cA045A996
NEXT_PUBLIC_VAULT_BALANCED=0x066d4661A5419A68b64a0dCF51f5c295185dB175
NEXT_PUBLIC_VAULT_GROWTH=0xBF2b621E86e762C6f4C78aCAc4F1C41087CaB787
```

## Not deployed yet

- **$BLUR token** — `script/DeployToken.s.sol`, separate track.
- **BuybackModule** — nothing to do until fees accrue.

## Abandoned (ignore)

A first BALANCED attempt ran out of gas after deploying only its oracle
(`0xdb92799238e329d35cf6a0df6ba75f040205d95c`) and guard
(`0xb2610e0a5400eca01720b5fa39840b46712048ea`). Those two are orphaned — no
vault, no funds, wired to nothing. The real BALANCED is the one in the table.
