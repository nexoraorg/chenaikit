#!/bin/bash
# Initialize the deployed credit-score contract

set -e

# Configuration
NETWORK="${NETWORK:-testnet}"
CONTRACT_ID_FILE=".contract-id-${NETWORK}"

echo "🔧 Initializing Credit Score Contract..."

# Navigate to contract directory
cd "$(dirname "$0")/.."

# Check if contract ID file exists
if [ ! -f "$CONTRACT_ID_FILE" ]; then
    echo "❌ Contract ID file not found: $CONTRACT_ID_FILE"
    echo "Please deploy the contract first using ./scripts/deploy.sh"
    exit 1
fi

# Read contract ID
CONTRACT_ID=$(cat "$CONTRACT_ID_FILE")
echo "📋 Contract ID: $CONTRACT_ID"

# Check required environment variables
if [ -z "$DEPLOYER_SECRET" ]; then
    echo "❌ DEPLOYER_SECRET environment variable not set"
    exit 1
fi

if [ -z "$ADMIN_ADDRESS" ]; then
    echo "❌ ADMIN_ADDRESS environment variable not set"
    echo "Please set it to the admin's Stellar address:"
    echo "  export ADMIN_ADDRESS=G..."
    exit 1
fi

# Initialize the contract
echo "🚀 Calling initialize function..."
soroban contract invoke \
    --id "$CONTRACT_ID" \
    --source "$DEPLOYER_SECRET" \
    --network "$NETWORK" \
    -- initialize \
    --admin "$ADMIN_ADDRESS"

echo "✅ Contract initialized successfully!"
echo ""
echo "Configuration:"
echo "  Network: $NETWORK"
echo "  Contract ID: $CONTRACT_ID"
echo "  Admin: $ADMIN_ADDRESS"
echo ""
echo "🎉 Initialization complete!"
