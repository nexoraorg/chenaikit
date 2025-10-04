#!/bin/bash
# Invoke functions on the deployed credit-score contract

set -e

# Configuration
NETWORK="${NETWORK:-testnet}"
CONTRACT_ID_FILE=".contract-id-${NETWORK}"

# Check if function name provided
if [ -z "$1" ]; then
    echo "Usage: ./scripts/invoke.sh <function_name> [args...]"
    echo ""
    echo "Available functions:"
    echo "  get_score --account <address>"
    echo "  has_score --account <address>"
    echo "  calculate_score --account <address>"
    echo "  update_factors --account <address> --factors_str <string>"
    echo "  adjust_score_with_oracle --user <address> --oracle_contract <address>"
    echo ""
    echo "Example:"
    echo "  ./scripts/invoke.sh get_score --account GABC..."
    exit 1
fi

# Navigate to contract directory
cd "$(dirname "$0")/.."

# Check if contract ID file exists
if [ ! -f "$CONTRACT_ID_FILE" ]; then
    echo "❌ Contract ID file not found: $CONTRACT_ID_FILE"
    echo "Please deploy the contract first"
    exit 1
fi

CONTRACT_ID=$(cat "$CONTRACT_ID_FILE")
FUNCTION_NAME=$1
shift

echo "📞 Invoking $FUNCTION_NAME on contract $CONTRACT_ID..."
echo ""

# Invoke the contract
soroban contract invoke \
    --id "$CONTRACT_ID" \
    --source "${DEPLOYER_SECRET:-}" \
    --network "$NETWORK" \
    -- "$FUNCTION_NAME" "$@"

echo ""
echo "✅ Invocation complete!"
