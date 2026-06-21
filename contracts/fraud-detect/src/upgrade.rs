use soroban_sdk::{
    contracterror, contracttype, Address, BytesN, Env, String, Vec, panic_with_error, symbol_short,
};

#[contracttype]
#[derive(Clone)]
enum UpgradeKey {
    Version,
    UpgradeHistory,
    RollbackHash,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum UpgradeError {
    NotAdmin = 1,
    InvalidVersion = 2,
    MigrationFailed = 3,
    RollbackNotAvailable = 4,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct UpgradeRecord {
    pub from_version: u32,
    pub to_version: u32,
    pub wasm_hash: BytesN<32>,
    pub timestamp: u64,
    pub executor: Address,
    pub migration_notes: String,
}

const CURRENT_VERSION: u32 = 1u32;
const YEAR_LEDGERS: u32 = 6_307_200;
const MONTH_LEDGERS: u32 = 525_600;

/// Initialize upgrade system
pub fn init_upgrade_system(env: &Env) {
    if !env.storage().instance().has(&UpgradeKey::Version) {
        env.storage()
            .instance()
            .set(&UpgradeKey::Version, &CURRENT_VERSION);

        let history: Vec<UpgradeRecord> = Vec::new(env);
        env.storage()
            .persistent()
            .set(&UpgradeKey::UpgradeHistory, &history);
    }
}

/// Perform upgrade with migration
pub fn perform_upgrade(
    env: &Env,
    admin: &Address,
    new_wasm_hash: BytesN<32>,
    migration_notes: String,
) {
    // Verify admin (caller should have already checked)
    let old_version: u32 = env
        .storage()
        .instance()
        .get(&UpgradeKey::Version)
        .unwrap_or(0);

    // Store current hash for rollback
    store_rollback_hash(env, &new_wasm_hash);

    // Execute version-specific migrations
    execute_migrations(env, old_version, old_version + 1);

    // Perform the WASM upgrade
    env.deployer().update_current_contract_wasm(new_wasm_hash.clone());

    // Update version
    let new_version = old_version + 1;
    env.storage()
        .instance()
        .set(&UpgradeKey::Version, &new_version);

    // Record upgrade
    let record = UpgradeRecord {
        from_version: old_version,
        to_version: new_version,
        wasm_hash: new_wasm_hash.clone(),
        timestamp: env.ledger().timestamp(),
        executor: admin.clone(),
        migration_notes,
    };

    let mut history: Vec<UpgradeRecord> = env
        .storage()
        .persistent()
        .get(&UpgradeKey::UpgradeHistory)
        .unwrap_or(Vec::new(env));

    history.push_back(record);
    env.storage()
        .persistent()
        .set(&UpgradeKey::UpgradeHistory, &history);

    // Emit upgrade event
    env.events().publish(
        (symbol_short!("upgraded"),),
        (old_version, new_version, new_wasm_hash),
    );
}

/// Rollback to previous version
pub fn rollback_upgrade(env: &Env, admin: &Address) {
    let rollback_hash: Option<BytesN<32>> = env
        .storage()
        .persistent()
        .get(&UpgradeKey::RollbackHash);

    if rollback_hash.is_none() {
        panic_with_error!(env, UpgradeError::RollbackNotAvailable);
    }

    let hash = rollback_hash.unwrap();
    let current_version: u32 = env
        .storage()
        .instance()
        .get(&UpgradeKey::Version)
        .unwrap_or(1);

    // Perform rollback
    env.deployer().update_current_contract_wasm(hash.clone());

    // Decrement version
    let rolled_back_version = current_version.saturating_sub(1);
    env.storage()
        .instance()
        .set(&UpgradeKey::Version, &rolled_back_version);

    // Emit rollback event
    env.events().publish(
        (symbol_short!("rollback"),),
        (current_version, rolled_back_version, admin.clone()),
    );
}

/// Get upgrade history
pub fn get_upgrade_history(env: &Env) -> Vec<UpgradeRecord> {
    env.storage()
        .persistent()
        .get(&UpgradeKey::UpgradeHistory)
        .unwrap_or(Vec::new(env))
}

/// Get current version
pub fn get_version(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&UpgradeKey::Version)
        .unwrap_or(0)
}

// ========== INTERNAL MIGRATION HELPERS ==========

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

fn migrate_v0_to_v1(env: &Env) {
    // Initial migration: Extend TTL for critical data
    extend_storage_ttl(env);
}

fn migrate_v1_to_v2(env: &Env) {
    // Example: Update config structure
    extend_storage_ttl(env);
    
    // Could add new default values here
    // e.g., new risk thresholds, pattern detection parameters
}

fn migrate_v2_to_v3(env: &Env) {
    // Example: Migrate transaction history format
    extend_storage_ttl(env);
}

fn extend_storage_ttl(env: &Env) {
    // Extend TTL for config
    let config_key = symbol_short!("config");
    if env.storage().persistent().has(&config_key) {
        env.storage()
            .persistent()
            .extend_ttl(&config_key, YEAR_LEDGERS, YEAR_LEDGERS);
    }

    // Extend TTL for blacklist/whitelist
    let blacklist_key = symbol_short!("blklist");
    if env.storage().persistent().has(&blacklist_key) {
        env.storage()
            .persistent()
            .extend_ttl(&blacklist_key, YEAR_LEDGERS, YEAR_LEDGERS);
    }

    let whitelist_key = symbol_short!("whtlist");
    if env.storage().persistent().has(&whitelist_key) {
        env.storage()
            .persistent()
            .extend_ttl(&whitelist_key, YEAR_LEDGERS, YEAR_LEDGERS);
    }
}

fn store_rollback_hash(env: &Env, current_hash: &BytesN<32>) {
    env.storage()
        .persistent()
        .set(&UpgradeKey::RollbackHash, current_hash);

    env.storage()
        .persistent()
        .extend_ttl(&UpgradeKey::RollbackHash, MONTH_LEDGERS, MONTH_LEDGERS);
}
