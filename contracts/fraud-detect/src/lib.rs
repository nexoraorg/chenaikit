#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec};

mod events;
mod patterns;
mod risk_scorer;
mod storage;
mod upgrade;

use crate::events::{
    create_fraud_alert, emit_anomaly_detected, emit_blacklist_updated, emit_config_updated,
    emit_fraud_alert, emit_pattern_detected, emit_risk_score_calculated, emit_transaction_analyzed,
    emit_whitelist_updated,
};
use crate::patterns::analyze_all_patterns;
use crate::risk_scorer::{calculate_comprehensive_risk_score, detect_anomalies};
use crate::storage::{
    add_to_blacklist, add_to_whitelist, clear_transaction_history, get_config,
    get_transaction_history, is_blacklisted, is_whitelisted, remove_from_blacklist,
    remove_from_whitelist, set_config, store_transaction, FraudConfig, TransactionRecord,
};

#[contract]
pub struct FraudDetectContract;

#[contractimpl]
impl FraudDetectContract {
    pub fn initialize(env: Env, admin: Address) {
        if env
            .storage()
            .instance()
            .has(&soroban_sdk::symbol_short!("init"))
        {
            panic!("already initialized");
        }

        admin.require_auth();

        env.storage()
            .instance()
            .set(&soroban_sdk::symbol_short!("admin"), &admin);
        env.storage()
            .instance()
            .set(&soroban_sdk::symbol_short!("init"), &true);

        // Initialize upgrade system
        upgrade::init_upgrade_system(&env);

        let default_config = FraudConfig::default();
        set_config(&env, &default_config);

        emit_config_updated(
            &env,
            default_config.velocity_threshold,
            default_config.velocity_window,
            default_config.max_single_amount,
            default_config.risk_score_threshold,
            default_config.anomaly_threshold,
            &admin,
        );
    }

    pub fn analyze_transaction(
        env: Env,
        user: Address,
        from_address: Address,
        to_address: Address,
        amount: i128,
        transaction_type: String,
    ) -> u32 {
        user.require_auth();

        if is_blacklisted(&env, &user) {
            return 100;
        }

        if is_whitelisted(&env, &user) {
            return 0;
        }

        let current_time = env.ledger().timestamp();
        let transaction_id = env.ledger().sequence() as u64;

        let transaction = TransactionRecord {
            timestamp: current_time,
            amount,
            from_address: from_address.clone(),
            to_address: to_address.clone(),
            transaction_type: transaction_type.clone(),
        };

        let config = get_config(&env);

        let patterns = analyze_all_patterns(
            &env,
            &user,
            current_time,
            config.velocity_threshold,
            config.velocity_window,
            config.max_single_amount,
        );

        let risk_score = calculate_comprehensive_risk_score(
            &env,
            &user,
            &transaction,
            &patterns,
            current_time,
            config.velocity_threshold,
            config.velocity_window,
            config.max_single_amount,
        );

        let anomaly = detect_anomalies(&env, &user, &transaction, current_time);

        store_transaction(&env, &user, &transaction);

        emit_transaction_analyzed(
            &env,
            &user,
            &transaction,
            risk_score.total_score,
            risk_score.total_score >= config.risk_score_threshold,
            transaction_id,
        );

        emit_risk_score_calculated(&env, &user, &risk_score, transaction_id);

        for i in 0..patterns.len() {
            let pattern = patterns.get(i).unwrap();
            emit_pattern_detected(&env, &user, &pattern, transaction_id);
        }

        emit_anomaly_detected(
            &env,
            &user,
            anomaly.is_anomalous,
            anomaly.anomaly_score,
            &anomaly.deviation_factors,
            transaction_id,
        );

        if risk_score.total_score >= config.risk_score_threshold {
            let fraud_alert =
                create_fraud_alert(&env, &user, &risk_score, &transaction, transaction_id);
            emit_fraud_alert(&env, &fraud_alert);
        }

        risk_score.total_score
    }

    pub fn get_risk_score(env: Env, user: Address) -> u32 {
        let current_time = env.ledger().timestamp();
        let config = get_config(&env);

        let patterns = analyze_all_patterns(
            &env,
            &user,
            current_time,
            config.velocity_threshold,
            config.velocity_window,
            config.max_single_amount,
        );

        let history = get_transaction_history(&env, &user);
        if history.is_empty() {
            return 0;
        }

        let latest_transaction = history.get(history.len() - 1).unwrap();

        let risk_score = calculate_comprehensive_risk_score(
            &env,
            &user,
            &latest_transaction,
            &patterns,
            current_time,
            config.velocity_threshold,
            config.velocity_window,
            config.max_single_amount,
        );

        risk_score.total_score
    }

