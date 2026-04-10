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
  # Staging browser uses same-origin /api (nginx → 127.0.0.1:8001); build-time URL for any non-runtime paths.
  API_URL="https://staging.dolli.space"
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
VITE_API_BASE_URL=${API_URL} VITE_PAYMENTS_ENABLED=${VITE_PAYMENTS_ENABLED:-false} npm run build
rsync -a --delete dist/ ${FRONT_DIR}/

systemctl restart ${BACKEND_SERVICE}
systemctl is-active ${BACKEND_SERVICE}

echo "=== wait for API readiness ==="
ok=0
for i in \$(seq 1 30); do
  if [ "${TARGET}" = "staging" ]; then
    code=\$(curl -s -o /tmp/dolli_health.json -w "%{http_code}" ${SITE_URL}/health || true)
  else
    code=\$(curl -s -o /tmp/dolli_health.json -w "%{http_code}" ${API_URL}/health || true)
  fi
  if [ "\$code" = "200" ]; then
    ok=1
    break
  fi
  sleep 1
done

if [ "\$ok" -ne 1 ]; then
  echo "API did not become healthy in time"
  systemctl status ${BACKEND_SERVICE} --no-pager -l | sed -n '1,60p'
  journalctl -u ${BACKEND_SERVICE} -n 80 --no-pager
  exit 1
fi

echo "=== API (via public URL) ==="
curl -sS -i ${API_URL}/health | sed -n '1,12p'

echo "=== SITE ==="
curl -sS -I ${SITE_URL} | sed -n '1,12p'

echo "=== CORS preflight (local-login from ${SITE_URL}) ==="
curl -sSI -X OPTIONS "${API_URL}/api/v1/auth/local-login" \
  -H "Origin: ${SITE_URL}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" | sed -n '1,25p' || true
REMOTE

echo "✅ Deploy ${TARGET} done"
