#!/bin/bash
# Test script for credit-score smart contract
# Runs all unit tests

set -e

echo "🧪 Running Credit Score Contract Tests..."

# Navigate to contract directory
cd "$(dirname "$0")/.."

# Run tests with testutils feature
echo "📝 Executing test suite..."
cargo test --lib

echo ""
echo "🎉 All tests completed!"
