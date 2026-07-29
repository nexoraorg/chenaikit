use soroban_sdk::{Env, Symbol, Map};
use crate::Config;

/// Storage keys
const CONFIG_KEY: Symbol = Symbol::short("config");
const NODES_KEY: Symbol = Symbol::short("nodes");
const SUBMISSIONS_KEY: Symbol = Symbol::short("submissions");
const MODELS_KEY: Symbol = Symbol::short("models");

/// Set configuration
pub fn set_config(env: &Env, config: &Config) {
    env.storage().instance().set(&CONFIG_KEY, config);
}

/// Get configuration
pub fn get_config(env: &Env) -> Config {
    env.storage()
        .instance()
        .get(&CONFIG_KEY)
        .expect("config not initialized")
}

/// Get configuration or return default
pub fn get_config_or_default(env: &Env) -> Config {
    env.storage()
        .instance()
        .get(&CONFIG_KEY)
        .unwrap_or(Config {
            min_stake: 1_000_000,
            quorum_threshold: 5,
            max_nodes: 9,
            commit_duration_ledgers: 100,
            reveal_duration_ledgers: 100,
            dispute_window_ledgers: 500,
            slash_percentage: 10,
            variance_tolerance: 100,
        })
}

/// Node storage helpers
pub fn get_nodes_map(env: &Env) -> Map<soroban_sdk::Address, crate::NodeInfo> {
    env.storage()
        .instance()
        .get(&NODES_KEY)
        .unwrap_or_else(|| Map::new(env))
}

pub fn set_nodes_map(env: &Env, nodes: &Map<soroban_sdk::Address, crate::NodeInfo>) {
    env.storage().instance().set(&NODES_KEY, nodes);
}

/// Submission storage helpers
pub fn get_submissions_map(env: &Env) -> Map<u64, crate::SubmissionStatus> {
    env.storage()
        .instance()
        .get(&SUBMISSIONS_KEY)
        .unwrap_or_else(|| Map::new(env))
}

pub fn set_submissions_map(env: &Env, submissions: &Map<u64, crate::SubmissionStatus>) {
    env.storage().instance().set(&SUBMISSIONS_KEY, submissions);
}

/// Model version storage helpers
pub fn get_models_set(env: &Env) -> soroban_sdk::Set<soroban_sdk::BytesN<32>> {
    env.storage()
        .instance()
        .get(&MODELS_KEY)
        .unwrap_or_else(|| soroban_sdk::Set::new(env))
}

pub fn set_models_set(env: &Env, models: &soroban_sdk::Set<soroban_sdk::BytesN<32>>) {
    env.storage().instance().set(&MODELS_KEY, models);
}
