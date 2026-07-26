# BlurVault — деплой под root

Вариант `DEPLOY.md` без отдельного пользователя: сервис работает от root, никаких
`chown`, ничего не создаётся кроме двух директорий. Всё остальное — то же самое.

Если ты уже разворачивал по `DEPLOY.md` — читай только шаги 2 и 4, остальное
идентично.

> **Про www-data.** В основном гайде доп юзер не создаётся: `www-data` уже есть
> на любой Ubuntu/Debian, его заводит пакет nginx при установке. Единственное,
> что там делается — `chown` на директорию. Так что «без создания юзера» ты
> получаешь и там. Но раз надо под root — ниже под root.

---

## Что лежит в архиве

```
BlurVault/
├── app/                     ← весь сайт (~37 МБ, node_modules не нужен)
│   ├── server.js            ← точка входа: node server.js
│   └── .next/ , public/
├── deploy/
│   ├── blurvault.nginx      ← конфиг nginx (используем как есть)
│   ├── blurvault.service    ← юнит под www-data (в этом гайде НЕ используем)
│   └── baked-config.txt     ← что вкомпилено в сборку (просто справка)
├── DEPLOY.md                ← вариант под www-data
└── DEPLOY-ROOT.md           ← этот файл
```

Адреса контрактов и `https://blurvault.pro` **уже вкомпилены в `app/`**.
Собирать на сервере ничего не нужно, переменные окружения для адресов задавать
не нужно. На сервере задаётся ровно одна вещь — пароль от `/admin`.

---

## 1. Node 24 и nginx

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs nginx
node -v      # v24.x
```

## 2. Залить приложение

Со своей машины, из папки где лежит распакованный `BlurVault/`:

```bash
rsync -az BlurVault/app/ root@ТВОЙ_СЕРВЕР:/var/www/blurvault.pro/
```

Слеш в конце `app/` обязателен — без него rsync положит папку внутрь папки.

Всё. `chown` не нужен: файлы и так принадлежат root, и сервис работает от root.

## 3. Пароль админки и директория данных

`/admin` — это страница, где после запуска токена вставляется контрактный адрес
`$BLUR`. Пока `ADMIN_PASSWORD` не задан, страница **выключена**, это дефолт.

```bash
# директория для опубликованного адреса — вне деплоя, чтобы rsync её не затирал
mkdir -p /var/lib/blurvault

# сгенерировать пароль и положить в root-only файл
printf 'ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 24)" > /etc/blurvault.env
chmod 600 /etc/blurvault.env
cat /etc/blurvault.env
```

Пароль показывается один раз — **сразу скопируй его в менеджер паролей.**

> Кто держит этот пароль, тот может показать на blurvault.pro любой адрес как
> «официальный CA $BLUR». Риск не в том, что кто-то прочитает адрес — он и так
> публичный, — а в том, что кто-то опубликует скам-адрес под доменом. Пароль
> руками не придумывать.

## 4. Юнит systemd (под root)

Отличие от `deploy/blurvault.service` — убрана строка `User=www-data`. Без неё
systemd запускает процесс от root. Копировать файл из архива не надо, создай
юнит прямо командой:

```bash
cat > /etc/systemd/system/blurvault.service <<'EOF'
[Unit]
Description=BlurVault website (Next.js standalone)
After=network.target

[Service]
Type=simple
# Ровно та директория, куда залит app/. Иначе systemd падает ещё до Node:
# status=200/CHDIR
WorkingDirectory=/var/www/blurvault.pro
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production
# Должно совпадать с proxy_pass в blurvault.nginx
Environment=PORT=5013
Environment=HOSTNAME=127.0.0.1

# Где /admin хранит опубликованный адрес $BLUR. Специально ВНЕ WorkingDirectory:
# новый rsync не должен его стирать.
Environment=BLUR_DATA_DIR=/var/lib/blurvault

# ADMIN_PASSWORD лежит в root-only файле, а не в юните: юнит читается всеми.
# Минус перед путём = файла может не быть, сервис всё равно стартует.
EnvironmentFile=-/etc/blurvault.env

