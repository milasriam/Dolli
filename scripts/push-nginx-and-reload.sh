#!/usr/bin/env bash
# One-shot: sync nginx from repo to VPS and reload (when you only need /api/ proxy fix).
# Same SSH defaults as deploy.sh. Run from repo root:
#   ./scripts/push-nginx-and-reload.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_HOST="${SSH_HOST:-root@109.235.119.191}"
SSH_PORT="${SSH_PORT:-2222}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
CONF="${ROOT}/deploy/nginx/dolli-multi.conf"
[[ -f "$CONF" ]] || { echo "Missing $CONF"; exit 1; }
scp -P "${SSH_PORT}" -i "${SSH_KEY}" "$CONF" "${SSH_HOST}:/etc/nginx/sites-available/dolli-multi.conf"
ssh -p "${SSH_PORT}" -i "${SSH_KEY}" "${SSH_HOST}" 'nginx -t && systemctl reload nginx'
echo "OK: nginx reloaded. Check: curl -sS https://dolli.space/api/v1/auth/login-options | head -c 120"
