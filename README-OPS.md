# Dolli Ops Runbook (Production)

## 1) Server Access

```bash
ssh -p 2222 -i ~/.ssh/id_ed25519 root@109.235.119.191
```

## 2) Health Checks

Systemd unit names on the VPS are typically **`dolli-backend-prod`** and **`dolli-backend-staging`** (not a generic `dolli-backend`).

```bash
systemctl status dolli-backend-prod --no-pager -l
systemctl status nginx --no-pager -l
systemctl status fail2ban --no-pager -l
curl -i https://api.dolli.space/health
curl -I https://dolli.space
```

## 3) Service Restart

```bash
systemctl restart dolli-backend-prod
# staging: systemctl restart dolli-backend-staging
systemctl reload nginx
systemctl restart fail2ban
```

## 4) Logs for Debug

```bash
journalctl -u dolli-backend-prod -n 100 --no-pager
journalctl -u nginx -n 100 --no-pager
tail -n 100 /var/log/nginx/error.log
journalctl -u fail2ban -n 100 --no-pager
```

## 5) Deploy Updated Code

From the repo, **`./scripts/deploy.sh prod`** or **`staging`** rsyncs the tree, runs **`scripts/dolli_alembic_preflight.py`** (SQLite: empty file, or legacy DB without `alembic_version`, aborts with instructions), then **`alembic upgrade head`**, builds the SPA, and restarts the backend.

Run from local Mac (manual equivalent):

```bash
rsync -az --delete \
  --exclude ".git" --exclude ".venv" --exclude "venv" --exclude "node_modules" --exclude "dist" \
  -e "ssh -p 2222" \
  "/Users/amirsalim/Documents/DolliApp/" \
  root@109.235.119.191:/opt/dolli/app/
```

Then on server:

```bash
cd /opt/dolli/app/app/backend
set -a && source /etc/dolli/staging.env && set +a   # or prod.env — must export DATABASE_URL
/opt/dolli/venv/bin/python -m alembic upgrade head
cd /opt/dolli/app/app/frontend
npm install
npm run build
systemctl restart dolli-backend-prod
systemctl reload nginx
```

## 6) Database Backups

- **Script in repo:** `deploy/ops/dolli-backup.sh` — install on the VPS as `/usr/local/bin/dolli-backup.sh` (overwrite the old script that only copied `local.db`).
- **What gets backed up:** `/var/lib/dolli/prod.db`, `/var/lib/dolli/staging.db`, and optionally `app/backend/local.db` (legacy).
- **Backup directory:** `/opt/dolli/backups` — files named `prod_*.db.gz`, `staging_*.db.gz`, etc.
- **Log:** `/var/log/dolli-backup.log`
- **Retention:** newest **14** gzip files per family (`prod_`, `staging_`, …).

Install / refresh after editing:

```bash
scp -P 2222 -i ~/.ssh/id_ed25519 deploy/ops/dolli-backup.sh \
  root@109.235.119.191:/usr/local/bin/dolli-backup.sh
ssh -p 2222 -i ~/.ssh/id_ed25519 root@109.235.119.191 'chmod +x /usr/local/bin/dolli-backup.sh'
```

Cron (example — adjust time if you like):

```cron
10 3 * * * root /usr/local/bin/dolli-backup.sh >> /var/log/dolli-backup.log 2>&1
```

Verify:

```bash
ls -lah /opt/dolli/backups
cat /etc/cron.d/dolli-backup
tail -n 50 /var/log/dolli-backup.log
/usr/local/bin/dolli-backup.sh   # manual run
```

Restore (outline — adjust paths and `DATABASE_URL` in the matching `.env`):

1. Stop the backend that uses the DB: `systemctl stop dolli-backend-prod` (or `dolli-backend-staging`).
2. Copy the chosen backup file over the live SQLite path from `DATABASE_URL` (or restore to a new path and update `DATABASE_URL`, then restart).
3. Ensure the service user can read/write the file (`chown` if needed).
4. `systemctl start dolli-backend-prod` and `curl -i https://api.dolli.space/health`.

