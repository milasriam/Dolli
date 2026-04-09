#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "prod" && "$TARGET" != "staging" ]]; then
  echo "Usage: ./scripts/deploy.sh [prod|staging]"
  exit 1
fi

SSH_HOST="root@109.235.119.191"
SSH_PORT="2222"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_APP="/opt/dolli/app"

if [[ "$TARGET" == "prod" ]]; then
  API_URL="https://api.dolli.space"
  SITE_URL="https://dolli.space"
  BACKEND_SERVICE="dolli-backend-prod"
  FRONT_DIR="/opt/dolli/www/prod"
else
  API_URL="https://api-staging.dolli.space"
  SITE_URL="https://staging.dolli.space"
  BACKEND_SERVICE="dolli-backend-staging"
  FRONT_DIR="/opt/dolli/www/staging"
fi

echo "===> Sync code to server"
rsync -az --delete \
  --exclude ".git" --exclude ".venv" --exclude "venv" --exclude "node_modules" --exclude "dist" \
  -e "ssh -p ${SSH_PORT} -i ${SSH_KEY}" \
  "./" "${SSH_HOST}:${REMOTE_APP}/"

echo "===> Remote deploy: ${TARGET}"
ssh -p "${SSH_PORT}" -i "${SSH_KEY}" "${SSH_HOST}" bash -s <<REMOTE
set -euo pipefail

cd ${REMOTE_APP}/app/frontend
npm install
VITE_API_BASE_URL=${API_URL} npm run build
rsync -a --delete dist/ ${FRONT_DIR}/

systemctl restart ${BACKEND_SERVICE}
systemctl is-active ${BACKEND_SERVICE}

echo "=== API ==="
curl -sS -i ${API_URL}/health | sed -n '1,10p'

echo "=== SITE ==="
curl -sS -I ${SITE_URL} | sed -n '1,10p'
REMOTE

echo "✅ Deploy ${TARGET} done"
