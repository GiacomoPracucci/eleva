#!/usr/bin/env bash
set -euo pipefail

# Allow overriding the default command
DEFAULT_CMD=("uvicorn" "app.main:app" "--host" "0.0.0.0" "--port" "8000")

# Wait for the database to be ready before running migrations/app
python <<'PY'
import asyncio
import os
import sys

import asyncpg

raw_url = os.environ.get("DATABASE_URL")
if not raw_url:
    print("DATABASE_URL environment variable is required", file=sys.stderr)
    sys.exit(1)

if raw_url.startswith("postgresql+asyncpg://"):
    db_url = "postgresql://" + raw_url.split("://", 1)[1]
elif raw_url.startswith("postgresql+psycopg2://"):
    db_url = raw_url.replace("postgresql+psycopg2://", "postgresql://", 1)
else:
    db_url = raw_url

max_attempts = int(os.environ.get("DB_MAX_RETRIES", "30"))
delay_seconds = float(os.environ.get("DB_RETRY_DELAY", "2"))

async def wait_for_db():
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            conn = await asyncpg.connect(db_url)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            print(f"Database not ready (attempt {attempt}/{max_attempts}): {exc}")
            await asyncio.sleep(delay_seconds)
        else:
            await conn.close()
            print("Database connection established.")
            return
    raise SystemExit(f"Database never became available: {last_error}")

asyncio.run(wait_for_db())
PY

if [[ "${RUN_MIGRATIONS:-true}" == "true" ]]; then
  echo "Applying database migrations..."
  alembic upgrade head
fi

echo "Starting API server..."
if [[ $# -gt 0 ]]; then
  exec "$@"
else
  exec "${DEFAULT_CMD[@]}"
fi
