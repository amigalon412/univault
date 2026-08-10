# Hosting requirements

> Why not `requirements.txt`? That filename is a Python convention. Dropping one
> in the repo root makes Vercel/Netlify/Render auto-detect this as a Python
> project and break the Node build. This file is the Node/Next.js equivalent.

This repo ships two independently deployable things:

1. **The website** — a Next.js 16 app. This is what users load. Deploy it.
2. **The keeper** — an optional always-on Node worker (`keeper/`). With
   deposit-time allocation live (`autoAllocate`), the vaults run without it; the
   keeper only matters if you want automated drift-rebalancing/buybacks. It must
   **not** run on Vercel (it is long-lived and holds a private key).

---

## 1. Website (Next.js) — the thing to host

### Runtime
- **Node.js >= 24** (`.nvmrc` pins `24`; `package.json` engines require `>=24`).
- Package manager: **npm** (a `package-lock.json` is committed).

### Build & run
| Step    | Command          | Notes                                   |
|---------|------------------|-----------------------------------------|
| Install | `npm ci`         | Clean, lockfile-exact install.          |
| Build   | `npm run build`  | Next.js production build (Turbopack).   |
| Start   | `npm start`      | Serves the built app on `$PORT` (3000). |

On **Vercel** the framework preset handles build/start for you — set only the
env vars below and deploy. Any Node host (Render, Fly, a container, a VPS)
works too: `npm ci && npm run build && npm start`.

### Environment variables
All browser-facing values are `NEXT_PUBLIC_*` and **ship in the client bundle —
none are secret**. A strategy left blank renders as "NOT DEPLOYED" instead of
inventing numbers.

| Variable                     | Required | Purpose                                                        |
|------------------------------|----------|----------------------------------------------------------------|
| `NEXT_PUBLIC_VAULT_STEADY`   | yes      | STEADY vault address. Current: `0xcd0898066b8345fE23b94Cf6Ea5Ffdd560a1ad37` |
| `NEXT_PUBLIC_VAULT_BALANCED` | yes      | BALANCED vault address. Current: `0x3601c09C4F84885454cCbd46B9dF3DaB244c1150` |
| `NEXT_PUBLIC_VAULT_GROWTH`   | yes      | GROWTH vault address. Current: `0xa809DC62C6fc723E04B061cbE6271AaA093eC75b` |
| `NEXT_PUBLIC_EXIT_ROUTER`    | yes*     | ExitRouter for one-tx "sell to USDG". `0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0`. *Without it the "sell everything" button is hidden. |
| `NEXT_PUBLIC_BLUR_TOKEN`     | no       | $BLUR token address. Normally left blank — publish it from `/admin` instead, which needs no rebuild. Kept only as a build-time fallback. |
| `NEXT_PUBLIC_SITE_URL`       | no       | Canonical URL for OG/social images. Vercel supplies its own; set only on a custom domain, e.g. `https://univault.pro`. |

> Vercel also injects `VERCEL_PROJECT_PRODUCTION_URL` automatically — no action.

**Server-side variables.** These are *not* `NEXT_PUBLIC_*`, never reach the
browser, and drive the `/admin` page:

| Variable               | Required | Purpose                                                  |
|------------------------|----------|----------------------------------------------------------|
| `ADMIN_PASSWORD`       | no       | Enables `/admin`. Minimum 12 chars. **Unset ⇒ the admin page is switched off entirely**, which is the safe default. |
| `BLUR_DATA_DIR`        | on a VPS | Directory for the published $BLUR address. Must sit **outside** the deploy dir or a redeploy wipes it. Defaults to `./.data`. |
| `ADMIN_SESSION_SECRET` | no       | Signs session cookies independently of the password. By default the key is derived from `ADMIN_PASSWORD`, so rotating the password logs everyone out. |

> `/admin` writes to the filesystem, so it works on a VPS or any host with a
> persistent disk. **It does not work on Vercel**, whose filesystem is
> read-only and per-invocation — there you would have to keep using
> `NEXT_PUBLIC_BLUR_TOKEN` and redeploy, or move the store to a database.

### External services the site talks to (no keys needed)
- **Robinhood Chain RPC** `https://rpc.mainnet.chain.robinhood.com` (chain id 4663) — read calls + wallet tx.
- The user's own wallet (injected/EIP-1193) via wagmi. No WalletConnect project id is required by the current config.

---

## 1a. Self-hosting on a VPS (Ubuntu/Debian runbook)

Same app, no Vercel. Full walkthrough for a fresh VPS.

> **Order matters:** `NEXT_PUBLIC_*` values are inlined into the bundle at
> `npm run build`, not read at start. So always write `.env.local` **before**
> building, and rebuild after changing any address.

**1. Node 24 + git** (NodeSource):
```bash
sudo apt update && sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v      # v24.x
```

**2. Get the code:**
```bash
cd /var/www
sudo mkdir -p blurvault && sudo chown $USER:$USER blurvault
git clone <git-repo-url> blurvault && cd blurvault
```

**3. Env file (before building):**
```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_VAULT_STEADY=0xcd0898066b8345fE23b94Cf6Ea5Ffdd560a1ad37
NEXT_PUBLIC_VAULT_BALANCED=0x3601c09C4F84885454cCbd46B9dF3DaB244c1150
NEXT_PUBLIC_VAULT_GROWTH=0xa809DC62C6fc723E04B061cbE6271AaA093eC75b
NEXT_PUBLIC_EXIT_ROUTER=0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0
NEXT_PUBLIC_SITE_URL=https://univault.pro
EOF
```

**4. Install + build:**
```bash
npm ci
npm run build
```

