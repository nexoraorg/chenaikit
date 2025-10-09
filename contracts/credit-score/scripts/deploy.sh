#!/bin/bash
# Deployment script for credit-score smart contract
# Deploys to Stellar testnet or mainnet

set -e

# Configuration
NETWORK="${NETWORK:-testnet}"
WASM_FILE="target/wasm32-unknown-unknown/release/credit_score.wasm"

echo "🚀 Deploying Credit Score Contract to $NETWORK..."

# Navigate to contract directory
cd "$(dirname "$0")/.."

# Check if WASM file exists
if [ ! -f "$WASM_FILE" ]; then
    echo "❌ WASM file not found at $WASM_FILE"
    echo "Please run build.sh first"
    exit 1
fi

# Check if source account is set
if [ -z "$DEPLOYER_SECRET" ]; then
    echo "❌ DEPLOYER_SECRET environment variable not set"
    echo "Please set it to your Stellar secret key:"
    echo "  export DEPLOYER_SECRET=S..."
    exit 1
fi

# Deploy the contract
echo "📤 Deploying contract..."
CONTRACT_ID=$(soroban contract deploy \
    --wasm "$WASM_FILE" \
    --source "$DEPLOYER_SECRET" \
    --network "$NETWORK")

echo "✅ Contract deployed successfully!"
echo "📋 Contract ID: $CONTRACT_ID"

# Save contract ID to file
echo "$CONTRACT_ID" > .contract-id-${NETWORK}
echo "💾 Contract ID saved to .contract-id-${NETWORK}"

# Initialize the contract if admin address is provided
if [ -n "$ADMIN_ADDRESS" ]; then
    echo ""
    echo "🔧 Initializing contract with admin: $ADMIN_ADDRESS"

    soroban contract invoke \
        --id "$CONTRACT_ID" \
        --source "$DEPLOYER_SECRET" \
        --network "$NETWORK" \
        -- initialize \
        --admin "$ADMIN_ADDRESS"

    echo "✅ Contract initialized!"
else
    echo ""
    echo "⚠️  Contract not initialized. To initialize, run:"
    echo "  export ADMIN_ADDRESS=<your_admin_address>"
    echo "  ./scripts/initialize.sh"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Contract Details:"
echo "  Network: $NETWORK"
echo "  Contract ID: $CONTRACT_ID"
echo ""
echo "Next steps:"
echo "  1. Initialize (if not done): ADMIN_ADDRESS=<addr> ./scripts/initialize.sh"
echo "  2. Interact with contract: ./scripts/invoke.sh <function_name>"
