#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, BytesN, String, symbol_short, Vec};

mod access_control;
mod events;
mod storage;
mod upgrade;
mod oracle_integration;

use crate::storage::{get_score, set_score, has_score};
use crate::events::emit_score_updated;
use crate::upgrade::{init_admin, upgrade as perform_upgrade};
use crate::oracle_integration::{require_oracle_caller, set_oracle_contract as set_oracle_addr, get_oracle_contract, is_oracle_gated_enabled, set_oracle_gated_enabled};

#[contract]
pub struct CreditScoreContract;

#[contractimpl]
impl CreditScoreContract {
    /// Initialize the credit score contract with an admin
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        init_admin(&env, &admin);
        // Set initial factors or other instance data if needed
        let factors_key = symbol_short!("def_fact");
        let default_factors = String::from_str(&env, "base:100,adjustment:0");
        env.storage().instance().set(&factors_key, &default_factors);
        // Initialize oracle integration (oracle contract set later via admin)
        set_oracle_gated_enabled(&env, false);
    }

    /// Set the oracle contract address (admin only)
    pub fn set_oracle_contract(env: Env, admin: Address, oracle_contract: Address) {
        admin.require_auth();
        crate::access_control::require_admin(&env, &admin);
        set_oracle_addr(&env, &oracle_contract);
    }

    /// Enable or disable oracle-gated mode (admin only)
    pub fn set_oracle_gated(env: Env, admin: Address, enabled: bool) {
        admin.require_auth();
        crate::access_control::require_admin(&env, &admin);
        set_oracle_gated_enabled(&env, enabled);
    }

    /// Update score from oracle (only callable by oracle contract when gated)
    pub fn update_score_from_oracle(env: Env, caller: Address, account: Address, score: i128, model_hash: BytesN<32>) {
        caller.require_auth();
        require_oracle_caller(&env, &caller);
        oracle_integration::update_score_from_oracle(&env, &account, score, model_hash);
    }

    /// Calculate credit score for an account, potentially using cross-contract oracle
    pub fn calculate_score(_env: Env, account: Address) -> u32 {
        account.require_auth();
        let base_score: u32 = 600;  // Default base
        // TODO: Implement cross-contract oracle adjustment (uncomment when oracle.wasm ready)
        // mod oracle {
        //     soroban_sdk::contractimport!(file = "../oracle/target/wasm32-unknown-unknown/release/oracle.wasm");
        // }
        // use oracle::Client as OracleClient;
        // let oracle_id = String::from_str(&env, "oracle_contract_id_here");
        // let oracle_contract = Address::from_string(&env, &oracle_id);
        // let oracle_client = OracleClient::new(&env, &oracle_contract);
        // if let Ok(adjustment) = oracle_client.get_adjustment(&account) {
        //     let adjusted = ((base_score as i128) + adjustment).max(0) as u32;
        //     let score_i128 = adjusted as i128;
        //     set_score(&env, &account, &score_i128);
        //     emit_score_updated(&env, &account, &score_i128);
        //     return adjusted;
        // }
        // Fallback
        base_score
    }

    /// Get credit score for an account
    pub fn get_score(env: Env, account: Address) -> u32 {
        let score = get_score(&env, &account);
        if score < 0 { 0u32 } else { score.min(i128::from(u32::MAX)) as u32 }
    }

    /// Update credit score factors (deprecated when oracle-gated mode is enabled)
    pub fn update_factors(env: Env, account: Address, factors_str: String) {
        account.require_auth();  // Auth as account owner
        
        // Check if oracle-gated mode is enabled
        if is_oracle_gated_enabled(&env) {
            panic!("direct score updates are disabled when oracle-gated mode is enabled; use oracle network");
        }

        let mut score = get_score(&env, &account);
        // Simplified: Direct string equality
        let boost_str = String::from_str(&env, "boost");
        let penalty_str = String::from_str(&env, "penalty");
        if factors_str == boost_str {
            score = score.checked_add(50).unwrap_or(score);
        } else if factors_str == penalty_str {
            score = score.checked_sub(50).unwrap_or(score).max(0i128);
        }
        set_score(&env, &account, &score);
        emit_score_updated(&env, &account, &score);
    }

    /// Cross-contract adjustment (stubbed; extend with oracle import above)
    pub fn adjust_score_with_oracle(env: Env, user: Address, _oracle_contract: Address) {
        user.require_auth();

        // Stub: Simulate oracle adjustment (replace with real client call)
        let adjustment: i128 = 10;  // Mock

        let mut score = get_score(&env, &user);
        score = score.checked_add(adjustment).expect("score overflow");
        set_score(&env, &user, &score);
        emit_score_updated(&env, &user, &score);
    }

    /// Admin-only upgrade function (pass admin addr and auth)
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        perform_upgrade(&env, admin, new_wasm_hash);
    }

    /// Upgrade with custom migration notes
    pub fn upgrade_with_migration(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
        migration_notes: String,
    ) {
        upgrade::upgrade_with_migration(&env, admin, new_wasm_hash, migration_notes);
    }

    /// Rollback to previous version (emergency only)
    pub fn rollback(env: Env, admin: Address) {
        upgrade::rollback(&env, admin);
    }

    /// Get current contract version
    pub fn get_version(env: Env) -> u32 {
        upgrade::get_version(&env)
    }

    /// Get upgrade history
    pub fn get_upgrade_history(env: Env) -> Vec<upgrade::UpgradeRecord> {
        upgrade::get_upgrade_history(&env)
    }

    /// Check if account has a score
    pub fn has_score(env: Env, account: Address) -> bool {
        has_score(&env, &account)
    }

    /// Get oracle contract address
    pub fn get_oracle_contract(env: Env) -> Option<Address> {
        get_oracle_contract(&env)
    }

    /// Check if oracle-gated mode is enabled
    pub fn is_oracle_gated(env: Env) -> bool {
        is_oracle_gated_enabled(&env)
    }
}

#[cfg(test)]
mod test;