# Процесс идёт от root, поэтому ограничиваем что можем без смены пользователя.
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now blurvault
systemctl status blurvault        # active (running)
curl -I http://127.0.0.1:5013     # 200 OK
```

Порт 5013 занят? Проверить **до** старта, иначе сервис уйдёт в рестарт-луп по
`EADDRINUSE`:

```bash
ss -ltn | grep 5013               # пусто = свободен
```

Если порт занят — поменяй `Environment=PORT=` в юните и `proxy_pass` в конфиге
nginx на одно и то же число.

### Про «под root» честно

Node здесь смотрит в интернет только через nginx, но если в приложении найдут
дыру с исполнением кода — это будет root, а не www-data. Четыре директивы выше
(`NoNewPrivileges`, `ProtectSystem=full`, `ProtectHome`, `PrivateTmp`) закрывают
часть последствий: `/usr`, `/boot`, `/etc` только на чтение, `/home` не видно,
свой `/tmp`, повышение привилегий запрещено.

Если захочешь убрать root вообще, не заводя юзера руками — добавь в `[Service]`:

```
DynamicUser=true
StateDirectory=blurvault
```

systemd сам сделает временного пользователя на время работы сервиса, в
`/etc/passwd` ничего не появится. Тогда `BLUR_DATA_DIR` меняется на
`/var/lib/private/blurvault`, а `/var/www/blurvault.pro` придётся отдать этому
пользователю через `ReadWritePaths=`. Делать необязательно, сайт работает и так.

## 5. nginx и домен

```bash
cp deploy/blurvault.nginx /etc/nginx/sites-available/blurvault
ln -sf /etc/nginx/sites-available/blurvault /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

A-записи `@` и `www` направить на IP сервера.

## 6. HTTPS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d blurvault.pro -d www.blurvault.pro
```

certbot сам допишет 443-блок и редирект с http.

## 7. Файрвол

```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

Готово — `https://blurvault.pro` живой. На сервере занято **~37 МБ + Node**.
Ни `node_modules`, ни сборки, так что 1 ГБ VPS хватает с запасом и OOM при
билде не будет — билда нет вообще.

---

## Публикация CA после запуска токена

До запуска шапка сайта пишет, что токен ещё не живой и любой адрес, выдающий
себя за `$BLUR`, — фейк. Чтобы опубликовать настоящий:

1. Зайти на **`https://blurvault.pro/admin`** (ниоткуда не залинковано, не
   индексируется).
2. Войти по `ADMIN_PASSWORD`.
3. Вставить адрес контракта и нажать **PUBLISH**.

Появится в шапке на всех страницах со следующей загрузки. **Без пересборки, без
редеплоя, без рестарта.** Пустое поле → адрес стирается и предупреждение
возвращается, если вставил не то.

Адрес проверяется по контрольной сумме перед сохранением, так что опечатка будет
отклонена, а не опубликована. Лежит в `/var/lib/blurvault/site-config.json` —
переживает редеплой и рестарт.

Неверный пароль — 8 попыток за 15 минут с одного IP. Если сам себя заблокировал,
`systemctl restart blurvault` сбрасывает счётчик.

## Управление

```bash
systemctl restart blurvault     # рестарт
systemctl stop blurvault        # стоп
journalctl -u blurvault -f      # живые логи

# сменить пароль админки (заодно разлогинивает открытые сессии)
printf 'ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 24)" > /etc/blurvault.env
chmod 600 /etc/blurvault.env && systemctl restart blurvault
```

## Обновление сборки

Прилетел новый архив — заменить `app/` и рестартнуть:

```bash
rsync -az BlurVault/app/ root@ТВОЙ_СЕРВЕР:/var/www/blurvault.pro/
ssh root@ТВОЙ_СЕРВЕР 'systemctl restart blurvault'
```

`/var/lib/blurvault` и `/etc/blurvault.env` лежат вне деплоя, так что
опубликованный CA и пароль не теряются.

Если файлы удалялись между версиями, а не только менялись — добавь `--delete`:

```bash
rsync -az --delete BlurVault/app/ root@ТВОЙ_СЕРВЕР:/var/www/blurvault.pro/
```

## Чего в архиве нет и почему

`contracts/` и `keeper/` для хостинга сайта не нужны. Волты уже задеплоены,
депозиты раскладываются сами в момент депозита и газ платит пользователь, так
что никакой демон для работы сайта не требуется. Если позже понадобится
автоматическая ребалансировка — кипер запускается из основного репозитория и
**никогда** на этом веб-сервере.
