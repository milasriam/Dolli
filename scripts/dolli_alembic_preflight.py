#!/usr/bin/env python3
"""
Used by deploy.sh: detect SQLite DB state before `alembic upgrade head`.

Exit 0 — safe to run upgrade (Alembic revision present, or empty / no app tables yet).
Exit 2 — SQLite has application tables but no alembic_version (needs one-time stamp).
"""
from __future__ import annotations

import os
import sqlite3
import sys

try:
    from sqlalchemy.engine.url import make_url
except ImportError:
    print("preflight: sqlalchemy missing", file=sys.stderr)
    raise SystemExit(1)


def main() -> int:
    url = (os.environ.get("DATABASE_URL") or "").strip()
    try:
        u = make_url(url)
    except Exception as e:
        print(f"preflight: invalid DATABASE_URL: {e}", file=sys.stderr)
        return 1

    if u.get_backend_name() != "sqlite":
        print("preflight: non-sqlite DATABASE_URL — skip sqlite checks", file=sys.stderr)
        return 0

    path = u.database
    if not path:
        print("preflight: sqlite URL has no database path", file=sys.stderr)
        return 1

    if not os.path.isfile(path):
        print(f"preflight: sqlite file missing (migrate may create): {path}", file=sys.stderr)
        return 0

    size = os.path.getsize(path)
    if size == 0:
        print(
            f"preflight: EMPTY sqlite file {path} — fix DATABASE_URL or delete file before deploy",
            file=sys.stderr,
        )
        return 3

    con = sqlite3.connect(path)
    try:
        cur = con.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'")
        has_av = cur.fetchone() is not None
        cur.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name IN "
            "('campaigns','users','donations') LIMIT 1"
        )
        has_app = cur.fetchone() is not None
        if has_av:
            cur.execute("SELECT version_num FROM alembic_version LIMIT 1")
            row = cur.fetchone()
            rev = row[0] if row else ""
            print(f"preflight: alembic_version={rev!r} path={path}", file=sys.stderr)
            return 0
        if has_app:
            print(
                f"preflight: LEGACY_DB path={path} has app tables but NO alembic_version.\n"
                f"One-time on server (schema ~ migrations up to 1af5660b86f4):\n"
                f"  export DATABASE_URL={url!r}\n"
                f"  cd /opt/dolli/app/app/backend && /opt/dolli/venv/bin/python -m alembic stamp 1af5660b86f4\n"
                f"  /opt/dolli/venv/bin/python -m alembic upgrade head",
                file=sys.stderr,
            )
            return 2
        print(f"preflight: sqlite ready (no app tables) path={path}", file=sys.stderr)
        return 0
    finally:
        con.close()


if __name__ == "__main__":
    raise SystemExit(main())
