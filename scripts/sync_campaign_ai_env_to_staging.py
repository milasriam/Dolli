#!/usr/bin/env python3
"""
Sync OpenAI-compatible campaign-AI env from local app/backend/.env to staging.

Updates on the server (/etc/dolli/staging.env):
  OPENAI_BASE_URL, OPENAI_API_KEY, CAMPAIGN_AI_MODEL
and removes APP_AI_BASE_URL / APP_AI_KEY so OPENAI_* wins (same resolution as backend).

Uses scp + ssh (secrets not passed on argv beyond scp of a temp file).

Usage (from repo root):
  python3 scripts/sync_campaign_ai_env_to_staging.py
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
REMOTE_CHUNK = "/tmp/dolli_campaign_ai_env_chunk"

# Remote lines removed before appending chunk (exact var names).
REMOTE_VAR_NAMES = (
    "OPENAI_BASE_URL",
    "OPENAI_API_KEY",
    "CAMPAIGN_AI_MODEL",
    "APP_AI_BASE_URL",
    "APP_AI_KEY",
)


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
    base = (vals.get("OPENAI_BASE_URL") or "").strip()
    key = (vals.get("OPENAI_API_KEY") or "").strip()
    model = (vals.get("CAMPAIGN_AI_MODEL") or "").strip()

    if not key:
        print("Set OPENAI_API_KEY in app/backend/.env (e.g. Groq gsk_...)", file=sys.stderr)
        return 1
    if not base:
        if key.startswith("gsk_"):
            base = "https://api.groq.com/openai/v1"
            print("OPENAI_BASE_URL missing; defaulting to Groq for gsk_* key.", flush=True)
        else:
            base = "https://api.openai.com/v1"
            print("OPENAI_BASE_URL missing; defaulting to https://api.openai.com/v1", flush=True)
    if not model:
        model = "gpt-4o-mini" if not key.startswith("gsk_") else "llama-3.1-8b-instant"
        print(f"CAMPAIGN_AI_MODEL missing; defaulting to {model}", flush=True)

    chunk_body = (
        f"OPENAI_BASE_URL={base}\n"
        f"OPENAI_API_KEY={key}\n"
        f"CAMPAIGN_AI_MODEL={model}\n"
    )

    scp_base = ["scp", "-P", SSH_PORT, "-i", SSH_KEY]
    ssh_base = ["ssh", "-p", SSH_PORT, "-i", SSH_KEY, SSH_HOST]

    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as tf:
        tf.write(chunk_body)
        local_tmp = tf.name
    try:
        os.chmod(local_tmp, 0o600)
        print("Uploading campaign AI env chunk (scp)...", flush=True)
        r = subprocess.run([*scp_base, local_tmp, f"{SSH_HOST}:{REMOTE_CHUNK}"], capture_output=True)
        if r.returncode != 0:
            print((r.stderr or b"").decode(), file=sys.stderr)
            return r.returncode
    finally:
        try:
            os.unlink(local_tmp)
        except OSError:
            pass

    # cat env | grep -v … | … so prior APP_AI_* / OPENAI_* campaign-AI lines are removed.
    pipe = f'cat "{REMOTE_ENV}"'
    for name in REMOTE_VAR_NAMES:
        pipe += f' | grep -v {shlex.quote("^" + name + "=")}'
    inner = (
        "set -e; set -u; "
        f'test -f "{REMOTE_ENV}" || exit 1; '
        f'test -f "{REMOTE_CHUNK}" || exit 1; '
        "TMP=$(mktemp); "
        f'{pipe} > "$TMP" || true; '
        f'cat "$TMP" > "{REMOTE_ENV}"; rm -f "$TMP"; '
        f'cat "{REMOTE_CHUNK}" >> "{REMOTE_ENV}"; rm -f "{REMOTE_CHUNK}"; '
        "systemctl restart dolli-backend-staging; "
        "systemctl is-active dolli-backend-staging; "
        "echo OK"
    )
    remote_wrapped = f"sh -c {shlex.quote(inner)}"

    r2 = subprocess.run(
        [*ssh_base, remote_wrapped],
        capture_output=True,
        text=True,
        env={**os.environ, "TERM": "xterm"},
    )
    if r2.returncode != 0:
        print(r2.stderr or r2.returncode, file=sys.stderr)
        return r2.returncode
    out = (r2.stdout or "").strip()
    if out:
        print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
