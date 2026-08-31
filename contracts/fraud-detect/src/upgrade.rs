//! Secure contract upgrade and migration mechanism with rollback capability.

use crate::errors::ContractError;
use crate::events::{emit_rollback_performed, emit_upgrade_performed};
use crate::types::UpgradeRecord;
use soroban_sdk::{symbol_short, Address, BytesN, Env, String, Symbol, Vec};

const VERSION_KEY: Symbol = symbol_short!("ver");
const UPGRADE_HIST_KEY: Symbol = symbol_short!("up_hist");
const ROLLBACK_HASH_KEY: Symbol = symbol_short!("rb_hash");
const MONTH_LEDGERS: u32 = 525_600;

/// Initializes the upgrade system tracking version 1.
pub fn init_upgrade_system(env: &Env) {
    if !env.storage().instance().has(&VERSION_KEY) {
        env.storage().instance().set(&VERSION_KEY, &1u32);
        let history: Vec<UpgradeRecord> = Vec::new(env);
        env.storage().persistent().set(&UPGRADE_HIST_KEY, &history);
    }
}

/// Executes a contract WASM upgrade with optional migration notes.
pub fn perform_upgrade(
    env: &Env,
    admin: &Address,
    new_wasm_hash: BytesN<32>,
    migration_notes: String,
) -> Result<(), ContractError> {
    let old_version: u32 = env.storage().instance().get(&VERSION_KEY).unwrap_or(1);

    // Save rollback hash
    env.storage()
        .persistent()
        .set(&ROLLBACK_HASH_KEY, &new_wasm_hash);
    env.storage()
        .persistent()
        .extend_ttl(&ROLLBACK_HASH_KEY, MONTH_LEDGERS, MONTH_LEDGERS);

    // Update WASM via deployer
    env.deployer()
        .update_current_contract_wasm(new_wasm_hash.clone());

    let new_version = old_version.saturating_add(1);
    env.storage().instance().set(&VERSION_KEY, &new_version);

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
        .get(&UPGRADE_HIST_KEY)
        .unwrap_or_else(|| Vec::new(env));

    history.push_back(record);
    env.storage().persistent().set(&UPGRADE_HIST_KEY, &history);

    emit_upgrade_performed(env, old_version, new_version, &new_wasm_hash, admin);
    Ok(())
}

/// Rolls back to a previously stored WASM hash.
pub fn rollback_upgrade(env: &Env, admin: &Address) -> Result<(), ContractError> {
    let rollback_hash: Option<BytesN<32>> = env.storage().persistent().get(&ROLLBACK_HASH_KEY);

    let hash = rollback_hash.ok_or(ContractError::RollbackNotAvailable)?;

    let current_version: u32 = env.storage().instance().get(&VERSION_KEY).unwrap_or(1);

    env.deployer().update_current_contract_wasm(hash);

    let rolled_back_version = current_version.saturating_sub(1);
    env.storage()
        .instance()
        .set(&VERSION_KEY, &rolled_back_version);

    emit_rollback_performed(env, current_version, rolled_back_version, admin);
    Ok(())
}

/// Retrieves the recorded history of upgrades.
pub fn get_upgrade_history(env: &Env) -> Vec<UpgradeRecord> {
    env.storage()
        .persistent()
        .get(&UPGRADE_HIST_KEY)
        .unwrap_or_else(|| Vec::new(env))
}

/// Retrieves the current contract version number.
pub fn get_version(env: &Env) -> u32 {
    env.storage().instance().get(&VERSION_KEY).unwrap_or(1)
}
