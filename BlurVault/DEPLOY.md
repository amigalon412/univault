# BlurVault — deploy bundle

Everything needed to launch and host the BlurVault website, self-contained. The
site is a static+SSR front end that talks straight to the contracts on Robinhood
Chain — **no database, no backend secrets, no keeper required.**

```
BlurVault/
├── app/                     ← the whole running site (~37 MB, no node_modules needed)
│   ├── server.js            ← entrypoint: `node server.js`
│   ├── .next/ , public/     ← compiled app + assets
├── deploy/
│   ├── blurvault.service    ← systemd unit
│   ├── blurvault.nginx      ← nginx reverse-proxy block
│   └── baked-config.txt     ← the addresses compiled into app/ (FYI, nothing to set)
└── DEPLOY.md                ← this file
```

The vault addresses and the `https://blurvault.pro` site URL are **already
compiled into `app/`**. The one thing you do set on the server is the admin
password, so you can publish the `$BLUR` contract address after launch without
rebuilding anything — see [Publishing the CA](#publishing-the-ca-after-launch).

---

## Host it on a VPS (Ubuntu/Debian)

### 1. Node 24 (runtime only — no build happens on the server)
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs nginx
node -v      # v24.x
```

### 2. Copy the app to the server
From your machine (where this folder lives):
```bash
rsync -az BlurVault/app/  user@YOUR_SERVER:/var/www/blurvault.pro/
```
Then on the server, let the service user own it:
```bash
sudo chown -R www-data:www-data /var/www/blurvault.pro
```
Two things that will otherwise bite you:
- **The chown is not optional, and it is needed after *every* rsync.** `rsync -az`
  carries your local uid/gid over, so the tree lands owned by a uid that does not
  exist on the server and `www-data` cannot write `.next/cache`.
- **`WorkingDirectory` in `blurvault.service` must be this exact path.** If it
  points anywhere else systemd dies with `status=200/CHDIR` before Node runs.

### 3. Admin password + data directory
`/admin` is where you paste the `$BLUR` contract address on launch day. It is
**switched off until `ADMIN_PASSWORD` is set**, which is the safe default.

```bash
# a directory for the published address, outside the deploy so redeploys
# cannot wipe it
sudo mkdir -p /var/lib/blurvault
sudo chown www-data:www-data /var/lib/blurvault

# generate a real password and store it root-only
printf 'ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 24)" | sudo tee /etc/blurvault.env
sudo chmod 600 /etc/blurvault.env
```
The `tee` prints the password once — **copy it into your password manager now.**

> Whoever holds this password can make blurvault.pro display any contract
> address as the official `$BLUR` CA. That is the whole risk here — not someone
> reading the address, which is public anyway, but someone publishing a scam one
> under your domain. Do not pick the password by hand.

### 4. Run it as a service
```bash
sudo cp /var/www/blurvault/../blurvault.service /etc/systemd/system/ 2>/dev/null || \
  sudo tee /etc/systemd/system/blurvault.service < deploy/blurvault.service
# (or just paste deploy/blurvault.service into /etc/systemd/system/blurvault.service)
sudo systemctl daemon-reload
sudo systemctl enable --now blurvault
sudo systemctl status blurvault        # active (running)
curl -I http://127.0.0.1:5013          # 200 OK
```
The app now listens on `127.0.0.1:5013`. If the host already runs other sites,
confirm the port is free *before* starting, or the service will restart-loop on
`EADDRINUSE`:
```bash
ss -ltn | grep 5013                    # no output = free
```
`PORT` in `blurvault.service` and `proxy_pass` in `blurvault.nginx` must agree.

### 5. nginx + domain
Put `deploy/blurvault.nginx` at `/etc/nginx/sites-available/blurvault`, then:
```bash
sudo ln -sf /etc/nginx/sites-available/blurvault /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```
Point DNS A records `@` and `www` at the server IP.

### 6. HTTPS (free, auto-renews)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d blurvault.pro -d www.blurvault.pro
```

### 7. Firewall
```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Done — `https://blurvault.pro` is live. Footprint on the server: **~37 MB + Node**.
No `node_modules`, no build step, so a 1 GB VPS is plenty and there is no
build-time OOM to worry about.

---

## Publishing the CA after launch

Before launch the header strip says the token is not live and warns that any
address claiming to be `$BLUR` is fake. To publish the real one:

1. Go to **`https://blurvault.pro/admin`** (not linked from anywhere, not indexed).
2. Sign in with `ADMIN_PASSWORD`.
3. Paste the contract address and press **PUBLISH**.

It appears in the header on every page from the next load. **No rebuild, no
redeploy, no restart.** Publishing an empty field clears it and puts the warning
back — useful if you paste the wrong thing.

The address is checksum-validated before it is saved, so a typo is rejected
rather than published. It is stored in `/var/lib/blurvault/site-config.json`,
which survives redeploys and restarts.

Wrong-password attempts are throttled to 8 per 15 minutes per IP. If you lock
yourself out, `sudo systemctl restart blurvault` clears the counter.

## Managing it
```bash
sudo systemctl restart blurvault     # restart
sudo systemctl stop blurvault        # stop
journalctl -u blurvault -f           # live logs

# rotate the admin password (also signs out any open session)
printf 'ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 24)" | sudo tee /etc/blurvault.env
sudo chmod 600 /etc/blurvault.env && sudo systemctl restart blurvault
```

## Rebuilding (only if you change code or a vault address)
The bundle is a snapshot. To change a **vault** address, the site URL, or any
code, rebuild from the main repo and re-assemble this folder. (The `$BLUR` CA is
*not* on this list — that one is published from `/admin` at runtime.)
```bash
# in the meganode repo root:
#   edit .env.local (addresses / NEXT_PUBLIC_SITE_URL)
npm ci
npm run build
rm -rf BlurVault/app && mkdir -p BlurVault/app
cp -r .next/standalone/.        BlurVault/app/
mkdir -p BlurVault/app/.next
cp -r .next/static              BlurVault/app/.next/static
cp -r public                    BlurVault/app/public
```
Then rsync `BlurVault/app/` to the server again, **re-chown**, and restart:
```bash
rsync -az BlurVault/app/ user@YOUR_SERVER:/var/www/blurvault.pro/
sudo chown -R www-data:www-data /var/www/blurvault.pro
sudo systemctl restart blurvault
```

## Not included on purpose
- `contracts/` and `keeper/` — not needed to host the site. The vaults are
  already deployed; deposits self-allocate (user-paid), so no keeper is required
  to run. If you later want automated drift-rebalancing, run the keeper from the
  main repo, never on this web server.
