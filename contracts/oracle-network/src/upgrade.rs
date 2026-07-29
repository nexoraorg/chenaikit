use soroban_sdk::{Env, BytesN, Symbol, Vec};

/// Storage keys for upgrade management
const VERSION_KEY: Symbol = Symbol::short("version");
const UPGRADE_HISTORY_KEY: Symbol = Symbol::short("up_hist");

/// Current contract version
const CURRENT_VERSION: u32 = 1;

/// Upgrade record for history tracking
#[derive(Clone)]
pub struct UpgradeRecord {
    pub version: u32,
    pub wasm_hash: BytesN<32>,
    pub timestamp: u64,
    pub migration_notes: soroban_sdk::String,
}

/// Initialize version tracking
pub fn init_version(env: &Env) {
    env.storage().instance().set(&VERSION_KEY, &CURRENT_VERSION);
}

/// Get current version
pub fn get_version(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&VERSION_KEY)
        .unwrap_or(CURRENT_VERSION)
}

/// Perform contract upgrade
pub fn upgrade(env: &Env, admin: soroban_sdk::Address, new_wasm_hash: BytesN<32>) {
    crate::access_control::require_admin(env, &admin);
    
    let current_version = get_version(env);
    let new_version = current_version + 1;
    
    // Record upgrade in history
    let record = UpgradeRecord {
        version: new_version,
        wasm_hash: new_wasm_hash.clone(),
        timestamp: env.ledger().timestamp(),
        migration_notes: soroban_sdk::String::from_str(env, "Standard upgrade"),
    };
    
    let mut history = get_upgrade_history(env);
    history.push_back(record);
    env.storage().instance().set(&UPGRADE_HISTORY_KEY, &history);
    
    // Update version
    env.storage().instance().set(&VERSION_KEY, &new_version);
    
    // Execute upgrade
    env.deployer()
        .update_current_contract_wasm(new_wasm_hash);
}

/// Upgrade with migration notes
pub fn upgrade_with_migration(
    env: &Env,
    admin: soroban_sdk::Address,
    new_wasm_hash: BytesN<32>,
    migration_notes: soroban_sdk::String,
) {
    crate::access_control::require_admin(env, &admin);
    
    let current_version = get_version(env);
    let new_version = current_version + 1;
    
    let record = UpgradeRecord {
        version: new_version,
        wasm_hash: new_wasm_hash.clone(),
        timestamp: env.ledger().timestamp(),
        migration_notes,
    };
    
    let mut history = get_upgrade_history(env);
    history.push_back(record);
    env.storage().instance().set(&UPGRADE_HISTORY_KEY, &history);
    
    env.storage().instance().set(&VERSION_KEY, &new_version);
    env.deployer()
        .update_current_contract_wasm(new_wasm_hash);
}

/// Get upgrade history
pub fn get_upgrade_history(env: &Env) -> Vec<UpgradeRecord> {
    env.storage()
        .instance()
        .get(&UPGRADE_HISTORY_KEY)
        .unwrap_or_else(|| Vec::new(env))
}

/// Rollback to previous version (emergency only)
pub fn rollback(env: &Env, admin: soroban_sdk::Address) {
    crate::access_control::require_admin(env, &admin);
    
    let mut history = get_upgrade_history(env);
    if history.is_empty() {
        panic!("no upgrade history to rollback from");
    }
    
    let last_upgrade = history.pop().expect("history not empty");
    let previous_version = last_upgrade.version - 1;
    
    env.storage().instance().set(&VERSION_KEY, &previous_version);
    env.storage().instance().set(&UPGRADE_HISTORY_KEY, &history);
    
    // Note: Actual WASM rollback requires external governance approval
    // This function only updates version tracking
}
