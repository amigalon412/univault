# Running the keeper on a VPS

The keeper is the only part of Safex that needs a key on an always-on machine.
This is how to put it there without handing over the one key that matters.

## Read this first

The deployer key is `owner`, `keeper` and `feeRecipient` on all twelve
contracts at once. Whoever holds it can retune every guard limit, move the fee
recipient, and register or remove keepers. "There is no money on it" is true
today and stops being true the moment the vaults hold anything, because that
is the address fees are paid to.

The guard was built for exactly this situation. `setKeeper` registers any
address as a keeper, and a registered keeper can do four things, all bounded
on-chain: rebalance toward target, allocate idle balance to the lending venue,
convert accrued fee shares, and spend on the buyback. It cannot choose a
destination for funds, exceed the size or slippage caps, act on a stale price,
or act again before the cooldown expires.

So the machine gets a fresh key that only holds gas. Revoking it later is one
transaction and needs no cooperation from whoever is running the box.

---

## Part 1 — on your machine (owner key, one time)

### 1. Make the keeper wallet

```bash
cast wallet new
```

It prints an address and a private key. **The private key goes to the person
running the VPS and nowhere else — not into a chat, not into this repo, not
into a note synced to anything.** Keep the address; the next two steps need it.

Below, `KEEPER_ADDR` is that address.

### 2. Register it on all three guards

Each guard is separate, so this is three transactions. `setKeeper` is
`onlyOwner`, so these are signed with your key.

```bash
RPC=https://bsc-dataseed.binance.org
KEEPER_ADDR=0x...            # from step 1

for GUARD in \
  0x4FB1425bAe5E05C7De959B1bBDdA49ce6DEFCf8A \
  0xB6312EcAA70B72f2cbec53741A7D2FF5Bdb217CE \
  0x8caB9f8c22AF2823485ef3aBc9eDFE99a72B212B
do
  cast send "$GUARD" 'setKeeper(address,bool)' "$KEEPER_ADDR" true \
    --rpc-url "$RPC" --interactive
done
```

`--interactive` prompts for the key instead of taking it from a flag or an
environment variable, so it never lands in your shell history.

Check it took:

```bash
for GUARD in \
  0x4FB1425bAe5E05C7De959B1bBDdA49ce6DEFCf8A \
  0xB6312EcAA70B72f2cbec53741A7D2FF5Bdb217CE \
  0x8caB9f8c22AF2823485ef3aBc9eDFE99a72B212B
do
  echo -n "$GUARD "
  cast call "$GUARD" 'isKeeper(address)(bool)' "$KEEPER_ADDR" --rpc-url "$RPC"
done
```

Three `true`. If any says `false`, that guard's transaction did not land and
that vault will not be driven.

### 3. Send it gas

The keeper pays for its own transactions and holds nothing else. Send a small
amount of BNB to `KEEPER_ADDR` — 0.01 is a few hundred transactions at BSC gas
prices, topped up when it runs low. It never needs USDT.

---

## Part 2 — on the VPS

Everything here can be done by whoever runs the box. None of it needs your key.

**On 109.71.246.168 this is already done** — steps 4, 5, 6 and 8 ran on
2026-08-13. The service is installed, enabled and ticking in dry run against
all three BNB vaults. Only step 7 is left, and only you can do it. The section
below is kept for a rebuild or a second box.

### 4. Node and a user to run it as

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo useradd --system --home /opt/safex-keeper --shell /usr/sbin/nologin safexkeeper
```

### 5. Copy the keeper across

From a checkout of this repo, on your machine:

```bash
rsync -az --exclude node_modules keeper/ user@VPS:/tmp/safex-keeper/
```

Then on the VPS:

```bash
sudo mkdir -p /opt/safex-keeper
sudo cp -r /tmp/safex-keeper/. /opt/safex-keeper/
cd /opt/safex-keeper && sudo npm ci --omit=dev   # lockfile is committed, so this is reproducible
sudo chown -R safexkeeper:safexkeeper /opt/safex-keeper
```

### 6. Dry run before anything is armed

`DRY_RUN` defaults to on and the key is only read when it is off, so this is
safe with no key present at all. Run it as the service user:

```bash
cd /opt/safex-keeper
sudo -u safexkeeper env VAULT_ADDRESS=0x0c892E668a20a4fE82d7963580ebD0C6A66Ba8F4 \
  GUARD_ADDRESS=0xB6312EcAA70B72f2cbec53741A7D2FF5Bdb217CE \
  npm run once
```

Expect it to read the chain, print what it would do, and send nothing. With no
deposits in the vault the honest answer is that there is nothing to do — that
is a pass, not a failure.

### 7. Install the key — THE ONE STEP THAT ARMS IT

The file carries both the key and `DRY_RUN=false`. That is deliberate: the unit
sets `DRY_RUN=true`, `EnvironmentFile` is read afterwards and wins, so this one
file is the whole switch. Writing it arms the keeper; deleting it and
restarting disarms it. There is nothing else to remember and nothing else to
edit.

```bash
sudo install -m 600 -o root -g root /dev/null /etc/safex-keeper.env
sudo tee /etc/safex-keeper.env >/dev/null <<'EOF'
KEEPER_PRIVATE_KEY=0x...
DRY_RUN=false
EOF
sudo systemctl restart safex-keeper
```

Type the key into that heredoc rather than pasting a command with the key in
it, or it lands in the shell history of a machine you do not control.

**Do not put `DRY_RUN=false` in the unit instead.** With no key present the
keeper calls `required("KEEPER_PRIVATE_KEY")` and exits 1, and under
`Restart=on-failure` that is a crash loop every 30 seconds — not the graceful
fallback an earlier version of this document claimed.

### 8. Start the service

```bash
sudo cp /opt/safex-keeper/deploy/safex-keeper.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now safex-keeper
systemctl status safex-keeper          # active (running)
journalctl -u safex-keeper -f          # three prefixed log streams
```

You should see `[STEADY]`, `[BALANCED]` and `[GROWTH]` lines within a second or
two. Until step 7 they say `mode=DRY RUN` and the keeper sends nothing.

---

## Turning it off

From the VPS:

```bash
sudo rm /etc/safex-keeper.env && sudo systemctl restart safex-keeper   # back to dry run
sudo systemctl stop safex-keeper                                      # or off entirely
```

From anywhere, with the owner key — this works whether or not the machine
cooperates, and is the one that matters:

```bash
cast send "$GUARD" 'setKeeper(address,bool)' "$KEEPER_ADDR" false \
  --rpc-url "$RPC" --interactive
```

Three transactions, one per guard. After them the key on that VPS can do
nothing at all, and any gas left on it is the whole loss.

---

## What it is safe to get wrong

| If this happens | What it costs |
|---|---|
| VPS goes down | Drift is not corrected until it comes back. Deposits still work — allocation happens in the deposit transaction, not here. |
| Keeper key is stolen | The thief can rebalance within the size and slippage caps, once per cooldown. They cannot choose where funds go. Revoke with `setKeeper(..., false)`. |
| Key file is missing | The service starts in dry run and sends nothing — because the unit defaults `DRY_RUN=true`. With `DRY_RUN=false` hardcoded it would crash-loop instead. |
| Two keepers run at once | The second finds nothing to do, or reverts on cooldown. Wasted gas, not damage. |

## What is still on you

The owner key. Nothing above puts it on a server, and nothing above should.
If you ever run `setLimits`, `setTradeLimits` or a redeploy, that is signed
from your machine.
