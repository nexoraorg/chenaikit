# Smart Contract Upgrade System

## Overview

This repository implements a comprehensive upgrade system for Soroban smart contracts with governance, migration support, and rollback capabilities.

## Features

- ✅ **Multi-Signature Governance** - Require multiple approvals for upgrades
- ✅ **Storage Migration** - Automated data migration between versions
- ✅ **Rollback Support** - Emergency rollback to previous versions
- ✅ **Upgrade History** - Complete audit trail of all upgrades
- ✅ **Version Tracking** - Semantic versioning for contracts
- ✅ **Testing Framework** - Comprehensive upgrade testing
- ✅ **Automated Scripts** - CLI tools for upgrade management

## Quick Start

### 1. Initialize Upgrade System

```rust
// In your contract initialization
use upgrade::{init_admin, init_upgrade_system};

pub fn initialize(env: Env, admin: Address) {
    admin.require_auth();
    init_admin(&env, &admin);
    init_upgrade_system(&env);
}
```

### 2. Perform Standard Upgrade

```bash
# Using the upgrade script
./contracts/scripts/upgrade-contract.sh credit-score testnet

# Or manually
soroban contract invoke \
  --id $CONTRACT_ID \
  --fn upgrade \
  -- \
  --admin $ADMIN_ADDRESS \
  --new_wasm_hash $NEW_WASM_HASH
```

### 3. Rollback if Needed

```bash
# Using the rollback script
./contracts/scripts/rollback-contract.sh credit-score testnet

# Or manually
soroban contract invoke \
  --id $CONTRACT_ID \
  --fn rollback \
  -- \
  --admin $ADMIN_ADDRESS
```

## Architecture

### Components

```
contracts/
├── governance/
│   └── src/
│       └── upgrade_proposal.rs    # Multi-sig upgrade manager
├── credit-score/
│   └── src/
│       └── upgrade.rs             # Contract-specific upgrade logic
├── fraud-detect/
│   └── src/
│       └── upgrade.rs             # Contract-specific upgrade logic
├── scripts/
│   ├── upgrade-contract.sh        # Automated upgrade script
│   └── rollback-contract.sh       # Automated rollback script
├── tests/
│   └── upgrade.test.rs            # Comprehensive upgrade tests
└── docs/
    ├── upgrade-guide.md           # Detailed upgrade guide
    └── upgrade-proposal-template.md # Proposal template
```

### Upgrade Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Upgrade Lifecycle                        │
└─────────────────────────────────────────────────────────────┘

1. Propose Upgrade
   ├─ Build new WASM
   ├─ Upload to network
   └─ Create proposal

2. Governance Approval
   ├─ Collect signatures
   ├─ Verify quorum
   └─ Queue for execution

3. Execute Upgrade
   ├─ Run pre-upgrade checks
   ├─ Execute migrations
   ├─ Update WASM
   └─ Verify success

4. Post-Upgrade
   ├─ Monitor behavior
   ├─ Verify functionality
   └─ Update documentation

5. Rollback (if needed)
   ├─ Detect issues
   ├─ Execute rollback
   └─ Restore previous state
```

## Contract Upgrade Functions

### Basic Upgrade

```rust
pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
    admin.require_auth();
    verify_admin(&env, &admin);
    
    // Execute migrations
    let old_version = get_version(&env);
    execute_migrations(&env, old_version, old_version + 1);
    
    // Perform upgrade
    env.deployer().update_current_contract_wasm(new_wasm_hash);
    
    // Update version
    set_version(&env, old_version + 1);
}
```

### Upgrade with Migration

```rust
pub fn upgrade_with_migration(
    env: Env,
    admin: Address,
    new_wasm_hash: BytesN<32>,
    migration_notes: String,
) {
    admin.require_auth();
    verify_admin(&env, &admin);
    
    let old_version = get_version(&env);
    
    // Store rollback hash
    store_rollback_hash(&env, &new_wasm_hash);
    
    // Execute migrations
    execute_migrations(&env, old_version, old_version + 1);
    
    // Perform upgrade
    env.deployer().update_current_contract_wasm(new_wasm_hash);
    
    // Record upgrade
    record_upgrade(&env, old_version, old_version + 1, new_wasm_hash, admin, migration_notes);
}
```

### Rollback

```rust
pub fn rollback(env: Env, admin: Address) {
    admin.require_auth();
    verify_admin(&env, &admin);
    
    let rollback_hash = get_rollback_hash(&env)
        .expect("No rollback available");
    
    env.deployer().update_current_contract_wasm(rollback_hash);
    
    let current_version = get_version(&env);
    set_version(&env, current_version - 1);
}
```

## Governance-Based Upgrades

### Setup Upgrade Manager

```rust
use upgrade_manager::UpgradeManagerClient;

