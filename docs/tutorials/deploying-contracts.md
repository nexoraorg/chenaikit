# Deploying Smart Contracts to Stellar

This comprehensive guide walks you through deploying Soroban smart contracts to the Stellar network. You'll learn how to build, test, optimize, and deploy the ChenAIKit credit scoring contract.

## Prerequisites

- Rust 1.70+ installed
- Soroban CLI installed
- Stellar account with XLM for deployment
- Basic understanding of smart contracts
- 30-45 minutes

## Step 1: Install Required Tools

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Install Soroban CLI

```bash
cargo install --locked soroban-cli
```

### Add WebAssembly Target

```bash
rustup target add wasm32-unknown-unknown
```

### Verify Installation

```bash
soroban --version
# Should output: soroban 20.x.x
```

## Step 2: Set Up Your Environment

### Configure Stellar Network

```bash
# Configure testnet
soroban config network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"

# Configure mainnet (for production)
soroban config network add \
  --global mainnet \
  --rpc-url https://soroban-mainnet.stellar.org:443 \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

### Create or Import Identity

```bash
# Generate new identity
soroban config identity generate deployer

# Or import existing secret key
soroban config identity add deployer --secret-key SXXX...

# View your public key
soroban config identity address deployer
```

### Fund Your Account (Testnet Only)

```bash
# Get testnet XLM
soroban config identity fund deployer --network testnet

# Verify balance
soroban config identity show deployer
```

## Step 3: Build the Contract

Navigate to the credit score contract directory:

```bash
cd contracts/credit-score
```

### Build for Development

```bash
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM file will be at:
```
target/wasm32-unknown-unknown/release/credit_score.wasm
```

### Optimize the Contract

For production, optimize the WASM to reduce size and gas costs:

```bash
# Using the provided script
./scripts/optimize.sh

# Or manually with soroban-cli
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/credit_score.wasm \
  --wasm-out target/wasm32-unknown-unknown/release/credit_score_optimized.wasm
```

Optimization typically reduces contract size by 50-70%.

## Step 4: Test the Contract Locally

Before deploying, run comprehensive tests:

```bash
# Run unit tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_calculate_score
```

### Test Contract Functions

```bash
# Build and test
./scripts/test.sh
```

Expected output:
```
running 8 tests
test test::test_calculate_and_get_score ... ok
test test::test_has_score ... ok
test test::test_authorization_required ... ok
test test::test_adjust_score_with_oracle ... ok
test test::test_calculate_score_multiple_times ... ok
test test::test_edge_case_zero_score ... ok
test test::test_get_score_returns_zero_for_new_user ... ok
test test::test_upgrade ... ok

test result: ok. 8 passed; 0 failed
```

## Step 5: Deploy to Testnet

### Deploy the Contract

```bash
# Deploy using soroban-cli
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/credit_score.wasm \
  --source deployer \
  --network testnet

# Or use the deployment script
./scripts/deploy.sh testnet
```

Save the contract ID from the output:
```
Contract deployed successfully!
Contract ID: CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM
```

### Store Contract ID

```bash
# Save for future use
export CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM

# Or add to .env file
echo "CONTRACT_ID=$CONTRACT_ID" >> .env
```

## Step 6: Initialize the Contract

After deployment, initialize the contract with an admin address:

```bash
# Get your admin address
ADMIN_ADDRESS=$(soroban config identity address deployer)

# Initialize contract
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- \
  initialize \
  --admin $ADMIN_ADDRESS

# Or use the initialization script
./scripts/initialize.sh testnet $CONTRACT_ID
```

## Step 7: Interact with the Contract

### Calculate a Credit Score

```bash
# Calculate score for an account
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- \
  calculate_score \
  --account GABC...

# Expected output: 750
```

### Get Stored Score

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- \
  get_score \
  --account GABC...
```

### Check if Account Has Score

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- \
  has_score \
  --account GABC...

# Returns: true or false
```

