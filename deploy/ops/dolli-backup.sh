#!/usr/bin/env bash
# Install on VPS as /usr/local/bin/dolli-backup.sh (root cron).
# Backs up canonical SQLite DBs outside the rsync tree.

set -euo pipefail

DST_DIR="/opt/dolli/backups"
TS="$(date +%F_%H-%M-%S)"
LOG=/var/log/dolli-backup.log
mkdir -p "$DST_DIR"

log() { echo "$(date -Is) $*" | tee -a "$LOG"; }

backup_file() {
  local name="$1"
  local src="$2"
  if [[ -f "$src" && -s "$src" ]]; then
    cp "$src" "$DST_DIR/${name}_${TS}.db"
    gzip -f "$DST_DIR/${name}_${TS}.db"
    log "backed up $src -> ${name}_${TS}.db.gz"
  else
    log "skip $name (missing or empty): $src"
  fi
}

backup_file prod /var/lib/dolli/prod.db
backup_file staging /var/lib/dolli/staging.db
# Legacy dev DB under app tree (optional)
backup_file app_local /opt/dolli/app/app/backend/local.db

# Keep only the newest 14 gzip files per backup family name
for stem in prod staging app_local local; do
  ls -1t "$DST_DIR"/${stem}_*.db.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
done

log "done"