**4a. Admin password + data directory** (so you can publish the $BLUR CA after
launch without rebuilding):
```bash
sudo mkdir -p /var/lib/blurvault && sudo chown "$USER" /var/lib/blurvault

# generate a real password; the tee prints it once — save it now
printf 'ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 24)" | sudo tee /etc/blurvault.env
sudo chmod 600 /etc/blurvault.env
```
Whoever has this password can make the site display any address as the official
`$BLUR` CA, so do not choose it by hand.

**5. Run as a systemd service** (survives crashes and reboots):
```bash
sudo tee /etc/systemd/system/blurvault.service > /dev/null <<EOF
[Unit]
Description=BLUR vault website (Next.js)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/var/www/blurvault
ExecStart=/usr/bin/npm start
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=BLUR_DATA_DIR=/var/lib/blurvault
EnvironmentFile=-/etc/blurvault.env
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now blurvault
sudo systemctl status blurvault      # active (running)
```
The app now listens on `127.0.0.1:3000`; nginx exposes it.

**5a. On launch day**, open `https://your-domain/admin`, sign in with
`ADMIN_PASSWORD`, paste the `$BLUR` contract address and press PUBLISH. The
header strip shows it site-wide from the next page load — no rebuild, no
restart. Publishing an empty field clears it and restores the "not launched"
warning. Wrong-password attempts are throttled to 8 per 15 min per IP; a
`systemctl restart blurvault` clears the counter if you lock yourself out.

### Lean deploy for a tiny VPS (standalone bundle, ~40 MB, no node_modules)

`next.config.ts` sets `output: "standalone"`, so `npm run build` emits a
self-contained server at `.next/standalone` that bundles only the runtime files
it actually reaches. The running app is **~40 MB total** instead of ~900 MB, and
the server never needs `node_modules` or the build step at all.

Two ways to use it:

**A — build off-server, ship only the bundle** (best for a 1 GB box: no build
RAM, no `npm ci`, no OOM). On your dev machine, after `npm run build`:
```bash
# assemble a runnable folder (static assets aren't copied into standalone automatically)
cp -r .next/static .next/standalone/.next/static
cp -r public       .next/standalone/public
# ship it
rsync -az .next/standalone/ user@server:/var/www/blurvault/
```
On the server the whole app is `/var/www/blurvault/server.js`. No install needed.

**B — build on the server, then drop node_modules** (if you'd rather build there):
```bash
npm ci && npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public       .next/standalone/public
rm -rf node_modules .next/cache      # reclaim ~700 MB once the bundle exists
```

Either way, point systemd at the standalone server instead of `npm start` —
replace the `ExecStart`/`WorkingDirectory` lines above with:
```ini
WorkingDirectory=/var/www/blurvault           # (path that contains server.js)
ExecStart=/usr/bin/node server.js
```
The standalone server honours `PORT` and `HOSTNAME` from the same `Environment=`
lines. Everything downstream (nginx, TLS) is unchanged.

**6. Nginx reverse proxy:**
```bash
sudo apt install -y nginx
sudo tee /etc/nginx/sites-available/blurvault > /dev/null <<'EOF'
server {
    listen 80;
    server_name univault.pro www.univault.pro;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/blurvault /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**7. DNS** — at the registrar, point A records at the VPS IP:
```
A   @     <server-ip>
A   www   <server-ip>
```

**8. HTTPS** (Let's Encrypt, auto-renews):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d univault.pro -d www.univault.pro
```

**9. Firewall:**
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

**Updating later:**
```bash
cd /var/www/blurvault
git pull && npm ci && npm run build
sudo systemctl restart blurvault
```

**Sizing:** 1 vCPU / 1 GB RAM is enough for `next start`. If `npm run build`
runs out of memory on 1 GB, add swap:
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 2. Keeper (optional worker) — do NOT put on Vercel

A plain Node >= 24 process. Run it on anything that stays up (a small VM,
`systemd`, a container, `pm2`). One process **per vault** (see `keeper/run-all.sh`).

### Environment variables
| Variable              | Required | Purpose                                                       |
|-----------------------|----------|---------------------------------------------------------------|
| `KEEPER_PRIVATE_KEY`  | to act   | **SECRET.** Hot key of an address registered as a keeper on the guard. Fund it with a little ETH for gas. Never commit it. |
| `VAULT_ADDRESS`       | yes      | Vault this process drives.                                     |
| `GUARD_ADDRESS`       | yes      | KeeperGuard for that vault.                                    |
| `RPC_URL`             | no       | Defaults to the mainnet RPC above.                            |
| `DRY_RUN`             | no       | **Defaults to `true`** — set `DRY_RUN=false` to actually send. |
| `BUYBACK_ADDRESS`     | no       | Enables the buyback half of the job.                          |
| `MIN_DEPLOY_UNITS` / `MIN_FEE_UNITS` / `MIN_BUYBACK_UNITS` | no | Dust thresholds (USDG, 6 dp). |
| `BUYBACK_SLIPPAGE_BPS` | no      | Buyback fill tolerance vs. a fresh quote (default 100 = 1%).  |
| `POLL_MS`             | no       | Tick interval (default 60000).                                |

Install & run:
```bash
cd keeper && npm ci
KEEPER_PRIVATE_KEY=0x... DRY_RUN=false bash run-all.sh
```
> ⚠️ Before running, fix the vault/guard addresses hard-coded in
> `keeper/run-all.sh` — they still point at the **superseded** vaults, not the
> current ones listed above. See `contracts/DEPLOYMENTS.md`.

---

## Not required
- No database, Redis, or object storage.
- No server-side secrets for the website (it is a static+RSC front end to
  on-chain contracts).
- No Python, and therefore no `requirements.txt`.
