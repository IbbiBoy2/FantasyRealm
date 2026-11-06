#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose --env-file .local/compose.env -f compose.yml -f compose.local.yml down
echo 'Conteneurs arretes. Volumes de donnees conserves.'
