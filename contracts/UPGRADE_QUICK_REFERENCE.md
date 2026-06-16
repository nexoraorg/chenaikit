# Smart Contract Upgrade Quick Reference

## Common Commands

### Check Current Version
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  --fn get_version
```

### Upgrade Contract (Automated)
```bash
./contracts/scripts/upgrade-contract.sh credit-score testnet
```

### Upgrade Contract (Manual)
```bash
# 1. Build
cd contracts/credit-score
soroban contract build

# 2. Upload WASM
WASM_HASH=$(soroban contract install \
  --wasm target/wasm32-unknown-unknown/release/credit_score.wasm \
  --network testnet)

# 3. Execute upgrade
soroban contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  --fn upgrade \
  -- \
  --admin $ADMIN_ADDRESS \
  --new_wasm_hash $WASM_HASH
```

### Rollback (Automated)
```bash
./contracts/scripts/rollback-contract.sh credit-score testnet
```

### Rollback (Manual)
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  --fn rollback \
  -- \
  --admin $ADMIN_ADDRESS
```

### Get Upgrade History
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  --fn get_upgrade_history
```

## Governance Upgrade Commands

### Initialize Upgrade Manager
```bash
soroban contract invoke \
  --id $UPGRADE_MANAGER_ID \
  --fn initialize \
  -- \
  --admin $ADMIN \
  --required_approvals 3 \
  --approval_timeout 604800
```

### Add Authorized Upgrader
```bash
soroban contract invoke \
  --id $UPGRADE_MANAGER_ID \
  --fn add_authorized \
  -- \
  --admin $ADMIN \
  --authorized $UPGRADER_ADDRESS
```

### Propose Upgrade
```bash
soroban contract invoke \
  --id $UPGRADE_MANAGER_ID \
  --fn propose_upgrade \
  -- \
  --proposer $PROPOSER \
  --upgrade_type 0 \
  --target_contract $TARGET_CONTRACT \
  --new_wasm_hash $WASM_HASH \
  --migration_data [] \
  --description "Upgrade to v2"
```

### Approve Upgrade
```bash
soroban contract invoke \
  --id $UPGRADE_MANAGER_ID \
  --fn approve_upgrade \
  -- \
  --proposal_id 1 \
  --approver $APPROVER_ADDRESS
```

### Execute Upgrade
```bash
soroban contract invoke \
  --id $UPGRADE_MANAGER_ID \
  --fn execute_upgrade \
  -- \
  --proposal_id 1 \
  --executor $EXECUTOR_ADDRESS
```

### Check Proposal Status
```bash
soroban contract invoke \
  --id $UPGRADE_MANAGER_ID \
  --fn get_upgrade_proposal \
  -- \
  --proposal_id 1
```

## Environment Variables

### Required
```bash
export ADMIN_ADDRESS="GXXX..."
export CONTRACT_ID="CXXX..."
export UPGRADE_MANAGER_ID="CXXX..."
```

### Optional
```bash
export CREDIT_SCORE_CONTRACT_ID="CXXX..."
export FRAUD_DETECT_CONTRACT_ID="CXXX..."
export SOROBAN_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"
```

## Contract Functions

### Credit Score Contract
```rust
// Upgrade functions
pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>)
pub fn upgrade_with_migration(env: Env, admin: Address, new_wasm_hash: BytesN<32>, migration_notes: String)
pub fn rollback(env: Env, admin: Address)
pub fn get_version(env: Env) -> u32
pub fn get_upgrade_history(env: Env) -> Vec<UpgradeRecord>
```

### Fraud Detection Contract
```rust
// Upgrade functions
pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>)
pub fn upgrade_with_migration(env: Env, admin: Address, new_wasm_hash: BytesN<32>, migration_notes: String)
pub fn rollback(env: Env, admin: Address)
pub fn get_version(env: Env) -> u32
pub fn get_upgrade_history(env: Env) -> Vec<UpgradeRecord>
```

### Upgrade Manager Contract
```rust
// Management functions
pub fn initialize(env: Env, admin: Address, required_approvals: u32, approval_timeout: u64)
pub fn add_authorized(env: Env, admin: Address, authorized: Address)
pub fn is_authorized(env: Env, address: Address) -> bool

// Proposal functions
pub fn propose_upgrade(env: Env, proposer: Address, upgrade_type: UpgradeType, target_contract: Address, new_wasm_hash: BytesN<32>, migration_data: Vec<String>, description: String) -> u64
pub fn approve_upgrade(env: Env, proposal_id: u64, approver: Address)
pub fn execute_upgrade(env: Env, proposal_id: u64, executor: Address) -> UpgradeResult
pub fn cancel_upgrade(env: Env, proposal_id: u64, canceller: Address)

