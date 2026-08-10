# Going live on Robinhood Chain

The steps only you can run, because they sign with your key and spend your
funds. Everything here was rehearsed on a fork first: deploy → verify → deposit
$5 → withdraw $5, clean.

Claude cannot run these — it does not handle private keys. Run them yourself, in
your own terminal or with the `!` prefix in the session so the output comes
back.

## Before you start

You need, on Robinhood Chain, at the address you will deploy from:

- **ETH for gas.** The whole STEADY launch is about **$1** at current gas. A
  few dollars is plenty.
- **USDG** — only if you want to deposit. Deploying costs no USDG.

Decide two addresses:

- `OWNER` — holds every contract afterwards. Use a wallet you control; a
  hardware wallet is the right call the moment anyone else's money is involved.
- `KEEPER` — the bot's address, which runs allocation and rebalancing. It can
  be the same as OWNER for a first test, but its key goes online, so for
  anything real make it a separate throwaway that holds only gas.

## The minimum that works: STEADY

STEADY is pure USDG lending — no token, no pool, no stock basket. It is the
shortest path to a working deposit.

```bash
cd contracts

export DEPLOYER_PK=0x...          # the key you deploy from — never paste this into a chat
export OWNER=0x...                # your wallet
export KEEPER=0x...               # bot address (may equal OWNER for a test)

OWNER=$OWNER KEEPER=$KEEPER TARGET_STABLE_BPS=10000 \
VAULT_NAME="Univault Steady" VAULT_SYMBOL=uvSTEADY \
forge script script/DeployStack.s.sol:DeployStack \
  --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --broadcast --private-key $DEPLOYER_PK
```

It prints `guard` and `vault` addresses. Keep them.

### Verify before trusting it

A script that ran is not a deployment that is correct. Read it back:

```bash
cd ..
RPC=https://rpc.mainnet.chain.robinhood.com \
VAULT=0x...THE_VAULT GUARD=0x...THE_GUARD \
OWNER=$OWNER KEEPER=$KEEPER \
node scripts/verify-deployment.mjs
```

Expect all checks green, with one warning: "the basket slot is still open."
That is fine for STEADY — it has no basket by design. It stops being a warning
the moment the vault takes its first deposit.

### Put the address on the site

In the site's environment (Vercel project settings, or a local `.env.local`):

```
NEXT_PUBLIC_VAULT_STEADY=0x...THE_VAULT
```

Redeploy the site. `/app` now shows the vault, takes a deposit, and reads the
live balance. No code change.

### Make it actually earn

A deposit sits idle until it is moved into the lending venue. Two ways:

- Call it once yourself: `cast send $VAULT "deployIdle()" --private-key $OWNER_PK ...`
- Or run the keeper, which does it on a schedule:

```bash
cd keeper && npm install
DRY_RUN=false KEEPER_PRIVATE_KEY=0x... \
VAULT_ADDRESS=0x...THE_VAULT GUARD_ADDRESS=0x...THE_GUARD \
npm start
```

## BALANCED and GROWTH

Same command, different split — these add the stock basket automatically:

```bash
# BALANCED — 60% lending, 40% stocks
OWNER=$OWNER KEEPER=$KEEPER TARGET_STABLE_BPS=6000 \
VAULT_NAME="Univault Balanced" VAULT_SYMBOL=uvBALANCED \
forge script script/DeployStack.s.sol:DeployStack --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast --private-key $DEPLOYER_PK

# GROWTH — 30% lending, 70% stocks
OWNER=$OWNER KEEPER=$KEEPER TARGET_STABLE_BPS=3000 \
VAULT_NAME="Univault Growth" VAULT_SYMBOL=uvGROWTH \
forge script script/DeployStack.s.sol:DeployStack --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast --private-key $DEPLOYER_PK
```

Verify each, then set `NEXT_PUBLIC_VAULT_BALANCED` and `NEXT_PUBLIC_VAULT_GROWTH`.

## The $BLUR token and buyback — later, and separate

None of the vaults need $BLUR. The token, its USDG pool, and the buyback module
are their own track, and the buyback only has something to do once fees have
accrued. Deploy the token with `script/DeployToken.s.sol` when you want it; the
pool and liquidity are a manual Uniswap step after that.

## Order, so nothing is ever a lie

1. Deploy the vault(s).
2. Verify each.
3. Put the addresses on the site and redeploy it.
4. Only then post the video. Its "Live now" is true from that point, not before.
