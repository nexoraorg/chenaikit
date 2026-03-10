use soroban_sdk::{contracterror, contracttype, Address, BytesN, Env, symbol_short, panic_with_error, String, Vec};

#[contracttype]
#[derive(Clone)]
enum UpgradeKey {
    Admin,
    Version,
    UpgradeHistory,
    RollbackHash,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAdmin = 1,
    AlreadyUpgraded = 2,
    InvalidVersion = 3,
    MigrationFailed = 4,
    RollbackNotAvailable = 5,
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
const YEAR_LEDGERS: u32 = 6_307_200;  // ~1 year
const MONTH_LEDGERS: u32 = 525_600;   // ~1 month

pub fn init_admin(env: &Env, admin: &Address) {
    if env.storage().instance().has(&UpgradeKey::Admin) {
        return;  // Idempotent
    }
    env.storage().instance().set(&UpgradeKey::Admin, admin);
    env.storage().instance().set(&UpgradeKey::Version, &CURRENT_VERSION);
    
    // Initialize upgrade history
    let history: Vec<UpgradeRecord> = Vec::new(env);
    env.storage().persistent().set(&UpgradeKey::UpgradeHistory, &history);
}

/// Main upgrade function with migration support
pub fn upgrade(env: &Env, admin: Address, new_wasm_hash: BytesN<32>) {
    admin.require_auth();

    let admin_stored: Address = env.storage().instance().get(&UpgradeKey::Admin).unwrap();
    if admin != admin_stored {
        panic_with_error!(env, Error::NotAdmin);
    }

    let old_version: u32 = env.storage().instance().get(&UpgradeKey::Version).unwrap_or(0);
    
    // Store current WASM hash for potential rollback
    store_rollback_hash(env, &new_wasm_hash);

    // Execute version-specific migrations
    execute_migrations(env, old_version, old_version + 1);

    // Perform the WASM upgrade
    env.deployer().update_current_contract_wasm(new_wasm_hash.clone());

    // Update version
    let new_version = old_version + 1;
    env.storage().instance().set(&UpgradeKey::Version, &new_version);

    // Record upgrade in history
    record_upgrade(env, old_version, new_version, new_wasm_hash, admin);

    // Emit event
    crate::events::emit_upgraded(env, &new_version);
}

/// Upgrade with custom migration data
pub fn upgrade_with_migration(
    env: &Env,
    admin: Address,
    new_wasm_hash: BytesN<32>,
    migration_notes: String,
) {
    admin.require_auth();

    let admin_stored: Address = env.storage().instance().get(&UpgradeKey::Admin).unwrap();
    if admin != admin_stored {
        panic_with_error!(env, Error::NotAdmin);
    }

    let old_version: u32 = env.storage().instance().get(&UpgradeKey::Version).unwrap_or(0);
    
    // Store rollback hash
    store_rollback_hash(env, &new_wasm_hash);

    // Execute migrations
    execute_migrations(env, old_version, old_version + 1);

    // Perform upgrade
    env.deployer().update_current_contract_wasm(new_wasm_hash.clone());

    let new_version = old_version + 1;
    env.storage().instance().set(&UpgradeKey::Version, &new_version);

    // Record with custom notes
    let record = UpgradeRecord {
        from_version: old_version,
        to_version: new_version,
        wasm_hash: new_wasm_hash,
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
    env.storage().persistent().set(&UpgradeKey::UpgradeHistory, &history);

    crate::events::emit_upgraded(env, &new_version);
}

/// Rollback to previous version (emergency only)
pub fn rollback(env: &Env, admin: Address) {
    admin.require_auth();

    let admin_stored: Address = env.storage().instance().get(&UpgradeKey::Admin).unwrap();
    if admin != admin_stored {
        panic_with_error!(env, Error::NotAdmin);
    }

    // Get rollback hash
    let rollback_hash: Option<BytesN<32>> = env
        .storage()
        .persistent()
        .get(&UpgradeKey::RollbackHash);

    if rollback_hash.is_none() {
        panic_with_error!(env, Error::RollbackNotAvailable);
    }

    let hash = rollback_hash.unwrap();
    let current_version: u32 = env.storage().instance().get(&UpgradeKey::Version).unwrap_or(1);

    // Perform rollback
    env.deployer().update_current_contract_wasm(hash.clone());

    // Decrement version
    let rolled_back_version = current_version.saturating_sub(1);
    env.storage().instance().set(&UpgradeKey::Version, &rolled_back_version);

    // Emit rollback event
    env.events().publish(
        (symbol_short!("rollback"),),
        (current_version, rolled_back_version, admin),
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
    // Execute version-specific migrations
    match (from_version, to_version) {
        (0, 1) => migrate_v0_to_v1(env),
        (1, 2) => migrate_v1_to_v2(env),
        (2, 3) => migrate_v2_to_v3(env),
        _ => {
            // No migration needed or unsupported path
        }
    }
}

fn migrate_v0_to_v1(env: &Env) {
    // Initial migration: Extend TTL for all scores
    bump_all_scores(env);
}

fn migrate_v1_to_v2(env: &Env) {
    // Example: Add new default factors
    let factors_key = symbol_short!("def_fact");
    let new_factors = String::from_str(env, "base:100,adjustment:0,risk:1");
    env.storage().instance().set(&factors_key, &new_factors);
    
    // Extend TTL for critical data
    bump_all_scores(env);
}

fn migrate_v2_to_v3(env: &Env) {
    // Example: Migrate to new storage structure
    // This would contain actual migration logic
    bump_all_scores(env);
}

fn bump_all_scores(env: &Env) {
    // Extend TTL for all persistent score data
    let score_key = symbol_short!("score");
    if env.storage().persistent().has(&score_key) {
        env.storage().persistent().extend_ttl(&score_key, YEAR_LEDGERS, YEAR_LEDGERS);
    }
}

fn store_rollback_hash(env: &Env, current_hash: &BytesN<32>) {
    // Store current hash for potential rollback
    env.storage()
        .persistent()
        .set(&UpgradeKey::RollbackHash, current_hash);
    
    // Set TTL for rollback data (1 month)
    env.storage()
        .persistent()
        .extend_ttl(&UpgradeKey::RollbackHash, MONTH_LEDGERS, MONTH_LEDGERS);
}

fn record_upgrade(
    env: &Env,
    from_version: u32,
    to_version: u32,
    wasm_hash: BytesN<32>,
    executor: Address,
) {
    let record = UpgradeRecord {
        from_version,
        to_version,
        wasm_hash,
        timestamp: env.ledger().timestamp(),
        executor,
        migration_notes: String::from_str(env, "Standard upgrade"),
    };

    let mut history: Vec<UpgradeRecord> = env
        .storage()
        .persistent()
        .get(&UpgradeKey::UpgradeHistory)
        .unwrap_or(Vec::new(env));
    
    history.push_back(record);
    env.storage().persistent().set(&UpgradeKey::UpgradeHistory, &history);
    
    // Extend TTL for history
    env.storage()
        .persistent()
        .extend_ttl(&UpgradeKey::UpgradeHistory, YEAR_LEDGERS, YEAR_LEDGERS);
}