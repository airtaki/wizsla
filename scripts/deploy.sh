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
# ecosystem.config.cjs pins the interpreter to this shell's Node. A reload
# keeps the old interpreter, so after a Node upgrade the app is recreated.
node_bin=$(node -p 'process.execPath')
running_bin=$(pm2 jlist | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const app = JSON.parse(s).find((p) => p.name === "wizsla");
    console.log(app ? app.pm2_env.exec_interpreter : "");
  });')
if [[ -n "$running_bin" && "$running_bin" != "$node_bin" ]]; then
  echo "Switching Wizsla from $running_bin to $node_bin"
  pm2 delete wizsla
fi
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

step "Waiting for /health"
port=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || true)
for _ in $(seq 1 30); do
  if health=$(curl -fsS "http://127.0.0.1:${port:-3000}/health"); then
    echo "$health"
    running_node=$(node -p "JSON.parse(process.argv[1]).node" "$health")
    if [[ "$running_node" != "$(node -v)" ]]; then
      echo "Warning: Wizsla runs on Node $running_node, not $(node -v)." >&2
    fi
    echo
    echo "Deployed $(git describe --tags --always) (${before:0:7} -> ${after:0:7})."
    exit 0
  fi
  sleep 1
done
echo "Wizsla did not become healthy; see: pm2 logs wizsla" >&2
exit 1
