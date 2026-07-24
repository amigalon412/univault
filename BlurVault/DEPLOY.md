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

The contract addresses and the `https://blurvault.pro` site URL are **already
compiled into `app/`**. There are no environment variables to set on the server.

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
rsync -az BlurVault/app/  user@YOUR_SERVER:/var/www/blurvault/
```
Then on the server, let the service user own it:
```bash
sudo chown -R www-data:www-data /var/www/blurvault
```

### 3. Run it as a service
```bash
sudo cp /var/www/blurvault/../blurvault.service /etc/systemd/system/ 2>/dev/null || \
  sudo tee /etc/systemd/system/blurvault.service < deploy/blurvault.service
# (or just paste deploy/blurvault.service into /etc/systemd/system/blurvault.service)
sudo systemctl daemon-reload
sudo systemctl enable --now blurvault
sudo systemctl status blurvault        # active (running)
curl -I http://127.0.0.1:3000          # 200 OK
```
The app now listens on `127.0.0.1:3000`.

### 4. nginx + domain
Put `deploy/blurvault.nginx` at `/etc/nginx/sites-available/blurvault`, then:
```bash
sudo ln -sf /etc/nginx/sites-available/blurvault /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```
Point DNS A records `@` and `www` at the server IP.

### 5. HTTPS (free, auto-renews)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d blurvault.pro -d www.blurvault.pro
```

### 6. Firewall
```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Done — `https://blurvault.pro` is live. Footprint on the server: **~37 MB + Node**.
No `node_modules`, no build step, so a 1 GB VPS is plenty and there is no
build-time OOM to worry about.

---

## Managing it
```bash
sudo systemctl restart blurvault     # restart
sudo systemctl stop blurvault        # stop
journalctl -u blurvault -f           # live logs
```

## Rebuilding (only if you change code or an address)
The bundle is a snapshot. To change a contract address, the site URL, or any
code, rebuild from the main repo and re-assemble this folder:
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
Then rsync `BlurVault/app/` to the server again and `systemctl restart blurvault`.

## Not included on purpose
- `contracts/` and `keeper/` — not needed to host the site. The vaults are
  already deployed; deposits self-allocate (user-paid), so no keeper is required
  to run. If you later want automated drift-rebalancing, run the keeper from the
  main repo, never on this web server.
