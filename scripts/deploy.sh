#!/usr/bin/env bash
# Updates Wizsla on the Pi to the latest `main` and restarts it under PM2.
# Run from anywhere: ~/wizsla/scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

step() { printf '\n==> %s\n' "$*"; }

required=$(cat .nvmrc)
if [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$required" ]]; then
  echo "Node $required or newer is needed; this is $(node -v)." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Local changes in $(pwd); commit or discard them first." >&2
  exit 1
fi

step "Fetching main"
git fetch --tags origin
git checkout --quiet main
before=$(git rev-parse HEAD)
git merge --ff-only origin/main
after=$(git rev-parse HEAD)

if [[ -f data/wizsla.db && -f dist/cli/main.js ]]; then
  step "Backing up the database (before migrations)"
  npm run --silent cli -- db:backup
fi

step "Installing dependencies"
npm ci --no-audit --no-fund

step "Applying database migrations"
npm run db:deploy

step "Building"
npm run build

step "Restarting under PM2"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

step "Waiting for /health"
port=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || true)
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${port:-3000}/health"; then
    echo
    echo
    echo "Deployed $(git describe --tags --always) (${before:0:7} -> ${after:0:7})."
    exit 0
  fi
  sleep 1
done
echo "Wizsla did not become healthy; see: pm2 logs wizsla" >&2
exit 1
