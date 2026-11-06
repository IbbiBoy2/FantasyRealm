#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -e .local/compose.env || -e .local/backend.env ]]; then
  echo "Configuration .local deja presente; aucune modification." >&2
  exit 0
fi
command -v openssl >/dev/null || { echo "Installer openssl (Git Bash le fournit souvent)." >&2; exit 1; }
umask 077
mkdir -p .local
DB_PASS="$(openssl rand -hex 20)"
ROOT_PASS="$(openssl rand -hex 20)"
MONGO_PASS="$(openssl rand -hex 20)"
cat > .local/compose.env <<VARS
MARIADB_ROOT_PASSWORD=${ROOT_PASS}
MARIADB_PASSWORD=${DB_PASS}
MONGODB_PASSWORD=${MONGO_PASS}
BACKEND_ENV_FILE=./.local/backend.env
VARS
cat > .local/backend.env <<VARS
DB_HOST=db
DB_PORT=3306
DB_NAME=fantasyrealm
DB_USER=fantasyrealm
DB_PASSWORD=${DB_PASS}
MONGODB_URI=mongodb://fantasyrealm:${MONGO_PASS}@mongodb:27017/?authSource=admin
MONGODB_DATABASE=fantasyrealm
VARS
echo "Configuration locale creee dans .local/ (ne jamais commiter)."
