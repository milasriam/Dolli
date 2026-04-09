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

1. Syncs source code to server (/opt/dolli/app) via rsync.
2. Builds frontend with correct VITE_API_BASE_URL for selected environment.
3. Publishes built frontend to /opt/dolli/www/staging or /opt/dolli/www/prod.
4. Restarts corresponding backend service (dolli-backend-staging or dolli-backend-prod).
5. Runs health checks for API and site.

## Quick Post-Deploy Checks

- Staging:
  - https://staging.dolli.space
  - https://api-staging.dolli.space/health

- Production:
  - https://dolli.space
  - https://api.dolli.space/health

Expected API response:
{"status":"healthy"}

## Rollback (quick)

1. Checkout previous stable commit locally.
2. Re-run deploy for target env:
   - ./scripts/deploy.sh staging
   - ./scripts/deploy.sh prod

## Notes

- SSH access uses key auth on port 2222.
- Server has fail2ban enabled for SSH.
- Backups are configured on server for local DB.
