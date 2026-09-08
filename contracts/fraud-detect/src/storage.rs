//! Storage abstraction layer providing safe instance and persistent state management.

use crate::errors::ContractError;
use crate::types::{FraudConfig, RiskFlag, RiskLevel, TransactionRecord};
use crate::validation::MAX_HISTORY_CAPACITY;
use soroban_sdk::{symbol_short, Address, Env, Map, Symbol, Vec};

const TRANSACTION_HISTORY_KEY: Symbol = symbol_short!("tx_hist");
const BLACKLIST_KEY: Symbol = symbol_short!("blklist");
const WHITELIST_KEY: Symbol = symbol_short!("whtlist");
const CONFIG_KEY: Symbol = symbol_short!("config");
const ADMIN_KEY: Symbol = symbol_short!("admin");
const INIT_KEY: Symbol = symbol_short!("is_init");
const FLAG_HISTORY_KEY: Symbol = symbol_short!("flg_hist");
const FLAG_SEQ_KEY: Symbol = symbol_short!("flg_seq");
const EFFECTIVE_RISK_KEY: Symbol = symbol_short!("eff_risk");
const OVERRIDE_RISK_KEY: Symbol = symbol_short!("ovr_risk");

pub const MAX_FLAG_HISTORY_CAPACITY: u32 = 50;

const YEAR_LEDGERS: u32 = 6_307_200;

/// Checks if contract is already initialized.
pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&INIT_KEY)
}

/// Marks contract as initialized and sets admin.
pub fn set_initialized(env: &Env, admin: &Address) {
    env.storage().instance().set(&INIT_KEY, &true);
    env.storage().instance().set(&ADMIN_KEY, admin);
}

/// Retrieves contract administrator address.
pub fn get_admin(env: &Env) -> Result<Address, ContractError> {
    env.storage()
        .instance()
        .get(&ADMIN_KEY)
        .ok_or(ContractError::NotInitialized)
}

/// Stores a new transaction record in user's persistent ring-buffer history.
/// If history exceeds `MAX_HISTORY_CAPACITY`, oldest entry is evicted.
pub fn store_transaction(env: &Env, user: &Address, record: &TransactionRecord) {
    let mut user_history: Vec<TransactionRecord> = get_transaction_history(env, user);

    if user_history.len() >= MAX_HISTORY_CAPACITY {
        user_history.remove(0);
    }
    user_history.push_back(record.clone());

    env.storage()
        .persistent()
        .set(&(TRANSACTION_HISTORY_KEY, user), &user_history);
    env.storage().persistent().extend_ttl(
        &(TRANSACTION_HISTORY_KEY, user),
        YEAR_LEDGERS,
        YEAR_LEDGERS,
    );
}

/// Retrieves complete transaction history for a given user account.
pub fn get_transaction_history(env: &Env, user: &Address) -> Vec<TransactionRecord> {
    env.storage()
        .persistent()
        .get(&(TRANSACTION_HISTORY_KEY, user))
        .unwrap_or_else(|| Vec::new(env))
}

/// Clears transaction history for a specified user.
pub fn clear_transaction_history(env: &Env, user: &Address) {
    env.storage()
        .persistent()
        .remove(&(TRANSACTION_HISTORY_KEY, user));
}

/// Adds an address to the fraud blacklist.
pub fn add_to_blacklist(env: &Env, address: &Address) {
    let mut blacklist: Map<Address, u64> = get_blacklist(env);
    let current_ledger = env.ledger().sequence() as u64;
    blacklist.set(address.clone(), current_ledger);
    env.storage().persistent().set(&BLACKLIST_KEY, &blacklist);
    env.storage()
        .persistent()
        .extend_ttl(&BLACKLIST_KEY, YEAR_LEDGERS, YEAR_LEDGERS);
}

/// Removes an address from the fraud blacklist.
pub fn remove_from_blacklist(env: &Env, address: &Address) {
    let mut blacklist: Map<Address, u64> = get_blacklist(env);
    blacklist.remove(address.clone());
    env.storage().persistent().set(&BLACKLIST_KEY, &blacklist);
    env.storage()
        .persistent()
        .extend_ttl(&BLACKLIST_KEY, YEAR_LEDGERS, YEAR_LEDGERS);
}

