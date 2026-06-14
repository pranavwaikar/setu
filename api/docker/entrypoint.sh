#!/bin/sh
set -e

# ─── Configuration ────────────────────────────────────────────────────────────
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
MAX_RETRIES=30
RETRY_INTERVAL=3

# ─── Wait for PostgreSQL ──────────────────────────────────────────────────────
echo "⏳ Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."

retries=0
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -q 2>/dev/null; do
  retries=$((retries + 1))
  if [ "$retries" -ge "$MAX_RETRIES" ]; then
    echo "❌ ERROR: PostgreSQL did not become ready after $((MAX_RETRIES * RETRY_INTERVAL))s. Aborting."
    exit 1
  fi
  echo "  Attempt $retries/$MAX_RETRIES — retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "✅ PostgreSQL is ready."

# ─── Run Prisma migrations ────────────────────────────────────────────────────
echo "🔄 Running Prisma db push..."
if ! npx prisma db push --accept-data-loss; then
  echo "❌ ERROR: Prisma db push failed. Aborting startup."
  exit 1
fi
echo "✅ Prisma migrations applied."

# ─── Start API server ─────────────────────────────────────────────────────────
echo "🚀 Starting API server..."
exec npm run start:prod