// Deploy and initialize
let upgrade_mgr = UpgradeManagerClient::new(&env, &upgrade_manager_id);
upgrade_mgr.initialize(&admin, &3, &604800); // 3 approvals, 7-day timeout

// Add authorized upgraders
upgrade_mgr.add_authorized(&admin, &upgrader1);
upgrade_mgr.add_authorized(&admin, &upgrader2);
upgrade_mgr.add_authorized(&admin, &upgrader3);
```

### Propose and Execute

```rust
// Propose upgrade
let proposal_id = upgrade_mgr.propose_upgrade(
    &proposer,
    &UpgradeType::ContractUpgrade,
    &target_contract,
    &new_wasm_hash,
    &migration_data,
    &description,
);

// Collect approvals
upgrade_mgr.approve_upgrade(&proposal_id, &approver1);
upgrade_mgr.approve_upgrade(&proposal_id, &approver2);
upgrade_mgr.approve_upgrade(&proposal_id, &approver3);

// Execute
let result = upgrade_mgr.execute_upgrade(&proposal_id, &executor);
```

## Storage Migration

### Version-Specific Migrations

```rust
fn execute_migrations(env: &Env, from_version: u32, to_version: u32) {
    match (from_version, to_version) {
        (0, 1) => migrate_v0_to_v1(env),
        (1, 2) => migrate_v1_to_v2(env),
        (2, 3) => migrate_v2_to_v3(env),
        _ => {}
    }
}

fn migrate_v1_to_v2(env: &Env) {
    // Add new config field
    let old_config: ConfigV1 = get_config(env);
    let new_config = ConfigV2 {
        old_field: old_config.old_field,
        new_field: default_value(),
    };
    set_config(env, &new_config);
    
    // Extend TTL
    extend_storage_ttl(env);
}
```

## Testing

### Run Upgrade Tests

```bash
# Run all upgrade tests
cd contracts
cargo test upgrade

# Run specific test
cargo test test_upgrade_with_migration

# Run with output
cargo test upgrade -- --nocapture
```

### Test on Testnet

```bash
# 1. Deploy to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/contract.wasm \
  --network testnet

# 2. Initialize
soroban contract invoke \
  --id $CONTRACT_ID \
  --fn initialize \
  -- --admin $ADMIN

# 3. Test upgrade
./contracts/scripts/upgrade-contract.sh contract-name testnet

# 4. Verify
soroban contract invoke \
  --id $CONTRACT_ID \
  --fn get_version
```

## Scripts

### upgrade-contract.sh

Automated upgrade script with safety checks.

```bash
./contracts/scripts/upgrade-contract.sh <contract-name> <network> [--emergency]

# Examples
./contracts/scripts/upgrade-contract.sh credit-score testnet
./contracts/scripts/upgrade-contract.sh fraud-detect mainnet
./contracts/scripts/upgrade-contract.sh credit-score testnet --emergency
```

Features:
- Builds and optimizes WASM
- Uploads to network
- Creates backup
- Executes upgrade
- Verifies success
- Logs history

### rollback-contract.sh

Automated rollback script.

```bash
./contracts/scripts/rollback-contract.sh <contract-name> <network>