    pub fn get_indicators(env: Env, user: Address) -> Vec<String> {
        let current_time = env.ledger().timestamp();
        let config = get_config(&env);

        let patterns = analyze_all_patterns(
            &env,
            &user,
            current_time,
            config.velocity_threshold,
            config.velocity_window,
            config.max_single_amount,
        );

        let mut indicators = Vec::new(&env);

        for i in 0..patterns.len() {
            let pattern = patterns.get(i).unwrap();
            indicators.push_back(pattern.description.clone());
        }

        if is_blacklisted(&env, &user) {
            indicators.push_back(String::from_str(&env, "User is blacklisted"));
        }

        if is_whitelisted(&env, &user) {
            indicators.push_back(String::from_str(&env, "User is whitelisted"));
        }

        indicators
    }

    pub fn update_model(env: Env, admin: Address, model_data: String) {
        Self::require_admin(&env, &admin);

        let current_time = env.ledger().timestamp();

        env.events().publish(
            (soroban_sdk::symbol_short!("model_upd"),),
            (model_data.clone(), admin.clone(), current_time),
        );
    }

    pub fn add_to_blacklist(env: Env, admin: Address, address: Address) {
        Self::require_admin(&env, &admin);
        add_to_blacklist(&env, &address);

        let current_time = env.ledger().timestamp();
        emit_blacklist_updated(&env, &address, true, current_time, &admin);
    }

    pub fn remove_from_blacklist(env: Env, admin: Address, address: Address) {
        Self::require_admin(&env, &admin);
        remove_from_blacklist(&env, &address);

        let current_time = env.ledger().timestamp();
        emit_blacklist_updated(&env, &address, false, current_time, &admin);
    }

    pub fn add_to_whitelist(env: Env, admin: Address, address: Address) {
        Self::require_admin(&env, &admin);
        add_to_whitelist(&env, &address);

        let current_time = env.ledger().timestamp();
        emit_whitelist_updated(&env, &address, true, current_time, &admin);
    }

    pub fn remove_from_whitelist(env: Env, admin: Address, address: Address) {
        Self::require_admin(&env, &admin);
        remove_from_whitelist(&env, &address);

        let current_time = env.ledger().timestamp();
        emit_whitelist_updated(&env, &address, false, current_time, &admin);
    }

    pub fn update_config(
        env: Env,
        admin: Address,
        velocity_threshold: u32,
        velocity_window: u64,
        max_single_amount: i128,
        risk_score_threshold: u32,
        anomaly_threshold: i64,
    ) {
        Self::require_admin(&env, &admin);

        let config = FraudConfig {
            velocity_threshold,
            velocity_window,
            max_single_amount,
            risk_score_threshold,
            anomaly_threshold,
        };

        set_config(&env, &config);
        emit_config_updated(
            &env,
            velocity_threshold,
            velocity_window,
            max_single_amount,
            risk_score_threshold,
            anomaly_threshold,
            &admin,
        );
    }

    pub fn get_config(env: Env) -> (u32, u64, i128, u32, i64) {
        let config = get_config(&env);
        (
            config.velocity_threshold,
            config.velocity_window,
            config.max_single_amount,
            config.risk_score_threshold,
            config.anomaly_threshold,
        )
    }

    pub fn is_blacklisted(env: Env, address: Address) -> bool {
        is_blacklisted(&env, &address)
    }

    pub fn is_whitelisted(env: Env, address: Address) -> bool {
        is_whitelisted(&env, &address)
    }

    pub fn get_transaction_history(
        env: Env,
        user: Address,
    ) -> Vec<(u64, i128, Address, Address, String)> {
        let history = get_transaction_history(&env, &user);
        let mut result = Vec::new(&env);

        for i in 0..history.len() {
            let record = history.get(i).unwrap();
            result.push_back((
                record.timestamp,
                record.amount,
                record.from_address.clone(),
                record.to_address.clone(),
                record.transaction_type.clone(),
            ));
        }

        result
    }

    pub fn clear_user_history(env: Env, admin: Address, user: Address) {
        Self::require_admin(&env, &admin);
        clear_transaction_history(&env, &user);
    }

    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        Self::require_admin(&env, &admin);
        
        let migration_notes = String::from_str(&env, "Standard upgrade");
        upgrade::perform_upgrade(&env, &admin, new_wasm_hash, migration_notes);
    }

    pub fn upgrade_with_migration(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
        migration_notes: String,
    ) {
        Self::require_admin(&env, &admin);
        upgrade::perform_upgrade(&env, &admin, new_wasm_hash, migration_notes);
    }

    pub fn rollback(env: Env, admin: Address) {
        Self::require_admin(&env, &admin);
        upgrade::rollback_upgrade(&env, &admin);
    }

    pub fn get_version(env: Env) -> u32 {
        upgrade::get_version(&env)
    }

    pub fn get_upgrade_history(env: Env) -> Vec<upgrade::UpgradeRecord> {
        upgrade::get_upgrade_history(&env)
    }

    fn require_admin(env: &Env, admin: &Address) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&soroban_sdk::symbol_short!("admin"))
            .unwrap_or_else(|| panic!("admin not set"));

        if stored_admin != *admin {
            admin.require_auth();
        }

        if stored_admin != *admin {
            panic!("not authorized");
        }
    }
}

#[cfg(test)]
mod test;
