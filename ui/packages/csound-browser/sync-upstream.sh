#!/usr/bin/env bash
# Sync the vendored @csound/browser package with upstream's develop branch.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
UPSTREAM_REPOSITORY="$REPOSITORY_ROOT/.references/csound"
UPSTREAM_DIR="$UPSTREAM_REPOSITORY/wasm/browser"

if [ ! -d "$UPSTREAM_REPOSITORY/.git" ]; then
  mkdir -p "$(dirname "$UPSTREAM_REPOSITORY")"
  git clone --filter=blob:none https://github.com/csound/csound.git "$UPSTREAM_REPOSITORY"
fi

echo "Fetching upstream Csound develop branch..."
git -C "$UPSTREAM_REPOSITORY" fetch origin develop
git -C "$UPSTREAM_REPOSITORY" checkout --detach origin/develop

UPSTREAM_COMMIT="$(git -C "$UPSTREAM_REPOSITORY" rev-parse HEAD)"
UPSTREAM_VERSION="$(node -p "require('$UPSTREAM_DIR/package.json').version")"

echo "Syncing @csound/browser $UPSTREAM_VERSION from $UPSTREAM_COMMIT..."
rsync -a --delete \
  --exclude='examples' \
  --exclude='tests' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='PATCHES.md' \
  --exclude='UPSTREAM_COMMIT' \
  --exclude='sync-upstream.sh' \
  "$UPSTREAM_DIR/" "$SCRIPT_DIR/"

printf '%s\n' "$UPSTREAM_COMMIT" > "$SCRIPT_DIR/UPSTREAM_COMMIT"

echo "Installing @csound/browser dependencies..."
npm --prefix "$SCRIPT_DIR" ci

echo "Building @csound/browser..."
if command -v mise >/dev/null 2>&1; then
  mise exec java@temurin-21 -- npm --prefix "$SCRIPT_DIR" run build:prod
else
  npm --prefix "$SCRIPT_DIR" run build:prod
fi

echo "Synced @csound/browser $UPSTREAM_VERSION from $UPSTREAM_COMMIT."
