#!/bin/bash
# Sync @csound/browser fork with upstream
# Usage: ./sync-upstream.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPSTREAM_DIR="$SCRIPT_DIR/../../../.references/csound/wasm/browser"

echo "=== Syncing @csound/browser fork with upstream ==="

# Check if upstream exists
if [ ! -d "$UPSTREAM_DIR" ]; then
  echo "❌ Upstream not found at: $UPSTREAM_DIR"
  echo "   Clone it first: git clone https://github.com/csound/csound.git .references/csound"
  exit 1
fi

# Show upstream version
echo "📦 Upstream version:"
grep '"version"' "$UPSTREAM_DIR/package.json" | head -1

echo ""
echo "📦 Current fork version:"
grep '"version"' "$SCRIPT_DIR/package.json" | head -1

echo ""
read -p "Continue with sync? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Backup current patches (the modified files)
echo ""
echo "📋 Backing up current patches..."
mkdir -p "$SCRIPT_DIR/.patch-backup"
cp "$SCRIPT_DIR/src/workers/worklet.singlethread.worker.js" "$SCRIPT_DIR/.patch-backup/"
cp "$SCRIPT_DIR/src/mains/worklet.singlethread.main.js" "$SCRIPT_DIR/.patch-backup/"

# Copy fresh source from upstream
echo "📥 Copying fresh source from upstream..."
rsync -av --delete \
  --exclude='tests' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.patch-backup' \
  --exclude='sync-upstream.sh' \
  "$UPSTREAM_DIR/" "$SCRIPT_DIR/"

echo ""
echo "🔧 Re-applying patches..."
echo "   You need to manually re-apply the patches."
echo ""
echo "   Patches to apply:"
echo "   1. src/workers/worklet.singlethread.worker.js"
echo "      - Move module globals to instance properties"
echo "      - See .patch-backup for reference"
echo ""
echo "   2. src/mains/worklet.singlethread.main.js"
echo "      - Don't close AudioContext in terminateInstance()"
echo "      - See .patch-backup for reference"
echo ""
echo "   Backup files are in: $SCRIPT_DIR/.patch-backup/"
echo ""
read -p "Press enter when patches are applied..."

# Rebuild
echo ""
echo "🔨 Installing dependencies..."
cd "$SCRIPT_DIR"
yarn install

echo ""
echo "🔨 Building..."
yarn build:prod

echo ""
echo "✅ Sync complete!"
echo ""
echo "Next steps:"
echo "  1. Test the changes: cd ../.. && bun run dev"
echo "  2. Commit: git add packages/csound-browser && git commit -m 'chore: sync csound-browser fork'"
