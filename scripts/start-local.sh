#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .local/compose.env || ! -f .local/backend.env ]]; then
  bash scripts/init-local.sh
fi
docker compose --env-file .local/compose.env -f compose.yml -f compose.local.yml up -d --build --wait
echo 'Site : http://localhost:8080/FantasyRealm/Frontend/Html/index.html'
