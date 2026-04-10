# Dolli Ops Runbook (Production)

## 1) Server Access

```bash
ssh -p 2222 -i ~/.ssh/id_ed25519 root@109.235.119.191
```

## 2) Health Checks

```bash
systemctl status dolli-backend --no-pager -l
systemctl status nginx --no-pager -l
systemctl status fail2ban --no-pager -l
curl -i https://api.dolli.space/health
curl -I https://dolli.space
```

## 3) Service Restart

```bash
systemctl restart dolli-backend
systemctl reload nginx
systemctl restart fail2ban
```

## 4) Logs for Debug

```bash
journalctl -u dolli-backend -n 100 --no-pager
journalctl -u nginx -n 100 --no-pager
tail -n 100 /var/log/nginx/error.log
journalctl -u fail2ban -n 100 --no-pager
```

## 5) Deploy Updated Code

Run from local Mac:

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
systemctl restart dolli-backend
systemctl reload nginx
```

## 6) Database Backups

- Backup script: `/usr/local/bin/dolli-backup.sh`
- Backup directory: `/opt/dolli/backups`
- Cron schedule: daily at `03:10 UTC` (`08:10 Asia/Almaty`)

Verify:

```bash
ls -lah /opt/dolli/backups
cat /etc/cron.d/dolli-backup
tail -n 50 /var/log/dolli-backup.log
```

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
systemctl restart dolli-backend
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

The **upload** control calls `POST /api/v1/entities/campaigns/presign-cover`, which requires **object storage** in env (same pattern as prod):

- `OSS_SERVICE_URL` and `OSS_API_KEY` — backend talks to your OSS API (`StorageService`).
- `DOLLI_COVER_UPLOAD_BUCKET` — bucket name for campaign cover objects.
- `DOLLI_COVER_PUBLIC_BASE_URL` (optional but typical) — public HTTPS base for `access_url` if the presign response does not include a full URL.

Until these are set, the API returns **503** with *“Cover upload is not configured…”* — users should **paste a direct `https://…` image URL** instead.

**Google Drive:** a normal “anyone with the link” URL opens a **web page**, not raw bytes. Use a direct form such as `https://drive.google.com/uc?export=view&id=FILE_ID`, or host the image on a CDN. The app now rewrites common Drive `/file/d/…/view` and `/open?id=…` links to the `uc?export=view` form on save and when the cover field blurs in the UI.

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