Test restores on **staging** periodically so the procedure stays familiar.

## 7) SSH Security Check

```bash
ss -ltnp | grep :2222
ssh -p 2222 -i ~/.ssh/id_ed25519 root@109.235.119.191 'echo OK_KEY_LOGIN'
```

## 8) Fail2Ban Check

```bash
fail2ban-client status
fail2ban-client status sshd
```

## 9) Nginx Config Paths

- Production config: `/etc/nginx/sites-available/dolli-prod.conf`
- Staging config: `/etc/nginx/sites-available/dolli-staging.conf`
- **Active on VPS:** `/etc/nginx/sites-enabled/dolli-multi.conf` → `sites-available/dolli-multi.conf` (prod + staging + both API hosts).

### Staging SPA → API (same origin)

The staging frontend calls **`https://staging.dolli.space/api/...`** (not `api-staging` in the browser). The `server_name staging.dolli.space` block must include `location /api/` (and optional `location = /health`) proxying to **`127.0.0.1:8001`**. Reference fragment: `deploy/nginx/dolli-multi-staging-api-proxy.fragment.conf`.

- Active symlinks: `/etc/nginx/sites-enabled/`

After any config change:

```bash
nginx -t && systemctl reload nginx
```

## 10) Emergency Recovery (Minimum)

```bash
systemctl restart dolli-backend-prod
systemctl restart nginx
curl -i https://api.dolli.space/health
curl -I https://dolli.space
```

## 11) Important Runtime Paths

- Backend service file: `/etc/systemd/system/dolli-backend.service`
- Backend app directory: `/opt/dolli/app/app/backend`
- Frontend build directory: `/opt/dolli/app/app/frontend/dist`
- Staging env: `/etc/dolli/staging.env` (used by `dolli-backend-staging.service`)

### Staging: create campaigns without donating first (QA only)

To test **Create campaign** from the UI without a prior paid donation, set in `/etc/dolli/staging.env`:

`ALLOW_CAMPAIGN_CREATE_WITHOUT_DONATION=true`

Then `systemctl restart dolli-backend-staging`. **Do not** enable this on production — there the give-first rule stays.

### Staging: cover image upload (Create Campaign → upload button)

The **upload** control calls `POST /api/v1/entities/campaigns/presign-cover`, then the browser **PUTs** the file to `upload_url` and stores `access_url` on the campaign.

**Option A — local disk (no external OSS API, typical for staging)**

On the server:

```bash
mkdir -p /var/lib/dolli/cover-media
```

Nginx must allow large **PUT** bodies for short videos (e.g. `client_max_body_size 128m;` on the API `server` / `location` that proxies to Uvicorn). Reload nginx after editing.

In `/etc/dolli/staging.env` (then `systemctl restart dolli-backend-staging`):

- `DOLLI_COVER_STORAGE=local`
- `DOLLI_COVER_UPLOAD_BUCKET=dolli-staging-covers` (logical label; object keys still use `campaign-covers/…`)
- `DOLLI_COVER_LOCAL_ROOT=/var/lib/dolli/cover-media`
- `DOLLI_COVER_PUBLIC_BASE_URL=https://api-staging.dolli.space` (must match the public API origin used in the browser for image URLs; can reuse `BACKEND_PUBLIC_URL` if already set and correct)
- `JWT_SECRET_KEY` must be set (used to sign short-lived upload tokens; override with `DOLLI_COVER_LOCAL_SIGNING_SECRET` if you prefer).

**Option B — remote OSS (prod-style)**

- `OSS_SERVICE_URL` and `OSS_API_KEY` — backend calls your OSS HTTP API (`StorageService`).
- `DOLLI_COVER_UPLOAD_BUCKET` — bucket name.
- `DOLLI_COVER_PUBLIC_BASE_URL` — if the presign JSON does not return a full public URL.

If neither mode is configured, the API returns **503** (*Cover upload is not configured…*) — paste a direct `https://…` image URL instead.

