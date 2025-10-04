#!/bin/bash
# Build script for credit-score smart contract
# This script compiles the contract to WebAssembly

set -e

echo "🔨 Building Credit Score Contract..."

# Navigate to contract directory
cd "$(dirname "$0")/.."

# Build the contract for wasm32 target
echo "📦 Compiling to WebAssembly..."
cargo build --target wasm32-unknown-unknown --release

# Check if build succeeded
if [ -f "target/wasm32-unknown-unknown/release/credit_score.wasm" ]; then
    echo "✅ Build successful!"
    echo "📁 WASM file: target/wasm32-unknown-unknown/release/credit_score.wasm"

    # Show file size
    FILE_SIZE=$(ls -lh target/wasm32-unknown-unknown/release/credit_score.wasm | awk '{print $5}')
    echo "📊 File size: $FILE_SIZE"
else
    echo "❌ Build failed - WASM file not found"
    exit 1
fi

echo ""
echo "🎉 Build complete!"
echo "Next steps:"
echo "  1. Run tests: cargo test"
echo "  2. Optimize (optional): ./scripts/optimize.sh"
echo "  3. Deploy: ./scripts/deploy.sh"
