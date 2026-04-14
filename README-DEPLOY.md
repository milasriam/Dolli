# Dolli Deployment Guide

## Environments

- Production:
  - Frontend: https://dolli.space
  - API: https://api.dolli.space
  - Backend service: `dolli-backend-prod`
  - Local backend port: `127.0.0.1:8000`

- Staging:
  - Frontend: https://staging.dolli.space
  - API: https://api-staging.dolli.space
  - Backend service: `dolli-backend-staging`
  - Local backend port: `127.0.0.1:8001`

## Deploy Commands

From project root:

```bash
./scripts/deploy.sh staging
./scripts/deploy.sh prod
```

## What deploy.sh does

1. Syncs source code to server (`/opt/dolli/app`) via rsync (does **not** ship local `app/backend/.env` / `app/frontend/.env` — avoids overwriting server secrets).
2. Sources `/etc/dolli/staging.env` or `/etc/dolli/prod.env` (when present) so `DATABASE_URL` is available.
3. Installs backend requirements into `/opt/dolli/venv` and runs Alembic from `app/backend`. If the database has **no** `alembic_version` row yet (legacy SQLite), the script **stamps** revision `e7b2a1c0d3e4` once, then runs **`upgrade head`** (so only newer migrations such as `client_product_events` apply).
4. Builds the frontend with the correct `VITE_API_BASE_URL` for the selected environment.
5. Publishes the built frontend to `/opt/dolli/www/staging` or `/opt/dolli/www/prod`.
6. Restarts the corresponding backend service (`dolli-backend-staging` or `dolli-backend-prod`).
7. Copies `deploy/nginx/dolli-multi.conf` to `/etc/nginx/sites-available/dolli-multi.conf` and **`nginx -t` + `reload`** so **same-origin `/api/`** on `dolli.space` / `www` / `staging` matches the repo (SPA calls `https://dolli.space/api/...` → must proxy to the backend).
8. Runs health checks for the API and site.
9. Runs `scripts/seed_demo_campaigns.py` once per deploy (idempotent) on staging and production.

## Quick Post-Deploy Checks

- Staging:
  - https://staging.dolli.space
  - https://api-staging.dolli.space/health
  - Forgot-password on staging needs **SMTP** in `/etc/dolli/staging.env` (same keys as prod). If staging had no `SMTP_HOST`, copy the `SMTP_*` / `SMTP_FALLBACK_*` lines from `prod.env` and restart `dolli-backend-staging`. The backend treats staging as such when `DATABASE_URL` contains `staging.db` (or set `DOLLI_STAGING=1`).

- Production:
  - https://dolli.space
  - https://api.dolli.space/health

Expected API response:
{"status":"healthy"}

## Sync OpenAI key to staging (local `.env` only)

After you change `OPENAI_API_KEY` in `app/backend/.env` (never commit that file), push the key to the server and restart staging:

```bash
python3 scripts/sync_openai_key_to_staging.py
```

Uses the same SSH defaults as deploy (port 2222, `~/.ssh/id_ed25519`). Override with `DOLLI_STAGING_SSH`, `DOLLI_STAGING_SSH_PORT`, `DOLLI_STAGING_SSH_KEY` if needed. Requires `python-dotenv` in the environment you use to run the script.

## Rollback (quick)

1. Checkout previous stable commit locally.
2. Re-run deploy for target env:
   - ./scripts/deploy.sh staging
   - ./scripts/deploy.sh prod

## Docker Compose (local)

From the repo root:

```bash
docker compose build
docker compose up
```

Open **http://localhost:8080** (override: `WEB_PORT=9090 docker compose up`). The `web` service serves the built SPA and proxies **`/api/`** to the `api` service (same-origin as in production nginx).

- **Env:** `docker/default.env` is loaded for `api` (JWT, `ALLOW_LOCAL_AUTH`, etc.). For secrets or OIDC, copy `docker/env.docker.example` to `docker/.env.docker` (gitignored), merge variables there, and add a second `env_file` entry in `docker-compose.yml` if needed.
- **DB:** SQLite in the `dolli-sqlite` volume (`/data/dolli.db`). Alembic runs on container start.
- **Frontend API URL:** `localhost` with a port other than Vite’s (5173, etc.) uses the **same origin** automatically (`config.ts`), so no `VITE_API_BASE_URL` is required for the default `8080` mapping.

## Notes

- SSH access uses key auth on port 2222.
- Server has fail2ban enabled for SSH.
- Backups are configured on server for local DB.