/// Returns the current blacklist map.
pub fn get_blacklist(env: &Env) -> Map<Address, u64> {
    env.storage()
        .persistent()
        .get(&BLACKLIST_KEY)
        .unwrap_or_else(|| Map::new(env))
}

/// Checks whether an address is on the blacklist.
pub fn is_blacklisted(env: &Env, address: &Address) -> bool {
    let blacklist = get_blacklist(env);
    blacklist.contains_key(address.clone())
}

/// Adds an address to the verified whitelist.
pub fn add_to_whitelist(env: &Env, address: &Address) {
    let mut whitelist: Map<Address, u64> = get_whitelist(env);
    let current_ledger = env.ledger().sequence() as u64;
    whitelist.set(address.clone(), current_ledger);
    env.storage().persistent().set(&WHITELIST_KEY, &whitelist);
    env.storage()
        .persistent()
        .extend_ttl(&WHITELIST_KEY, YEAR_LEDGERS, YEAR_LEDGERS);
}

/// Removes an address from the verified whitelist.
pub fn remove_from_whitelist(env: &Env, address: &Address) {
    let mut whitelist: Map<Address, u64> = get_whitelist(env);
    whitelist.remove(address.clone());
    env.storage().persistent().set(&WHITELIST_KEY, &whitelist);
    env.storage()
        .persistent()
        .extend_ttl(&WHITELIST_KEY, YEAR_LEDGERS, YEAR_LEDGERS);
}

/// Returns the current whitelist map.
pub fn get_whitelist(env: &Env) -> Map<Address, u64> {
    env.storage()
        .persistent()
        .get(&WHITELIST_KEY)
        .unwrap_or_else(|| Map::new(env))
}

/// Checks whether an address is on the whitelist.
pub fn is_whitelisted(env: &Env, address: &Address) -> bool {
    let whitelist = get_whitelist(env);
    whitelist.contains_key(address.clone())
}

/// Stores configuration in instance storage.
pub fn set_config(env: &Env, config: &FraudConfig) {
    env.storage().instance().set(&CONFIG_KEY, config);
}

/// Retrieves stored configuration or default if not set.
pub fn get_config(env: &Env) -> FraudConfig {
    env.storage()
        .instance()
        .get(&CONFIG_KEY)
        .unwrap_or_default()
}

/// Returns transactions occurring between `window_start` and `window_end` inclusive.
pub fn get_transactions_in_window(
    env: &Env,
    user: &Address,
    window_start: u64,
    window_end: u64,
) -> Vec<TransactionRecord> {
    let history = get_transaction_history(env, user);
    let mut filtered = Vec::new(env);

    for record in history.iter() {
        if record.timestamp >= window_start && record.timestamp <= window_end {
            filtered.push_back(record.clone());
        }
    }

    filtered
}

/// Allocates the next monotonic flag identifier.
pub fn next_flag_id(env: &Env) -> u64 {
    let current = env.storage().instance().get(&FLAG_SEQ_KEY).unwrap_or(0u64);
    let next = current.saturating_add(1);
    env.storage().instance().set(&FLAG_SEQ_KEY, &next);
    next
}

