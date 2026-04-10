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
/opt/dolli/venv/bin/alembic upgrade head
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
