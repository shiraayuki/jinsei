#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    docker compose -f "$ROOT/docker/docker-compose.dev.yml" down
    echo "Done."
    exit 0
}

trap cleanup INT TERM

echo "Starting Postgres..."
docker compose -f "$ROOT/docker/docker-compose.dev.yml" up -d

echo "Starting Backend..."
cd "$ROOT/backend" && dotnet watch run &
BACKEND_PID=$!

echo "Starting Frontend..."
cd "$ROOT/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "All services running. Press Ctrl+C to stop."
echo ""

wait $BACKEND_PID $FRONTEND_PID