/// Retrieves stored risk flags for a subject.
pub fn get_flag_history(env: &Env, subject: &Address) -> Vec<RiskFlag> {
    let key = (FLAG_HISTORY_KEY, subject.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

/// Retrieves risk flags for a subject up to a requested limit.
pub fn get_flag_history_with_limit(env: &Env, subject: &Address, limit: u32) -> Vec<RiskFlag> {
    let history = get_flag_history(env, subject);
    if limit == 0 || history.len() <= limit {
        return history;
    }
    let mut truncated = Vec::new(env);
    let start_idx = history.len().saturating_sub(limit);
    for i in start_idx..history.len() {
        if let Some(item) = history.get(i) {
            truncated.push_back(item);
        }
    }
    truncated
}

/// Stores a new flag into bounded history and extends storage TTL.
pub fn store_flag(env: &Env, subject: &Address, flag: &RiskFlag) {
    let key = (FLAG_HISTORY_KEY, subject.clone());
    let mut history = get_flag_history(env, subject);

    if history.len() >= MAX_FLAG_HISTORY_CAPACITY {
        let mut drop_idx = None;
        for (i, item) in history.iter().enumerate() {
            if item.resolved {
                drop_idx = Some(i as u32);
                break;
            }
        }
        let remove_at = drop_idx.unwrap_or(0);
        history.remove(remove_at);
    }

    history.push_back(flag.clone());
    env.storage().persistent().set(&key, &history);
    env.storage()
        .persistent()
        .extend_ttl(&key, YEAR_LEDGERS, YEAR_LEDGERS);
}

/// Marks a flag as resolved with an explanatory note.
pub fn resolve_flag(
    env: &Env,
    subject: &Address,
    flag_id: u64,
    note: &Symbol,
) -> Result<RiskFlag, ContractError> {
    let key = (FLAG_HISTORY_KEY, subject.clone());
    let mut history = get_flag_history(env, subject);
    let mut found_idx = None;
    let mut resolved_flag = None;

    for (i, item) in history.iter().enumerate() {
        if item.id == flag_id {
            if item.resolved {
                return Err(ContractError::AlreadyResolved);
            }
            let mut updated = item.clone();
            updated.resolved = true;
            updated.resolution_note = Some(note.clone());
            found_idx = Some(i as u32);
            resolved_flag = Some(updated);
            break;
        }
    }

    match (found_idx, resolved_flag) {
        (Some(idx), Some(updated)) => {
            history.set(idx, updated.clone());
            env.storage().persistent().set(&key, &history);
            env.storage()
                .persistent()
                .extend_ttl(&key, YEAR_LEDGERS, YEAR_LEDGERS);
            Ok(updated)
        }
        _ => Err(ContractError::FlagNotFound),
    }
}

/// Returns the current effective risk level for a subject in O(1) time.
pub fn get_effective_risk(env: &Env, subject: &Address) -> RiskLevel {
    let ovr_key = (OVERRIDE_RISK_KEY, subject.clone());
    if let Some(override_risk) = env.storage().persistent().get::<_, RiskLevel>(&ovr_key) {
        return override_risk;
    }

    let eff_key = (EFFECTIVE_RISK_KEY, subject.clone());
    env.storage()
        .persistent()
        .get::<_, RiskLevel>(&eff_key)
        .unwrap_or(RiskLevel::Low)
}

/// Recalculates effective risk from unresolved flags or manual override.
pub fn update_effective_risk(env: &Env, subject: &Address) {
    let ovr_key = (OVERRIDE_RISK_KEY, subject.clone());
    if let Some(override_risk) = env.storage().persistent().get::<_, RiskLevel>(&ovr_key) {
        let eff_key = (EFFECTIVE_RISK_KEY, subject.clone());
        env.storage().persistent().set(&eff_key, &override_risk);
        env.storage()
            .persistent()
            .extend_ttl(&eff_key, YEAR_LEDGERS, YEAR_LEDGERS);
        return;
    }

    let history = get_flag_history(env, subject);
    let mut max_risk = RiskLevel::Low;
    for flag in history.iter() {
        if !flag.resolved && (flag.risk_level as u32) > (max_risk as u32) {
            max_risk = flag.risk_level;
        }
    }

    let eff_key = (EFFECTIVE_RISK_KEY, subject.clone());
    env.storage().persistent().set(&eff_key, &max_risk);
    env.storage()
        .persistent()
        .extend_ttl(&eff_key, YEAR_LEDGERS, YEAR_LEDGERS);
}

/// Sets an administrative risk override that takes precedence over model flags.
pub fn set_override_risk(env: &Env, subject: &Address, risk: &RiskLevel) {
    let ovr_key = (OVERRIDE_RISK_KEY, subject.clone());
    let eff_key = (EFFECTIVE_RISK_KEY, subject.clone());
    env.storage().persistent().set(&ovr_key, risk);
    env.storage()
        .persistent()
        .extend_ttl(&ovr_key, YEAR_LEDGERS, YEAR_LEDGERS);
    env.storage().persistent().set(&eff_key, risk);
    env.storage()
        .persistent()
        .extend_ttl(&eff_key, YEAR_LEDGERS, YEAR_LEDGERS);
}

/// Clears an administrative risk override.
pub fn remove_override_risk(env: &Env, subject: &Address) {
    let ovr_key = (OVERRIDE_RISK_KEY, subject.clone());
    env.storage().persistent().remove(&ovr_key);
}
