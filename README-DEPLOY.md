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

cd "/Users/amirsalim/Documents/DolliApp"

cat > README-DEPLOY.md <<'EOF'
# Dolli Deployment Guide

## Environments

- Production:
  - Frontend: https://dolli.space
  - API: https://api.dolli.space
  - Backend service: dolli-backend-prod
  - Local backend port: 127.0.0.1:8000

- Staging:
  - Frontend: https://staging.dolli.space
  - API: https://api-staging.dolli.space
  - Backend service: dolli-backend-staging
  - Local backend port: 127.0.0.1:8001

## Deploy Commands

From project root:
- ./scripts/deploy.sh staging
- ./scripts/deploy.sh prod

## What deploy.sh does

1. Syncs source code to server (`/opt/dolli/app`) via rsync.
2. Sources `/etc/dolli/staging.env` or `/etc/dolli/prod.env` (when present) so `DATABASE_URL` is available.
3. Installs backend requirements into `/opt/dolli/venv` and runs Alembic from `app/backend`. If the database has **no** `alembic_version` row yet (legacy SQLite), the script **stamps** revision `e7b2a1c0d3e4` once, then runs **`upgrade head`** (so only newer migrations such as `client_product_events` apply).
4. Builds the frontend with the correct `VITE_API_BASE_URL` for the selected environment.
5. Publishes the built frontend to `/opt/dolli/www/staging` or `/opt/dolli/www/prod`.
6. Restarts the corresponding backend service (`dolli-backend-staging` or `dolli-backend-prod`).
7. Runs health checks for the API and site.
8. **Staging only:** runs `scripts/seed_demo_campaigns.py` once per deploy (idempotent). That script is the **only** bundled “many scenarios” dataset: it is not loaded at API startup, not tied to automated tests, and not run on production.

## Quick Post-Deploy Checks

- Staging:
  - https://staging.dolli.space
  - https://api-staging.dolli.space/health

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

## Notes

- SSH access uses key auth on port 2222.
- Server has fail2ban enabled for SSH.
- Backups are configured on server for local DB.