### Update Score Factors

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- \
  update_factors \
  --account GABC... \
  --factors_str "age:30,transactions:50,balance:high"
```

## Step 8: Deploy to Mainnet

Once thoroughly tested on testnet, deploy to mainnet:

### Fund Mainnet Account

Ensure your deployer account has sufficient XLM:
- Minimum: 1 XLM for account creation
- Recommended: 10-20 XLM for deployment and operations

### Deploy to Mainnet

```bash
# Deploy
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/credit_score_optimized.wasm \
  --source deployer \
  --network mainnet

# Initialize
MAINNET_CONTRACT_ID=<your-contract-id>
ADMIN_ADDRESS=$(soroban config identity address deployer)

soroban contract invoke \
  --id $MAINNET_CONTRACT_ID \
  --source deployer \
  --network mainnet \
  -- \
  initialize \
  --admin $ADMIN_ADDRESS
```

### Verify Deployment

```bash
# Test a simple read operation
soroban contract invoke \
  --id $MAINNET_CONTRACT_ID \
  --source deployer \
  --network mainnet \
  -- \
  has_score \
  --account $ADMIN_ADDRESS
```

## Step 9: Monitor and Maintain

### View Contract Events

```bash
# Get recent events
soroban events \
  --start-ledger <ledger-number> \
  --id $CONTRACT_ID \
  --network testnet
```

### Upgrade Contract (If Needed)

```bash
# Build new version
cargo build --target wasm32-unknown-unknown --release

# Get new WASM hash
NEW_WASM_HASH=$(soroban contract install \
  --wasm target/wasm32-unknown-unknown/release/credit_score.wasm \
  --source deployer \
  --network testnet)

# Upgrade contract
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- \
  upgrade \
  --admin $ADMIN_ADDRESS \
  --new_wasm_hash $NEW_WASM_HASH
```

## Best Practices

### Security

1. **Never commit secret keys** - Use environment variables or secure vaults
2. **Test thoroughly** - Run all tests before mainnet deployment
3. **Use optimized WASM** - Reduces costs and improves performance
4. **Implement access control** - Use admin-only functions for sensitive operations
5. **Audit contracts** - Have contracts reviewed before mainnet deployment

### Cost Optimization

1. **Optimize WASM size** - Smaller contracts cost less to deploy
2. **Minimize storage** - Use temporary storage when possible
3. **Batch operations** - Combine multiple operations to save on fees
4. **Use efficient data structures** - Choose appropriate storage patterns

### Monitoring

1. **Track contract events** - Monitor for unexpected behavior
2. **Set up alerts** - Get notified of critical events
3. **Monitor gas usage** - Optimize expensive operations
4. **Keep backups** - Store contract source and deployment info

## Troubleshooting

### "Insufficient balance"
- Fund your account with more XLM
- Check network fees and ensure adequate balance

### "Contract already exists"
- Use a different identity or deploy to a different network
- Or upgrade the existing contract

### "Authorization failed"
- Ensure you're using the correct admin address
- Verify the identity has proper permissions

### "WASM validation failed"
- Rebuild the contract with correct target
- Ensure Rust and Soroban CLI are up to date
- Check for compilation errors

## Next Steps

- [Contract Architecture](../architecture/contracts.md) - Understand contract design
- [API Integration](./api-integration.md) - Connect contracts to your backend
- [Testing Guide](./testing-contracts.md) - Comprehensive testing strategies
- [Security Audit](../../contracts/audit-report.md) - Review security findings

## Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar Laboratory](https://laboratory.stellar.org/)
- [Soroban Examples](https://github.com/stellar/soroban-examples)
- [ChenAIKit Discord](https://discord.gg/chenaikit)

## Get Help

- 🐛 [Report Issues](https://github.com/nexoraorg/chenaikit/issues)
- 💬 [Join Discord](https://discord.gg/chenaikit)
- 📧 [Email Support](mailto:support@chenaikit.com)
