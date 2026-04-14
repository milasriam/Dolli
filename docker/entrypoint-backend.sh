#!/bin/sh
set -eu
mkdir -p /data
cd /app/app/backend
python -m alembic upgrade head
exec python -m uvicorn main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
