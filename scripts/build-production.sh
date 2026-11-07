#!/usr/bin/env bash
set -euo pipefail

# FantasyRealm - publication selective de dev vers production.
# Inspiration: Adigon (worktree temporaire) et GML Shield (liste blanche).
# Usage: bash scripts/build-production.sh --dry-run
#        bash scripts/build-production.sh --publish
# Le script ne deploie PAS sur le serveur et ne transfere aucun secret.

SOURCE_BRANCH="dev"
TARGET_BRANCH="production"
MODE="${1:---dry-run}"

if [[ $# -gt 1 || ( "$MODE" != "--dry-run" && "$MODE" != "--publish" ) ]]; then
  echo "Usage: bash scripts/build-production.sh [--dry-run|--publish]" >&2
  exit 2
fi

for command in git tar mktemp; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Commande requise introuvable: $command" >&2
    exit 1
  }
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Lancer ce script dans le depot Git FantasyRealm." >&2
  exit 1
}
cd "$ROOT"

# Emp eche une publication accidentelle depuis un autre projet.
if [[ ! -f compose.yml || ! -f compose.prod.yml || ! -f docker/Dockerfile || ! -f Backend/composer.lock ]]; then
  echo "Erreur: les fichiers attendus de FantasyRealm sont absents." >&2
  exit 1
fi

# Liste blanche : uniquement le code et les definitions necessaires a Docker.
# Git archive n'exporte que les fichiers suivis par Git.
PATHS=(
  .dockerignore
  .gitignore
  Backend/api
  Backend/config
  Backend/Database/shema.sql
  Backend/Database/seed.sql
  Backend/composer.json
  Backend/composer.lock
  Frontend
  docker/Dockerfile
  docker/apache.conf
  compose.yml
  compose.prod.yml
)

# Fichiers explicitement non requis: docs/, README-DOCKER.md,
# compose.local.yml, scripts/init-local.sh, tests et fichiers de developpement.
# Jamais: .env, .local/, .private/, vendor/, mots de passe ni exports SQL prives.

printf 'Source: %s | Cible: %s | Mode: %s\n' "$SOURCE_BRANCH" "$TARGET_BRANCH" "$MODE"

if [[ "$MODE" == "--publish" ]]; then
  if [[ "$(git branch --show-current)" != "$SOURCE_BRANCH" ]]; then
    echo "Erreur: basculer sur $SOURCE_BRANCH avant de publier." >&2
    exit 1
  fi
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Erreur: le depot contient des modifications non commitees." >&2
    exit 1
  fi
fi

# Verifier les composants de dev avant d'agir.
if ! git show-ref --verify --quiet "refs/heads/$SOURCE_BRANCH"; then
  echo "Erreur: la branche locale $SOURCE_BRANCH est absente." >&2
  exit 1
fi
SOURCE_SHA="$(git rev-parse "refs/heads/$SOURCE_BRANCH")"
for path in "${PATHS[@]}"; do
  if ! git cat-file -e "${SOURCE_SHA}:$path" 2>/dev/null; then
    echo "Erreur: fichier ou repertoire requis absent de $SOURCE_BRANCH: $path" >&2
    exit 1
  fi
done

# Controle supplementaire des chemins: la branche production ne doit pas
# contenir de documents, de secrets ou de scripts locaux.
mapfile -t FILES < <(git ls-tree -r --name-only "$SOURCE_SHA" -- "${PATHS[@]}")
if ((${#FILES[@]} == 0)); then
  echo "Erreur: liste de fichiers vide." >&2
  exit 1
fi
for path in "${FILES[@]}"; do
  case "/$path" in
    */.env|*/.env.*|*/.local/*|*/.private/*|*/vendor/*|*/node_modules/*)
      echo "Erreur: fichier sensible ou inutile detecte: $path" >&2
      exit 1 ;;
  esac
done

if [[ "$MODE" == "--dry-run" ]]; then
  printf '\n=== %s fichiers qui seraient publies ===\n' "${#FILES[@]}"
  printf '%s\n' "${FILES[@]}"
  printf '\nAucun commit, aucune branche et aucun push effectue.\n'
  exit 0
fi

# Eviter de publier un etat de dev non pousse.
git fetch origin "$SOURCE_BRANCH"
if [[ "$SOURCE_SHA" != "$(git rev-parse "refs/remotes/origin/$SOURCE_BRANCH")" ]]; then
  echo "Erreur: dev local et origin/dev ne correspondent pas. Pousser ou mettre a jour dev." >&2
  exit 1
fi

# Determiner si production existe sans masquer les erreurs reseau/authentification.
TARGET_REMOTE_SHA="$(git ls-remote --heads origin "$TARGET_BRANCH" | awk '{print $1}')"
if [[ -n "$TARGET_REMOTE_SHA" ]]; then
  git fetch origin "$TARGET_BRANCH"
  if [[ "$TARGET_REMOTE_SHA" != "$(git rev-parse "refs/remotes/origin/$TARGET_BRANCH")" ]]; then
    echo "Erreur: production distante a change pendant la preparation." >&2
    exit 1
  fi
fi

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/fantasyrealm-production.XXXXXXXX")"
WT="$TMPROOT/worktree"
ADDED=0
cleanup() {
  if [[ "$ADDED" == 1 ]]; then
    git worktree remove --force "$WT" >/dev/null 2>&1 || true
  fi
  rmdir "$TMPROOT" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [[ -n "$TARGET_REMOTE_SHA" ]]; then
  git worktree add --detach "$WT" "$TARGET_REMOTE_SHA"
else
  # Une premiere publication cree une branche sans heriter des documents de dev.
  if git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
    echo "Erreur: branche locale production existe deja, mais pas sur origin." >&2
    exit 1
  fi
  git worktree add --detach "$WT" "$SOURCE_SHA"
  git -C "$WT" switch --orphan "$TARGET_BRANCH"
fi
ADDED=1

# Le worktree est une copie temporaire controlee, jamais le dossier principal.
find "$WT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf -- {} +
git archive "$SOURCE_SHA" "${PATHS[@]}" | tar -x -C "$WT"

git -C "$WT" add -A
if git -C "$WT" diff --cached --quiet; then
  echo "Production deja a jour. Rien a publier."
  exit 0
fi

git -C "$WT" diff --cached --stat
printf '\nPublication vers origin/%s ...\n' "$TARGET_BRANCH"
git -C "$WT" -c user.name="FantasyRealm Release" -c user.email="release@users.noreply.github.com" \
  commit -m "chore(production): snapshot de dev ${SOURCE_SHA:0:12}"

# Push normal: si origin/production a avance, Git refuse le non-fast-forward.
git -C "$WT" push origin "HEAD:refs/heads/$TARGET_BRANCH"

echo "Publication terminee: origin/$TARGET_BRANCH"
echo "Source utilisee: $SOURCE_SHA"
echo "Le serveur n'a pas ete modifie."
