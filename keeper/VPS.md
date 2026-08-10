# Running the keeper on someone else's VPS

The keeper is the only part of Univault that needs a key on an always-on machine.
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
RPC=https://rpc.mainnet.chain.robinhood.com
KEEPER_ADDR=0x...            # from step 1

for GUARD in \
  0x101183e175EA27E059Fd44E6B36e5fBF1f466F26 \
  0x9a2aA7D2dd221aF99410215E5904146a7c96e1E7 \
  0x56CAceC02cc8DCb729b209cA1b8EdF5609da091B
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
  0x101183e175EA27E059Fd44E6B36e5fBF1f466F26 \
  0x9a2aA7D2dd221aF99410215E5904146a7c96e1E7 \
  0x56CAceC02cc8DCb729b209cA1b8EdF5609da091B
do
  echo -n "$GUARD "
  cast call "$GUARD" 'isKeeper(address)(bool)' "$KEEPER_ADDR" --rpc-url "$RPC"
done
```

Three `true`. If any says `false`, that guard's transaction did not land and
that vault will not be driven.

### 3. Send it gas

The keeper pays for its own transactions and holds nothing else. Send a small
amount of the chain's native token to `KEEPER_ADDR` — enough for a few hundred
transactions, topped up when it runs low. It never needs USDG.

---

## Part 2 — on the VPS

Everything here can be done by whoever runs the box. None of it needs your key.

### 4. Node and a user to run it as

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo useradd --system --home /opt/blur-keeper --shell /usr/sbin/nologin blurkeeper
```

### 5. Copy the keeper across

From a checkout of this repo, on your machine:

```bash
rsync -az --exclude node_modules keeper/ user@VPS:/tmp/blur-keeper/
```

Then on the VPS:

```bash
sudo mkdir -p /opt/blur-keeper
sudo cp -r /tmp/blur-keeper/. /opt/blur-keeper/
cd /opt/blur-keeper && sudo npm ci --omit=dev   # lockfile is committed, so this is reproducible
sudo chown -R blurkeeper:blurkeeper /opt/blur-keeper
```

### 6. Dry run before anything is armed

`DRY_RUN` defaults to on and the key is only read when it is off, so this is
safe with no key present at all. Run it as the service user:

```bash
cd /opt/blur-keeper
sudo -u blurkeeper env VAULT_ADDRESS=0x3601c09C4F84885454cCbd46B9dF3DaB244c1150 \
  GUARD_ADDRESS=0x9a2aA7D2dd221aF99410215E5904146a7c96e1E7 \
  npm run once
```

Expect it to read the chain, print what it would do, and send nothing. With no
deposits in the vault the honest answer is that there is nothing to do — that
is a pass, not a failure.

### 7. Install the key

```bash
printf 'KEEPER_PRIVATE_KEY=%s\n' '0x...' | sudo tee /etc/blur-keeper.env >/dev/null
sudo chmod 600 /etc/blur-keeper.env
sudo chown root:root /etc/blur-keeper.env
```

Type the key at that prompt rather than pasting the command with the key in
it, or it lands in the shell history of a machine you do not control.

### 8. Start the service

```bash
sudo cp /opt/blur-keeper/deploy/blur-keeper.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now blur-keeper
systemctl status blur-keeper          # active (running)
journalctl -u blur-keeper -f          # three prefixed log streams
```

You should see `[STEADY]`, `[BALANCED]` and `[GROWTH]` lines. The unit sets
`DRY_RUN=false`, so from here it will send transactions when the guard lets it.

---

## Turning it off

From the VPS:

```bash
sudo systemctl stop blur-keeper
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
| Key file is missing | The service starts in dry run and sends nothing. |
| Two keepers run at once | The second finds nothing to do, or reverts on cooldown. Wasted gas, not damage. |

## What is still on you

The owner key. Nothing above puts it on a server, and nothing above should.
If you ever run `setLimits`, `setTradeLimits` or a redeploy, that is signed
from your machine.
