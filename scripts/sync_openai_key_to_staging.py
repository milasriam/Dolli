#!/usr/bin/env python3
"""
Replace OPENAI_API_KEY in /etc/dolli/staging.env on the Dolli VPS.

Reads key only from app/backend/.env. Uses a temp file + scp (key never in ssh argv).

Usage (from repo root):
  python3 scripts/sync_openai_key_to_staging.py
"""
from __future__ import annotations

import os
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ENV_LOCAL = REPO / "app" / "backend" / ".env"

SSH_HOST = os.environ.get("DOLLI_STAGING_SSH", "root@109.235.119.191")
SSH_PORT = os.environ.get("DOLLI_STAGING_SSH_PORT", "2222")
SSH_KEY = os.path.expanduser(os.environ.get("DOLLI_STAGING_SSH_KEY", "~/.ssh/id_ed25519"))
REMOTE_ENV = "/etc/dolli/staging.env"
REMOTE_CHUNK = "/tmp/dolli_openai_key_line"


def main() -> int:
    try:
        from dotenv import dotenv_values
    except ImportError:
        print("Install python-dotenv", file=sys.stderr)
        return 1

    if not ENV_LOCAL.is_file():
        print(f"Missing {ENV_LOCAL}", file=sys.stderr)
        return 1

    vals = dotenv_values(ENV_LOCAL)
    key = (vals.get("OPENAI_API_KEY") or "").strip()
    if not key:
        print("OPENAI_API_KEY is empty in app/backend/.env", file=sys.stderr)
        return 1

    line = f"OPENAI_API_KEY={key}\n"

    scp_base = ["scp", "-P", SSH_PORT, "-i", SSH_KEY]
    ssh_base = ["ssh", "-p", SSH_PORT, "-i", SSH_KEY, SSH_HOST]

    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as tf:
        tf.write(line)
        local_tmp = tf.name
    try:
        os.chmod(local_tmp, 0o600)
        print("Uploading key line to staging (scp)...", flush=True)
        r = subprocess.run([*scp_base, local_tmp, f"{SSH_HOST}:{REMOTE_CHUNK}"], capture_output=True)
        if r.returncode != 0:
            print((r.stderr or b"").decode(), file=sys.stderr)
            return r.returncode
    finally:
        try:
            os.unlink(local_tmp)
        except OSError:
            pass

    # One argv string for ssh: OpenSSH on this host mishandles `ssh host bash -c script` from Python
    # (remote runs bare `set`). Use `ssh host 'sh -c ...'` with shlex-quoted script.
    inner = (
        f"set -e; set -u; "
        f'test -f "{REMOTE_ENV}" || exit 1; '
        f'test -f "{REMOTE_CHUNK}" || exit 1; '
        f'TMP=$(mktemp); '
        f'grep -v "^OPENAI_API_KEY=" "{REMOTE_ENV}" > "$TMP" || true; '
        f'cat "$TMP" > "{REMOTE_ENV}"; rm -f "$TMP"; '
        f'cat "{REMOTE_CHUNK}" >> "{REMOTE_ENV}"; rm -f "{REMOTE_CHUNK}"; '
        f"systemctl restart dolli-backend-staging; "
        f"systemctl is-active dolli-backend-staging; "
        f"echo OK"
    )
    remote_wrapped = f"sh -c {shlex.quote(inner)}"

    r2 = subprocess.run(
        [*ssh_base, remote_wrapped],
        capture_output=True,
        text=True,
        env={**os.environ, "TERM": "xterm"},
    )
    if r2.returncode != 0:
        print(r2.stderr or r2.stdout or str(r2.returncode), file=sys.stderr)
        return r2.returncode
    out = (r2.stdout or "").strip()
    if out:
        print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
