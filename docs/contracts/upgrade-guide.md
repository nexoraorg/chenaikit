# Smart Contract Upgrade Guide

## Overview

This guide covers comprehensive upgrade strategies for Soroban smart contracts, including governance-based upgrades, storage migrations, rollback procedures, and best practices.

## Table of Contents

1. [Upgrade Architecture](#upgrade-architecture)
2. [Upgrade Types](#upgrade-types)
3. [Governance-Based Upgrades](#governance-based-upgrades)
4. [Storage Migration](#storage-migration)
5. [Testing Upgrades](#testing-upgrades)
6. [Rollback Procedures](#rollback-procedures)
7. [Best Practices](#best-practices)
8. [Emergency Procedures](#emergency-procedures)

---

## Upgrade Architecture

### Soroban Upgrade Mechanism

Soroban contracts use WASM hash-based upgrades:

```rust
env.deployer().update_current_contract_wasm(new_wasm_hash);
```

**Key Concepts:**
- Contracts are upgraded by updating the WASM bytecode hash
- Storage persists across upgrades
- Contract address remains the same
- Requires admin authorization

### Upgrade Components

Our upgrade system consists of:

1. **Contract-Level Upgrade Functions** - Individual contract upgrade logic
2. **Governance Upgrade Manager** - Multi-sig approval system
3. **Migration Helpers** - Version-specific data migrations
4. **Rollback Support** - Emergency reversion capability
5. **Upgrade History** - Audit trail of all upgrades

---

## Upgrade Types

### 1. Standard Contract Upgrade

Regular upgrade with new features or bug fixes.

```rust
// In your contract
pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
    admin.require_auth();
    
    // Verify admin
    let stored_admin: Address = env.storage()
        .instance()
        .get(&symbol_short!("admin"))
        .unwrap();
    
    if admin != stored_admin {
        panic!("not authorized");
    }
    
    // Perform upgrade
    env.deployer().update_current_contract_wasm(new_wasm_hash);
}
```

### 2. Upgrade with Storage Migration

Upgrade that requires data structure changes.

```rust
pub fn upgrade_with_migration(
    env: Env,
    admin: Address,
    new_wasm_hash: BytesN<32>,
    migration_notes: String,
) {
    admin.require_auth();
    
    let old_version = get_version(&env);
    
    // Execute version-specific migrations
    execute_migrations(&env, old_version, old_version + 1);
    
    // Perform upgrade
    env.deployer().update_current_contract_wasm(new_wasm_hash);
    
    // Update version
    set_version(&env, old_version + 1);
}
```

### 3. Emergency Upgrade

Fast-track upgrade for critical security issues.

```rust
pub fn emergency_upgrade(
    env: Env,
    admin: Address,
    new_wasm_hash: BytesN<32>,
) {
    admin.require_auth();
    
    // Minimal checks for speed
    verify_admin(&env, &admin);
    
    // Immediate upgrade
    env.deployer().update_current_contract_wasm(new_wasm_hash);
    
    // Emit emergency event
    env.events().publish(
        (symbol_short!("emerg_upg"),),
        (admin, new_wasm_hash)
    );
}
```

---

## Governance-Based Upgrades

### Using the Upgrade Manager

The `UpgradeManager` contract provides multi-sig governance for upgrades.

#### Step 1: Initialize Upgrade Manager

```rust
use upgrade_manager::UpgradeManagerClient;

let upgrade_mgr = UpgradeManagerClient::new(&env, &upgrade_manager_id);

// Initialize with 3 required approvals, 7-day timeout
upgrade_mgr.initialize(&admin, &3, &604800);
```

#### Step 2: Add Authorized Upgraders

```rust
// Add addresses that can propose and approve upgrades
upgrade_mgr.add_authorized(&admin, &upgrader1);
upgrade_mgr.add_authorized(&admin, &upgrader2);
upgrade_mgr.add_authorized(&admin, &upgrader3);
```

#### Step 3: Propose Upgrade

```rust
let wasm_hash = BytesN::from_array(&env, &[/* 32 bytes */]);
let migration_data = Vec::new(&env);
let description = String::from_str(&env, "Upgrade to v2.0 - Add new features");

let proposal_id = upgrade_mgr.propose_upgrade(
    &proposer,
    &UpgradeType::ContractUpgrade,
    &target_contract,
    &wasm_hash,
    &migration_data,
    &description,
);
```

#### Step 4: Approve Upgrade

```rust
// Each authorized address approves
upgrade_mgr.approve_upgrade(&proposal_id, &approver1);
upgrade_mgr.approve_upgrade(&proposal_id, &approver2);
upgrade_mgr.approve_upgrade(&proposal_id, &approver3);
```

#### Step 5: Execute Upgrade

```rust
// Once enough approvals, execute
let result = upgrade_mgr.execute_upgrade(&proposal_id, &executor);

assert!(result.success);
println!("Upgraded from v{} to v{}", result.old_version, result.new_version);
```

### Upgrade Proposal Lifecycle

```
Proposed → Approvals Collected → Executed
   ↓              ↓                  ↓
Cancelled    Expired           Success/Failure
```

---

## Storage Migration

### Version-Specific Migrations

Implement migrations for each version transition:

```rust
fn execute_migrations(env: &Env, from_version: u32, to_version: u32) {
    match (from_version, to_version) {
        (0, 1) => migrate_v0_to_v1(env),
        (1, 2) => migrate_v1_to_v2(env),
        (2, 3) => migrate_v2_to_v3(env),
        _ => {
            // No migration needed
        }
    }
}

fn migrate_v1_to_v2(env: &Env) {
    // Example: Add new config field
    let old_config: OldConfig = env.storage()
        .persistent()
        .get(&symbol_short!("config"))
        .unwrap();
    
    let new_config = NewConfig {
        old_field: old_config.old_field,
        new_field: default_value(), // Add new field
    };
    
    env.storage()
        .persistent()
        .set(&symbol_short!("config"), &new_config);
    
    // Extend TTL for migrated data
    env.storage()
        .persistent()
        .extend_ttl(&symbol_short!("config"), YEAR_LEDGERS, YEAR_LEDGERS);
}
```

### Migration Patterns

#### 1. Adding New Fields

```rust
// Old structure
#[contracttype]
struct ConfigV1 {
    threshold: u32,
}

// New structure
#[contracttype]
struct ConfigV2 {
    threshold: u32,
    new_feature: bool, // Added field
}

// Migration
fn migrate_config(env: &Env) {
    let old: ConfigV1 = get_config_v1(env);
    let new = ConfigV2 {
        threshold: old.threshold,
        new_feature: false, // Default value
    };
    set_config_v2(env, &new);
}
```

#### 2. Restructuring Data

```rust
// Migrate from flat storage to nested
fn migrate_to_nested(env: &Env) {
    // Read old flat data
    let value1: u32 = env.storage().persistent().get(&symbol_short!("val1")).unwrap();
    let value2: u32 = env.storage().persistent().get(&symbol_short!("val2")).unwrap();
    
    // Create new nested structure
    let nested = NestedData {
        values: vec![value1, value2],
    };
    
    // Store in new format
    env.storage().persistent().set(&symbol_short!("nested"), &nested);
    
    // Clean up old keys
    env.storage().persistent().remove(&symbol_short!("val1"));
    env.storage().persistent().remove(&symbol_short!("val2"));
}
```

#### 3. Extending TTL

```rust
fn extend_all_storage_ttl(env: &Env) {
    const YEAR_LEDGERS: u32 = 6_307_200;
    
    // List all keys that need TTL extension
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

---

## Testing Upgrades

### Test Environment Setup

```rust
#[cfg(test)]
mod upgrade_tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_upgrade_flow() {
        let env = Env::default();
        
        // Deploy v1
        let contract_v1 = env.register_contract(None, ContractV1);
        let client_v1 = ContractV1Client::new(&env, &contract_v1);
        
        let admin = Address::generate(&env);
        env.mock_all_auths();
        
        // Initialize v1
        client_v1.initialize(&admin);
        
        // Use v1 functionality
        client_v1.some_function(&param);
        
        // Build and get v2 WASM hash
        let wasm_v2 = include_bytes!("../target/wasm32-unknown-unknown/release/contract_v2.wasm");
        let wasm_hash_v2 = env.deployer().upload_contract_wasm(wasm_v2);
        
        // Perform upgrade
        client_v1.upgrade(&admin, &wasm_hash_v2);
        
        // Test v2 functionality
        let client_v2 = ContractV2Client::new(&env, &contract_v1); // Same address
        client_v2.new_v2_function(&param);
        
        // Verify storage persisted
        assert_eq!(client_v2.get_data(), expected_data);
    }
}
```

### Integration Testing Script

Create `contracts/tests/upgrade.test.rs`:

```rust
#[cfg(test)]
mod integration_tests {
    use soroban_sdk::{Env, Address, BytesN};
    
    #[test]
    fn test_full_upgrade_with_governance() {
        let env = Env::default();
        
        // Deploy all contracts
        let credit_score = deploy_credit_score(&env);
        let upgrade_mgr = deploy_upgrade_manager(&env);
        
        // Setup governance
        let admin = Address::generate(&env);
        let approver1 = Address::generate(&env);
        let approver2 = Address::generate(&env);
        
        env.mock_all_auths();
        
        // Initialize
        upgrade_mgr.initialize(&admin, &2, &604800);
        upgrade_mgr.add_authorized(&admin, &approver1);
        upgrade_mgr.add_authorized(&admin, &approver2);
        
        // Build new version
        let new_wasm = build_contract_v2();
        let wasm_hash = env.deployer().upload_contract_wasm(&new_wasm);
        
        // Propose upgrade
        let proposal_id = upgrade_mgr.propose_upgrade(
            &admin,
            &UpgradeType::ContractUpgrade,
            &credit_score,
            &wasm_hash,
            &Vec::new(&env),
            &String::from_str(&env, "Upgrade to v2"),
        );
        
        // Approve
        upgrade_mgr.approve_upgrade(&proposal_id, &approver1);
        upgrade_mgr.approve_upgrade(&proposal_id, &approver2);
        
        // Execute
        let result = upgrade_mgr.execute_upgrade(&proposal_id, &admin);
        
        assert!(result.success);
        assert_eq!(result.new_version, 2);
    }
}
```

---

## Rollback Procedures

### Automatic Rollback Support

Contracts store the previous WASM hash for emergency rollback:

```rust
pub fn rollback(env: Env, admin: Address) {
    admin.require_auth();
    verify_admin(&env, &admin);
    
    // Get stored rollback hash
    let rollback_hash: BytesN<32> = env.storage()
        .persistent()
        .get(&symbol_short!("rollback"))
        .expect("No rollback available");
    
    // Perform rollback
    env.deployer().update_current_contract_wasm(rollback_hash.clone());
    
    // Decrement version
    let current_version = get_version(&env);
    set_version(&env, current_version - 1);
    
    // Emit rollback event
    env.events().publish(
        (symbol_short!("rollback"),),
        (current_version, current_version - 1, admin)
    );
}
```

### Manual Rollback Process

If automatic rollback isn't available:

1. **Identify Previous Version**
   ```bash
   # Get upgrade history
   soroban contract invoke \
     --id $CONTRACT_ID \
     --fn get_upgrade_history
   ```

2. **Retrieve Previous WASM**
   ```bash
   # From your version control or build artifacts
   cd contracts/credit-score
   git checkout v1.0.0
   soroban contract build
   ```

3. **Upload Previous WASM**
   ```bash
   soroban contract install \
     --wasm target/wasm32-unknown-unknown/release/credit_score.wasm \
     --network testnet
   ```

4. **Execute Rollback Upgrade**
   ```bash
   soroban contract invoke \
     --id $CONTRACT_ID \
     --fn upgrade \
     -- \
     --admin $ADMIN_ADDRESS \
     --new_wasm_hash $PREVIOUS_WASM_HASH
   ```

---

## Best Practices

### 1. Version Management

```rust
// Always track versions
const CURRENT_VERSION: u32 = 2;

pub fn get_version(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&symbol_short!("version"))
        .unwrap_or(0)
}

pub fn set_version(env: &Env, version: u32) {
    env.storage()
        .instance()
        .set(&symbol_short!("version"), &version);
}
```

### 2. Upgrade History

```rust
// Maintain audit trail
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
    let mut history: Vec<UpgradeRecord> = get_history(env);
    history.push_back(record);
    env.storage().persistent().set(&symbol_short!("history"), &history);
}
```

### 3. Pre-Upgrade Validation

```rust
fn validate_upgrade(env: &Env, new_wasm_hash: &BytesN<32>) -> Result<(), Error> {
    // Check version compatibility
    let current_version = get_version(env);
    
    // Verify WASM hash format
    if new_wasm_hash.len() != 32 {
        return Err(Error::InvalidWasmHash);
    }
    
    // Check storage compatibility
    verify_storage_compatibility(env)?;
    
    Ok(())
}
```

### 4. Post-Upgrade Verification

```rust
fn verify_upgrade(env: &Env, expected_version: u32) {
    let actual_version = get_version(env);
    assert_eq!(actual_version, expected_version, "Version mismatch");
    
    // Verify critical data integrity
    verify_data_integrity(env);
    
    // Emit verification event
    env.events().publish(
        (symbol_short!("verified"),),
        (actual_version, env.ledger().timestamp())
    );
}
```

### 5. Testing Checklist

- [ ] Test upgrade on testnet first
- [ ] Verify storage migration works correctly
- [ ] Test rollback procedure
- [ ] Verify all contract functions work post-upgrade
- [ ] Check gas costs haven't increased significantly
- [ ] Validate event emissions
- [ ] Test with real-world data volumes
- [ ] Verify TTL extensions work
- [ ] Test concurrent operations during upgrade
- [ ] Document all changes in upgrade notes

---

## Emergency Procedures

### Critical Bug Response

1. **Immediate Actions**
   ```bash
   # Pause contract if pause functionality exists
   soroban contract invoke \
     --id $CONTRACT_ID \
     --fn pause \
     -- --admin $ADMIN
   ```

2. **Emergency Upgrade**
   ```bash
   # Use emergency upgrade path (bypasses normal governance)
   soroban contract invoke \
     --id $CONTRACT_ID \
     --fn emergency_upgrade \
     -- \
     --admin $ADMIN \
     --new_wasm_hash $FIXED_WASM_HASH
   ```

3. **Verify Fix**
   ```bash
   # Test the fix
   soroban contract invoke \
     --id $CONTRACT_ID \
     --fn test_function
   ```

4. **Resume Operations**
   ```bash
   # Unpause if paused
   soroban contract invoke \
     --id $CONTRACT_ID \
     --fn unpause \
     -- --admin $ADMIN
   ```

### Communication Template

```markdown
## Upgrade Notification

**Contract:** [Contract Name]
**Type:** [Standard/Emergency/Migration]
**Scheduled Time:** [UTC Timestamp]
**Expected Downtime:** [Duration]

### Changes
- [List of changes]

### Impact
- [User impact]
- [API changes]

### Rollback Plan
- [Rollback procedure if needed]

### Support
- [Contact information]
```

---

## Upgrade Workflow Diagram

```
┌─────────────────┐
│  Propose Upgrade │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│ Collect Approvals│
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Test on Testnet │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│ Execute Upgrade  │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│ Verify Success   │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│Success │ │ Rollback │
└────────┘ └──────────┘
```

---

## Additional Resources

- [Soroban Upgrade Documentation](https://soroban.stellar.org/docs/learn/upgrades)
- [WASM Hash Generation](https://soroban.stellar.org/docs/reference/wasm)
- [Storage Best Practices](https://soroban.stellar.org/docs/learn/storage)
- [Testing Guide](https://soroban.stellar.org/docs/learn/testing)

---

## Support

For upgrade assistance:
- GitHub Issues: [Your Repo Issues]
- Discord: [Your Discord]
- Email: [Support Email]
