#!/bin/sh
set -e

# Wait for PostgreSQL to be ready
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
MAX_RETRIES=30
RETRY_INTERVAL=3

echo "⏳ Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."

retries=0
until nc -z "$POSTGRES_HOST" "$POSTGRES_PORT" 2>/dev/null; do
  retries=$((retries + 1))
  if [ "$retries" -ge "$MAX_RETRIES" ]; then
    echo "❌ ERROR: PostgreSQL did not become available after $((MAX_RETRIES * RETRY_INTERVAL))s. Aborting."
    exit 1
  fi
  echo "  Attempt $retries/$MAX_RETRIES — retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "✅ PostgreSQL is ready."

# Run Prisma migrations safely
echo "🔄 Running Prisma db push..."
npx prisma db push --accept-data-loss || {
  echo "❌ ERROR: Prisma db push failed. Aborting startup."
  exit 1
}
echo "✅ Prisma migrations applied."

# Start the API server (exec replaces the shell process so signals are forwarded)
echo "🚀 Starting API server..."
exec npm run start:prod
