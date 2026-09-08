#![no_std]
//! Fraud Detection Smart Contract for Soroban.
//!
//! Provides on-chain heuristic pattern recognition, statistical anomaly scoring,
//! and strict boundary validation for decentralized credit and payment streams.

pub mod errors;
pub mod events;
pub mod patterns;
pub mod risk_scorer;
pub mod storage;
pub mod types;
pub mod upgrade;
pub mod validation;

use common_utils::WriterRegistry;
use errors::ContractError;
use events::{
    create_fraud_alert, emit_anomaly_detected, emit_blacklist_updated, emit_config_updated,
    emit_flag_resolved, emit_flag_submitted, emit_fraud_alert, emit_pattern_detected,
    emit_risk_score_calculated, emit_status_overridden, emit_transaction_analyzed,
    emit_validation_failure, emit_whitelist_updated,
};
use patterns::analyze_all_patterns;
use risk_scorer::{calculate_comprehensive_risk_score, detect_anomalies};
use storage::{
    add_to_blacklist, add_to_whitelist, clear_transaction_history, get_admin, get_config,
    get_effective_risk, get_flag_history_with_limit, get_transaction_history, is_blacklisted,
    is_initialized, is_whitelisted, next_flag_id, remove_from_blacklist, remove_from_whitelist,
    remove_override_risk, resolve_flag as storage_resolve_flag, set_config, set_initialized,
    set_override_risk, store_flag, store_transaction, update_effective_risk,
};
use types::{
    FraudConfig, InputBoundsInventory, RiskFlag, RiskLevel, TransactionRecord, UpgradeRecord,
};
use validation::{
    validate_amount, validate_config, validate_transaction_type, MAX_HISTORY_CAPACITY,
    MAX_SCORE_BOUND, MAX_TX_TYPE_LEN, MAX_VALID_AMOUNT, MAX_VELOCITY_THRESHOLD,
    MAX_VELOCITY_WINDOW, MIN_VALID_AMOUNT, MIN_VELOCITY_THRESHOLD, MIN_VELOCITY_WINDOW,
};

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Symbol, Vec};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Ping entry point for liveness verification.
    pub fn ping(_env: Env) -> bool {
        true
    }

    /// Initializes contract state with administrator address and default configuration.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if is_initialized(&env) {
            return Err(ContractError::AlreadyInitialized);
        }
        admin.require_auth();

        set_initialized(&env, &admin);
        set_config(&env, &FraudConfig::default());
        upgrade::init_upgrade_system(&env);

        Ok(())
    }

    /// Analyzes a transaction for fraud indicators and boundary compliance.
    /// Rejects malformed or out-of-bounds parameters before modifying state.
    pub fn analyze_transaction(
        env: Env,
        user: Address,
        from_address: Address,
        to_address: Address,
        amount: i128,
        transaction_type: String,
    ) -> Result<u32, ContractError> {
        if !is_initialized(&env) {
            return Err(ContractError::NotInitialized);
        }

        // Validate boundary constraints on input amount
        if let Err(err) = validate_amount(amount) {
            emit_validation_failure(
                &env,
                &user,
                err as u32,
                String::from_str(&env, "invalid_amount"),
            );
            return Err(err);
        }

        // Validate structure of transaction type
        if let Err(err) = validate_transaction_type(&transaction_type) {
            emit_validation_failure(
                &env,
                &user,
                err as u32,
                String::from_str(&env, "invalid_tx_type"),
            );
            return Err(err);
        }

        let current_time = env.ledger().timestamp();
        let config = get_config(&env);

        // Immediate short-circuit for blacklisted accounts
        if is_blacklisted(&env, &user) {
            return Ok(100);
        }

        // Immediate short-circuit for whitelisted accounts
        if is_whitelisted(&env, &user) {
            let record = TransactionRecord {
                timestamp: current_time,
                amount,
                from_address,
                to_address,
                transaction_type,
            };
            store_transaction(&env, &user, &record);
            return Ok(0);
        }

        let tx_record = TransactionRecord {
            timestamp: current_time,
            amount,
            from_address,
            to_address,
            transaction_type,
        };

        // Pattern heuristic evaluation
        let patterns = analyze_all_patterns(
            &env,
            &user,
            current_time,
            config.velocity_threshold,
            config.velocity_window,
            config.max_single_amount,
        );

        // Anomaly detection
        let anomaly = detect_anomalies(&env, &user, &tx_record, current_time);

        // Comprehensive risk calculation
        let risk_score = calculate_comprehensive_risk_score(
            &env,
            &user,
            &tx_record,
            &patterns,
            current_time,
            config.velocity_threshold,
            config.velocity_window,
            config.max_single_amount,
        );

        let tx_id = current_time;

        // Store transaction in persistent history
        store_transaction(&env, &user, &tx_record);

        // Event telemetry
        emit_transaction_analyzed(&env, &user, &tx_record, risk_score.total_score, tx_id);
        emit_risk_score_calculated(&env, &user, &risk_score, tx_id);

        for p in patterns.iter() {
            emit_pattern_detected(&env, &user, &p, tx_id);
        }

        emit_anomaly_detected(
            &env,
            &user,
            anomaly.is_anomalous,
            anomaly.anomaly_score,
            tx_id,
        );

        if risk_score.total_score >= config.risk_score_threshold {
            let alert = create_fraud_alert(&env, &user, &risk_score, &tx_record, tx_id);
            emit_fraud_alert(&env, &alert);
        }

        Ok(risk_score.total_score)
    }

    /// Queries the current aggregate risk score for a user.
    pub fn get_risk_score(env: Env, user: Address) -> Result<u32, ContractError> {
        if !is_initialized(&env) {
            return Err(ContractError::NotInitialized);
        }

        if is_blacklisted(&env, &user) {
            return Ok(100);
        }
        if is_whitelisted(&env, &user) {
            return Ok(0);
        }

        let history = get_transaction_history(&env, &user);
        if history.is_empty() {
            return Ok(0);
        }

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

        let latest = history.get(history.len() - 1).unwrap();
        let score = calculate_comprehensive_risk_score(
            &env,
            &user,
            &latest,
            &patterns,
            current_time,
            config.velocity_threshold,
            config.velocity_window,
            config.max_single_amount,
        );

        Ok(score.total_score)
    }

    /// Returns high-level human-readable fraud indicator strings for an account.
    pub fn get_indicators(env: Env, user: Address) -> Vec<String> {
        let mut indicators = Vec::new(&env);

        if is_blacklisted(&env, &user) {
            indicators.push_back(String::from_str(&env, "Account is blacklisted"));
            return indicators;
        }

        if is_whitelisted(&env, &user) {
            indicators.push_back(String::from_str(&env, "Account is verified whitelisted"));
            return indicators;
        }

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

        for p in patterns.iter() {
            indicators.push_back(p.description.clone());
        }

        indicators
    }

    /// Updates fraud detection configuration parameters with boundary enforcement.
    pub fn update_config(
        env: Env,
        admin: Address,
        config: FraudConfig,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;

        // Validate boundary constraints on configuration
        validate_config(&config)?;

        set_config(&env, &config);
        emit_config_updated(
            &env,
            config.velocity_threshold,
            config.velocity_window,
            config.max_single_amount,
            config.risk_score_threshold,
            config.anomaly_threshold,
            &admin,
        );

        Ok(())
    }

    /// Returns the current fraud detection configuration.
    pub fn get_config(env: Env) -> FraudConfig {
        get_config(&env)
    }

    /// Adds an address to the fraud blacklist.
    pub fn add_to_blacklist(
        env: Env,
        admin: Address,
        address: Address,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        add_to_blacklist(&env, &address);
        emit_blacklist_updated(&env, &address, true, &admin);
        Ok(())
    }

    /// Removes an address from the fraud blacklist.
    pub fn remove_from_blacklist(
        env: Env,
        admin: Address,
        address: Address,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        remove_from_blacklist(&env, &address);
        emit_blacklist_updated(&env, &address, false, &admin);
        Ok(())
    }

    /// Checks if an address is blacklisted.
    pub fn is_blacklisted(env: Env, address: Address) -> bool {
        is_blacklisted(&env, &address)
    }

    /// Adds an address to the verified whitelist.
    pub fn add_to_whitelist(
        env: Env,
        admin: Address,
        address: Address,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        add_to_whitelist(&env, &address);
        emit_whitelist_updated(&env, &address, true, &admin);
        Ok(())
    }

    /// Removes an address from the verified whitelist.
    pub fn remove_from_whitelist(
        env: Env,
        admin: Address,
        address: Address,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        remove_from_whitelist(&env, &address);
        emit_whitelist_updated(&env, &address, false, &admin);
        Ok(())
    }

    /// Checks if an address is whitelisted.
    pub fn is_whitelisted(env: Env, address: Address) -> bool {
        is_whitelisted(&env, &address)
    }

    /// Retrieves historical recorded transactions for an account.
    pub fn get_transaction_history(env: Env, user: Address) -> Vec<TransactionRecord> {
        get_transaction_history(&env, &user)
    }

    /// Clears transaction history for an account.
    pub fn clear_user_history(
        env: Env,
        admin: Address,
        user: Address,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        clear_transaction_history(&env, &user);
        Ok(())
    }

    /// Returns the public inventory of parameter bounds and constraints.
    pub fn get_bounds_inventory(env: Env) -> InputBoundsInventory {
        let _ = env;
        InputBoundsInventory {
            min_amount: MIN_VALID_AMOUNT,
            max_amount: MAX_VALID_AMOUNT,
            min_velocity_threshold: MIN_VELOCITY_THRESHOLD,
            max_velocity_threshold: MAX_VELOCITY_THRESHOLD,
            min_velocity_window: MIN_VELOCITY_WINDOW,
            max_velocity_window: MAX_VELOCITY_WINDOW,
            max_score: MAX_SCORE_BOUND,
            max_tx_type_len: MAX_TX_TYPE_LEN,
            max_history_capacity: MAX_HISTORY_CAPACITY,
        }
    }

    /// Performs contract WASM code upgrade.
    pub fn upgrade(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        let notes = String::from_str(&env, "Standard upgrade");
        upgrade::perform_upgrade(&env, &admin, new_wasm_hash, notes)
    }

    /// Rolls back contract code to previously stored WASM hash.
    pub fn rollback(env: Env, admin: Address) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        upgrade::rollback_upgrade(&env, &admin)
    }

    /// Returns the current contract version number.
    pub fn get_version(env: Env) -> u32 {
        upgrade::get_version(&env)
    }

    /// Retrieves historical upgrade audit records.
    pub fn get_upgrade_history(env: Env) -> Vec<UpgradeRecord> {
        upgrade::get_upgrade_history(&env)
    }

    /// Sets or removes writer authorization for flag submission. Admin-only.
    pub fn set_writer(
        env: Env,
        admin: Address,
        writer: Address,
        authorized: bool,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        WriterRegistry::set_writer(&env, &writer, authorized);
        Ok(())
    }

    /// Queries whether an address is an authorized writer.
    pub fn is_writer(env: Env, writer: Address) -> bool {
        WriterRegistry::is_writer(&env, &writer)
    }

    /// Submits a new fraud risk flag for a subject.
    ///
    /// Requires authorization from an admin or registered writer.
    pub fn submit_flag(
        env: Env,
        caller: Address,
        subject: Address,
        risk_level: RiskLevel,
        reasons: Vec<Symbol>,
        evidence_hash: BytesN<32>,
    ) -> Result<u64, ContractError> {
        if !is_initialized(&env) {
            return Err(ContractError::NotInitialized);
        }
        caller.require_auth();

        let admin = get_admin(&env)?;
        if caller != admin && !WriterRegistry::is_writer(&env, &caller) {
            return Err(ContractError::UnauthorizedWriter);
        }

        if reasons.is_empty() {
            return Err(ContractError::MalformedInput);
        }

        let flag_id = next_flag_id(&env);
        let flag = RiskFlag {
            id: flag_id,
            subject: subject.clone(),
            risk_level,
            reasons,
            evidence_hash: evidence_hash.clone(),
            flagged_at: env.ledger().timestamp(),
            flagged_by: caller.clone(),
            resolved: false,
            resolution_note: None,
        };

        store_flag(&env, &subject, &flag);
        update_effective_risk(&env, &subject);
        emit_flag_submitted(&env, &subject, flag_id, risk_level, &caller, &evidence_hash);

        Ok(flag_id)
    }

    /// Marks an existing fraud flag as resolved with an explanatory note.
    ///
    /// Requires authorization from an admin or registered writer.
    pub fn resolve_flag(
        env: Env,
        caller: Address,
        subject: Address,
        flag_id: u64,
        resolution_note: Symbol,
    ) -> Result<(), ContractError> {
        if !is_initialized(&env) {
            return Err(ContractError::NotInitialized);
        }
        caller.require_auth();

        let admin = get_admin(&env)?;
        if caller != admin && !WriterRegistry::is_writer(&env, &caller) {
            return Err(ContractError::NotAuthorized);
        }

        storage_resolve_flag(&env, &subject, flag_id, &resolution_note)?;
        update_effective_risk(&env, &subject);
        emit_flag_resolved(&env, &subject, flag_id, &caller, &resolution_note);

        Ok(())
    }

    /// Returns the current effective risk level for a subject in O(1) time.
    pub fn get_current_risk(env: Env, subject: Address) -> RiskLevel {
        get_effective_risk(&env, &subject)
    }

    /// Returns the bounded flag history for a subject up to the requested limit.
    pub fn get_flag_history(env: Env, subject: Address, limit: u32) -> Vec<RiskFlag> {
        get_flag_history_with_limit(&env, &subject, limit)
    }

    /// Admin-only manual override for a subject's risk level.
    pub fn override_status(
        env: Env,
        admin: Address,
        subject: Address,
        risk_level: RiskLevel,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        set_override_risk(&env, &subject, &risk_level);
        emit_status_overridden(&env, &admin, &subject, risk_level);
        Ok(())
    }

    /// Admin-only removal of manual override, restoring model-driven risk level.
    pub fn remove_override(
        env: Env,
        admin: Address,
        subject: Address,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        remove_override_risk(&env, &subject);
        update_effective_risk(&env, &subject);
        Ok(())
    }

    /// Helper boolean check whether a subject is flagged as Critical fraud risk.
    pub fn is_fraud_critical(env: Env, subject: Address) -> bool {
        get_effective_risk(&env, &subject) == RiskLevel::Critical
    }

    /// Internal administrator authorization check.
    fn require_admin(env: &Env, admin: &Address) -> Result<(), ContractError> {
        let stored_admin = get_admin(env)?;
        admin.require_auth();
        if stored_admin != *admin {
            return Err(ContractError::NotAuthorized);
        }
        Ok(())
    }
}

#[cfg(test)]
mod test;