# Examples
./contracts/scripts/rollback-contract.sh credit-score testnet
./contracts/scripts/rollback-contract.sh fraud-detect mainnet
```

Features:
- Attempts automatic rollback
- Falls back to manual process
- Shows upgrade history
- Provides step-by-step instructions

## Best Practices

### 1. Always Test on Testnet First

```bash
# Deploy to testnet
soroban contract deploy --wasm contract.wasm --network testnet

# Test thoroughly
# ... run tests ...

# Only then deploy to mainnet
soroban contract deploy --wasm contract.wasm --network mainnet
```

### 2. Use Semantic Versioning

```rust
const MAJOR_VERSION: u32 = 1;
const MINOR_VERSION: u32 = 2;
const PATCH_VERSION: u32 = 3;

pub fn get_version(env: &Env) -> (u32, u32, u32) {
    (MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION)
}
```

### 3. Maintain Upgrade History

```rust
#[contracttype]
pub struct UpgradeRecord {
    pub from_version: u32,
    pub to_version: u32,
    pub wasm_hash: BytesN<32>,
    pub timestamp: u64,
    pub executor: Address,
    pub notes: String,
}

fn record_upgrade(env: &Env, record: UpgradeRecord) {
    let mut history = get_history(env);
    history.push_back(record);
    set_history(env, &history);
}
```

### 4. Implement Rollback Support

```rust
fn store_rollback_hash(env: &Env, current_hash: &BytesN<32>) {
    env.storage().persistent().set(&symbol_short!("rollback"), current_hash);
    env.storage().persistent().extend_ttl(&symbol_short!("rollback"), MONTH_LEDGERS, MONTH_LEDGERS);
}
```

### 5. Extend Storage TTL

```rust
fn extend_storage_ttl(env: &Env) {
    const YEAR_LEDGERS: u32 = 6_307_200;
    
    let keys = vec![
        symbol_short!("config"),
        symbol_short!("admin"),
        symbol_short!("data"),
    ];
    
    for key in keys {
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(&key, YEAR_LEDGERS, YEAR_LEDGERS);
        }
    }
}
```

## Troubleshooting

### Upgrade Failed

```bash
# Check contract status
soroban contract invoke --id $CONTRACT_ID --fn get_version

# Check upgrade history
soroban contract invoke --id $CONTRACT_ID --fn get_upgrade_history

# Attempt rollback
./contracts/scripts/rollback-contract.sh contract-name network
```

### Storage Migration Issues

```bash
# Verify storage integrity
soroban contract invoke --id $CONTRACT_ID --fn verify_storage

# Check specific keys
soroban contract invoke --id $CONTRACT_ID --fn get_config
```

### Version Mismatch

```bash
# Get current version
soroban contract invoke --id $CONTRACT_ID --fn get_version

# Compare with expected
echo "Expected: 2, Actual: $VERSION"

# If mismatch, investigate upgrade history
soroban contract invoke --id $CONTRACT_ID --fn get_upgrade_history
```

## Security Considerations

1. **Admin Authorization** - Always verify admin before upgrades
2. **Multi-Sig Governance** - Use multiple approvers for mainnet
3. **Testnet Testing** - Thoroughly test before mainnet deployment
4. **Rollback Plan** - Always have a rollback strategy
5. **Monitoring** - Monitor contract behavior post-upgrade
6. **Audit** - Security audit for major upgrades

## Resources

- [Upgrade Guide](./docs/upgrade-guide.md) - Comprehensive upgrade documentation
- [Proposal Template](./docs/upgrade-proposal-template.md) - Template for upgrade proposals
- [Soroban Docs](https://soroban.stellar.org/docs) - Official Soroban documentation
- [Test Suite](./tests/upgrade.test.rs) - Upgrade test examples

## Support

For questions or issues:
- Open an issue on GitHub
- Join our Discord community
- Email: support@example.com

## License

[Your License]
