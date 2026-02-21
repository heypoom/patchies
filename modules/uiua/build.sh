#!/bin/bash
# Build Uiua WASM module for Patchies
#
# Usage: ./build.sh
#
# Requirements:
#   - Rust toolchain (rustup)
#   - wasm-pack: cargo install wasm-pack
#   - wasm32-unknown-unknown target: rustup target add wasm32-unknown-unknown

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../../ui/src/assets/uiua"

echo "Building Uiua WASM module..."
echo "Output directory: $OUTPUT_DIR"
echo ""

# Check for required tools
if ! command -v cargo &> /dev/null; then
    echo "Error: cargo not found. Please install Rust first:"
    echo ""
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo ""
    echo "Then restart your shell or run: source ~/.cargo/env"
    exit 1
fi

if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    cargo install wasm-pack
fi

# Check for wasm target
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
    echo "Adding wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

cd "$SCRIPT_DIR"

echo "Building with wasm-pack (this may take a few minutes on first build)..."
wasm-pack build --target web --release --out-name uiua_wasm

echo ""
echo "Copying output files..."
mkdir -p "$OUTPUT_DIR"

# Copy the essential files
cp pkg/uiua_wasm.js "$OUTPUT_DIR/"
cp pkg/uiua_wasm_bg.wasm "$OUTPUT_DIR/"
cp pkg/uiua_wasm.d.ts "$OUTPUT_DIR/"

echo ""
echo "Done! Output files:"
ls -lh "$OUTPUT_DIR"/uiua_wasm*

echo ""
echo "Uiua WASM module is ready to use."