// Query functions
pub fn get_upgrade_proposal(env: Env, proposal_id: u64) -> UpgradeProposal
pub fn get_upgrade_result(env: Env, proposal_id: u64) -> UpgradeResult
pub fn get_contract_version(env: Env, contract: Address) -> u32
pub fn upgrade_count(env: Env) -> u64
```

## Upgrade Types

```rust
enum UpgradeType {
    ContractUpgrade = 0,  // Standard WASM upgrade
    StorageMigration = 1, // Data migration only
    Emergency = 2,        // Fast-track upgrade
}
```

## Error Codes

### Upgrade Errors
- `NotAdmin = 1` - Caller is not admin
- `InvalidVersion = 2` - Invalid version transition
- `MigrationFailed = 3` - Migration failed
- `RollbackNotAvailable = 4` - No rollback hash stored

### Governance Errors
- `Unauthorized = 1` - Not authorized
- `InvalidProposal = 3` - Invalid proposal
- `AlreadyVoted = 5` - Already approved
- `QuorumNotReached = 12` - Not enough approvals
- `ProposalAlreadyExecuted = 9` - Already executed

## Testing Commands

### Run All Tests
```bash
cd contracts
cargo test upgrade
```

### Run Specific Test
```bash
cargo test test_upgrade_with_migration
```

### Run with Output
```bash
cargo test upgrade -- --nocapture
```

### Build for Testing
```bash
soroban contract build
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/contract.wasm
```

## Monitoring

### Check Contract Health
```bash
# Version
soroban contract invoke --id $CONTRACT_ID --fn get_version

# Test function
soroban contract invoke --id $CONTRACT_ID --fn some_test_function

# Check events
soroban events --id $CONTRACT_ID --start-ledger $START
```

### Monitor Upgrade
```bash
# Watch for upgrade events
soroban events --id $CONTRACT_ID --start-ledger $UPGRADE_LEDGER | grep "upgraded"

# Check version after upgrade
soroban contract invoke --id $CONTRACT_ID --fn get_version
```

## Troubleshooting

### Upgrade Failed
```bash
# Check current version
soroban contract invoke --id $CONTRACT_ID --fn get_version

# Check upgrade history
soroban contract invoke --id $CONTRACT_ID --fn get_upgrade_history

# Attempt rollback
./contracts/scripts/rollback-contract.sh contract-name network
```

### Version Mismatch
```bash
# Get expected version from code
grep "CURRENT_VERSION" contracts/*/src/upgrade.rs

# Get actual version
soroban contract invoke --id $CONTRACT_ID --fn get_version

# Check upgrade history for discrepancies
soroban contract invoke --id $CONTRACT_ID --fn get_upgrade_history
```

### Storage Issues
```bash
# Check if contract is responsive
soroban contract invoke --id $CONTRACT_ID --fn get_version

# Try to read critical data
soroban contract invoke --id $CONTRACT_ID --fn get_config

# If unresponsive, may need rollback
./contracts/scripts/rollback-contract.sh contract-name network
```

## File Locations

### Documentation
- `docs/contracts/upgrade-guide.md` - Comprehensive guide
- `contracts/UPGRADE_README.md` - Quick start
- `contracts/UPGRADE_CHECKLIST.md` - Upgrade checklist
- `contracts/docs/upgrade-proposal-template.md` - Proposal template

### Scripts
- `contracts/scripts/upgrade-contract.sh` - Automated upgrade
- `contracts/scripts/rollback-contract.sh` - Automated rollback

### Source Code
- `contracts/governance/src/upgrade_proposal.rs` - Upgrade manager
- `contracts/credit-score/src/upgrade.rs` - Credit score upgrades
- `contracts/fraud-detect/src/upgrade.rs` - Fraud detect upgrades

### Tests
- `contracts/tests/upgrade.test.rs` - Upgrade tests

## Best Practices

1. ✅ Always test on testnet first
2. ✅ Create backup before upgrade
3. ✅ Use governance for mainnet upgrades
4. ✅ Monitor for 24 hours post-upgrade
5. ✅ Have rollback plan ready
6. ✅ Document all changes
7. ✅ Notify stakeholders in advance
8. ✅ Verify version after upgrade
9. ✅ Test critical functions post-upgrade
10. ✅ Keep upgrade history

## Emergency Contacts

### Testnet Issues
- Check Stellar Discord #soroban
- Review Soroban docs: https://soroban.stellar.org

### Mainnet Issues
- Contact admin team immediately
- Execute rollback if critical
- Document all actions
- Post-mortem after resolution

## Quick Decision Tree

```
Upgrade Needed?
├─ Yes
│  ├─ Breaking Changes?
│  │  ├─ Yes → Use governance + migration
│  │  └─ No → Standard upgrade
│  ├─ Test on Testnet
│  ├─ Get Approvals
│  └─ Execute Upgrade
└─ No → Continue monitoring

Upgrade Failed?
├─ Critical Issue?
│  ├─ Yes → Immediate Rollback
│  └─ No → Investigate & Fix
└─ Monitor & Document
```

## Version History Format

```
v1.0.0 → v1.1.0 (2024-03-09)
- Added feature X
- Fixed bug Y
- Migration: Extended TTL for all data
- WASM Hash: abc123...

v1.1.0 → v1.2.0 (2024-03-16)
- Added feature Z
- Updated config structure
- Migration: Migrated config to v2 format
- WASM Hash: def456...
```

## Support

- Documentation: `docs/contracts/upgrade-guide.md`
- Issues: GitHub Issues
- Chat: Discord #dev-support
- Email: dev-support@example.com
