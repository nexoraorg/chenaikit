#![no_std]

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec, symbol_short};

mod access_control;
mod events;
mod storage;
mod upgrade;
mod node_registry;
mod commit_reveal;
mod aggregation;
mod slashing;
mod dispute;
mod model_version;

use crate::storage::{get_config, set_config};
use crate::access_control::{require_admin, require_governance};
use crate::upgrade::{init_admin, upgrade as perform_upgrade};

#[contract]
pub struct OracleNetworkContract;

#[contractimpl]
impl OracleNetworkContract {
    /// Initialize the oracle network contract with an admin and governance address
    pub fn initialize(env: Env, admin: Address, governance: Address) {
        admin.require_auth();
        init_admin(&env, &admin);
        
        // Set governance address
        let gov_key = symbol_short!("govern");
        env.storage().instance().set(&gov_key, &governance);
        
        // Initialize default configuration
        let config = Config {
            min_stake: 1_000_000, // 1M stroops minimum stake
            quorum_threshold: 5,  // 5-of-9 default
            max_nodes: 9,
            commit_duration_ledgers: 100,
            reveal_duration_ledgers: 100,
            dispute_window_ledgers: 500,
            slash_percentage: 10, // 10% slash
            variance_tolerance: 100, // Fixed-point tolerance
        };
        set_config(&env, &config);
    }

    /// Register a new oracle node with stake
    pub fn register_node(env: Env, node: Address, stake_amount: i128) {
        node.require_auth();
        node_registry::register_node(&env, &node, stake_amount);
    }

    /// Unregister a node and return stake
    pub fn unregister_node(env: Env, node: Address) {
        node.require_auth();
        node_registry::unregister_node(&env, &node);
    }

    /// Submit commit hash (hash(score, salt))
    pub fn submit_commit(env: Env, node: Address, commit_hash: BytesN<32>, model_hash: BytesN<32>) {
        node.require_auth();
        commit_reveal::submit_commit(&env, &node, commit_hash, model_hash);
    }

    /// Reveal the actual score and salt
    pub fn reveal(env: Env, node: Address, score: i128, salt: BytesN<32>) {
        node.require_auth();
        commit_reveal::reveal(&env, &node, score, salt);
    }

    /// Finalize aggregation after reveal phase
    pub fn finalize_aggregation(env: Env, request_id: u64) {
        aggregation::finalize(&env, request_id);
    }

    /// File a dispute against a finalized score
    pub fn file_dispute(env: Env, disputer: Address, request_id: u64, evidence: String) {
        disputer.require_auth();
        dispute::file_dispute(&env, &disputer, request_id, evidence);
    }

    /// Execute slashing for nodes that deviated from aggregate
    pub fn execute_slashing(env: Env, request_id: u64) {
        slashing::execute_slashing(&env, request_id);
    }

    /// Governance: Approve a model version
    pub fn approve_model_version(env: Env, governance: Address, model_hash: BytesN<32>, metadata: String) {
        governance.require_auth();
        model_version::approve_model_version(&env, model_hash, metadata);
    }

    /// Governance: Revoke a model version
    pub fn revoke_model_version(env: Env, governance: Address, model_hash: BytesN<32>) {
        governance.require_auth();
        model_version::revoke_model_version(&env, model_hash);
    }

    /// Governance: Update network parameters
    pub fn update_config(env: Env, governance: Address, config: Config) {
        governance.require_auth();
        set_config(&env, &config);
    }

    /// Get current configuration
    pub fn get_config(env: Env) -> Config {
        get_config(&env)
    }

    /// Get node information
    pub fn get_node(env: Env, node: Address) -> NodeInfo {
        node_registry::get_node(&env, &node)
    }

    /// Get all registered nodes
    pub fn get_all_nodes(env: Env) -> Vec<NodeInfo> {
        node_registry::get_all_nodes(&env)
    }

    /// Get submission status
    pub fn get_submission(env: Env, request_id: u64) -> SubmissionStatus {
        commit_reveal::get_submission_status(&env, request_id)
    }

    /// Get approved model versions
    pub fn get_approved_models(env: Env) -> Vec<BytesN<32>> {
        model_version::get_approved_models(&env)
    }

    /// Check if a model version is approved
    pub fn is_model_approved(env: Env, model_hash: BytesN<32>) -> bool {
        model_version::is_model_approved(&env, model_hash)
    }

    /// Admin-only upgrade function
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        perform_upgrade(&env, admin, new_wasm_hash);
    }

    /// Get current contract version
    pub fn get_version(env: Env) -> u32 {
        upgrade::get_version(&env)
    }
}

// Data structures
#[derive(Clone, Copy)]
pub struct Config {
    pub min_stake: i128,
    pub quorum_threshold: u32,
    pub max_nodes: u32,
    pub commit_duration_ledgers: u32,
    pub reveal_duration_ledgers: u32,
    pub dispute_window_ledgers: u32,
    pub slash_percentage: u32,
    pub variance_tolerance: i128,
}

#[derive(Clone)]
pub struct NodeInfo {
    pub address: Address,
    pub stake: i128,
    pub reputation: i128,
    pub registered_at: u64,
    pub is_active: bool,
}

#[derive(Clone)]
pub struct SubmissionStatus {
    pub request_id: u64,
    pub model_hash: BytesN<32>,
    pub commit_count: u32,
    pub reveal_count: u32,
    pub phase: SubmissionPhase,
    pub final_score: Option<i128>,
    pub finalized_at: Option<u64>,
}

#[derive(Clone, Copy)]
pub enum SubmissionPhase {
    Commit,
    Reveal,
    Finalized,
    Disputed,
}

#[cfg(test)]
mod test;
