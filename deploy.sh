#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Pulling latest..."
git -C "$ROOT" pull origin main

echo "Building & starting containers..."
docker compose -f "$ROOT/docker/docker-compose.yml" --env-file "$ROOT/.env" up --build -d

echo "Done. Running containers:"
docker compose -f "$ROOT/docker/docker-compose.yml" ps
