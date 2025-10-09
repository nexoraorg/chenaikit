#!/bin/bash
# Optimize the compiled WASM file for deployment
# This reduces the file size and gas costs

set -e

echo "⚡ Optimizing Credit Score Contract WASM..."

# Navigate to contract directory
cd "$(dirname "$0")/.."

# Check if WASM file exists
if [ ! -f "target/wasm32-unknown-unknown/release/credit_score.wasm" ]; then
    echo "❌ WASM file not found. Please run build.sh first."
    exit 1
fi

# Show original size
ORIGINAL_SIZE=$(ls -lh target/wasm32-unknown-unknown/release/credit_score.wasm | awk '{print $5}')
echo "📊 Original size: $ORIGINAL_SIZE"

# Optimize using soroban-cli
echo "🔧 Running soroban contract optimize..."
soroban contract optimize \
    --wasm target/wasm32-unknown-unknown/release/credit_score.wasm

# The optimized file replaces the original
OPTIMIZED_SIZE=$(ls -lh target/wasm32-unknown-unknown/release/credit_score.wasm | awk '{print $5}')
echo "✅ Optimization complete!"
echo "📊 Optimized size: $OPTIMIZED_SIZE"

echo ""
echo "🎉 WASM optimization complete!"
echo "Next step: Deploy with ./scripts/deploy.sh"