**Google Drive:** a normal “anyone with the link” URL is an HTML page, not a raw image. For **cover images**, the app rewrites common `/file/d/…/view` and `/open?id=…` links to `uc?export=view&id=…` on blur / save. For **campaign video**, paste the full share link (or `open?id=…`); the SPA embeds Drive preview and **must not** use the `export=view` image shortcut.

### Staging: campaign AI (Create Campaign → Generate draft)

The UI calls `GET /api/v1/campaigns/ai-status`. If `hub_configured` is false, the orange banner appears. Configure **one** of the following in `/etc/dolli/staging.env`, then `systemctl restart dolli-backend-staging`:

- **Dolli names:** `APP_AI_BASE_URL` (OpenAI-compatible API root, e.g. `https://api.openai.com/v1`) and `APP_AI_KEY`.
- **Common alias:** `OPENAI_API_KEY` only — base URL defaults to `https://api.openai.com/v1`. For DeepSeek or another host, set `OPENAI_BASE_URL` (or `APP_AI_BASE_URL`) to that provider’s base URL.

Optional: `ENABLE_CAMPAIGN_AI=false` turns the feature off explicitly.

Optional: `CAMPAIGN_AI_MODEL` (default `gpt-4o-mini`) — must match a model id your provider exposes; the SPA reads the effective value from `GET /api/v1/campaigns/ai-status`.

#### Free OpenAI-compatible provider for staging (Groq — recommended to unblock QA)

Use this when the OpenAI account has **no quota** (`insufficient_quota`) but you need to confirm Create Campaign → **Generate full draft** works end-to-end.

1. **Create a Groq API key** (free tier, subject to Groq’s current limits): [Groq Console](https://console.groq.com/) → **API Keys** → create key (starts with `gsk_`).
2. **On the staging server**, edit `/etc/dolli/staging.env`. The backend resolves **`APP_AI_*` before `OPENAI_*`** for both URL and key — if `APP_AI_BASE_URL` / `APP_AI_KEY` are still set for OpenAI, **remove them or repoint them to Groq** so a mix of OpenAI key + Groq URL cannot happen. Then set:
   - `OPENAI_BASE_URL=https://api.groq.com/openai/v1`
   - `OPENAI_API_KEY=<your gsk_... key>`
   - `CAMPAIGN_AI_MODEL=llama-3.1-8b-instant`  
     (Other ids: see [Groq models](https://console.groq.com/docs/models) — the id must exist on Groq, not `gpt-4o-mini` unless Groq lists it.)
3. **Restart backend:** `systemctl restart dolli-backend-staging`  
   Or from your Mac (after `app/backend/.env` is saved with the same three variables): `python3 scripts/sync_campaign_ai_env_to_staging.py` — writes `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `CAMPAIGN_AI_MODEL` to staging and restarts the service (removes conflicting `APP_AI_*` lines on the server).
4. **Verify:**
   - `curl -sS https://api-staging.dolli.space/api/v1/campaigns/ai-status` → `hub_configured` should be `true` and `default_model` should match `CAMPAIGN_AI_MODEL`.
   - In the browser on staging: Create Campaign → describe cause → **Generate full draft** — should return a draft or a clear JSON/validation error from the model, not quota errors.

**Local dev:** same three variables in `app/backend/.env` (never commit real keys).

When OpenAI billing is fixed, switch back: `OPENAI_BASE_URL=https://api.openai.com/v1`, your `sk-...` key, and `CAMPAIGN_AI_MODEL=gpt-4o-mini` (or your chosen OpenAI model id).

#### Staging fallback: Ollama on the same VPS (no external LLM bill)

If you need campaign AI without Groq/OpenAI quota, the staging box can run **Ollama** on `127.0.0.1:11434` (CPU-only is fine for smoke tests). After `ollama pull tinyllama` (or another chat model), set in `/etc/dolli/staging.env`:

- `OPENAI_BASE_URL=http://127.0.0.1:11434/v1`
- `OPENAI_API_KEY=ollama` (placeholder; Ollama ignores it)
- `CAMPAIGN_AI_MODEL=tinyllama` (must match `ollama list`)

Then `systemctl restart dolli-backend-staging`. Smaller models may occasionally miss strict JSON for `/ai-draft`; use a larger tag on a bigger VM if that happens.

### Staging SQLite (avoid `readonly database` after rsync)

Do **not** keep the staging SQLite file **inside** `/opt/dolli/app/...` if you deploy with `rsync --delete`: the tree is owned by your Mac uid and the DB path can become unwritable or disappear.

Use a path outside the synced tree, for example:

```bash
mkdir -p /var/lib/dolli
# In /etc/dolli/staging.env:
DATABASE_URL=sqlite+aiosqlite:////var/lib/dolli/staging.db
systemctl restart dolli-backend-staging
```

Schema changes (new columns): prefer `alembic upgrade head` with `DATABASE_URL` exported to match that file. If Alembic cannot parse the URL, apply `ALTER TABLE` on the SQLite file with a short Python/sqlite3 script.

### Production SQLite (same rule as staging)

Keep production data **outside** the rsync’d tree:

- **`/var/lib/dolli/prod.db`** with `DATABASE_URL=sqlite+aiosqlite:////var/lib/dolli/prod.db` in `/etc/dolli/prod.env`.

Do **not** point production at an empty or app-tree file such as `.../local_prod.db` inside `/opt/dolli/app/...` — deploy + Alembic surprises become much harder.

`systemd` `EnvironmentFile=` lines must be `KEY=value` only (no shell `export`, no stray bare words). If you ever `source` the file in bash for debugging, the same rules apply.

## 12) Observability / external alerting (recommended)

The app does not ship a hosted metrics stack; use lightweight **synthetic checks** from outside the VPS:

- **Production API:** `GET https://api.dolli.space/health` — expect HTTP **200** and JSON `{"status":"healthy"}` (or your deployed equivalent).
- **Staging API (if used):** same for `https://api-staging.dolli.space/health` or `https://staging.dolli.space/health` depending on how nginx exposes it.
- **Site availability:** `HEAD https://dolli.space` (and staging origin) on the same interval.

Providers (pick one): [UptimeRobot](https://uptimerobot.com/), [Better Stack](https://betterstack.com/), [Healthchecks.io](https://healthchecks.io/), Grafana Cloud synthetic checks, etc. Configure email or Slack when a check fails **twice in a row** to avoid flapping.

**On-box follow-ups:** watch **disk** (`df -h`) and **TLS expiry** (`certbot certificates` if Let’s Encrypt). For deeper debugging, `journalctl -u dolli-backend-prod -n 200 --no-pager` (replace with `dolli-backend-staging` on staging).

### 12.1) UptimeRobot (concrete example)

1. Add monitor → **HTTP(s)** → URL `https://api.dolli.space/health` → name e.g. `Dolli prod API /health`.
2. Optional stronger check: create a second monitor with **Keyword** monitoring on the same URL and require keyword **`healthy`** (response must contain that substring). Interval **5 min**, alert after **2** failed checks.
3. Add **HTTP(s)** → `https://dolli.space` (or HEAD if the product supports it) for the SPA host.
4. Optional **database** path: `GET https://api.dolli.space/database/health` — expect JSON with `"status":"healthy"` and `"service":"database"` (fails if SQLite is unreadable or migrations broke).

Repeat for staging origins if you want parity.

## 13) Frontend dependency audit (local)

From the repo root:

```bash
cd app/frontend && npm audit && npm run build
```

`package.json` uses **`overrides`** so nested copies of **axios** and **serialize-javascript** stay on patched releases used by the SPA build.

**Residual `npm audit` (moderate):** Vite 5 pins **esbuild** `0.21.x`. Advisory [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) applies to the **Vite dev server** (`npm run dev`), not to the static files produced by `npm run build` served by nginx. Mitigation: do not expose `npm run dev` to untrusted networks; use localhost or SSH port-forward. A full fix implies **Vite 6+** (or dropping `@metagptx/vite-plugin-source-locator` / upgrading that plugin when it supports a newer Vite).
