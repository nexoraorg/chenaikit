//! Soroban event emission for auditability and boundary violation telemetry.

use crate::types::{AlertLevel, FraudAlertData, PatternMatch, RiskScore, TransactionRecord};
use soroban_sdk::{symbol_short, Address, BytesN, Env, String, Symbol};

const TOPIC_FRAUD_ALERT: Symbol = symbol_short!("fr_alert");
const TOPIC_RISK_SCORE: Symbol = symbol_short!("risk_sc");
const TOPIC_PATTERN: Symbol = symbol_short!("pattern");
const TOPIC_ANOMALY: Symbol = symbol_short!("anomaly");
const TOPIC_TX_ANALYZED: Symbol = symbol_short!("tx_anlz");
const TOPIC_CONFIG: Symbol = symbol_short!("cfg_upd");
const TOPIC_BLACKLIST: Symbol = symbol_short!("blk_upd");
const TOPIC_WHITELIST: Symbol = symbol_short!("wht_upd");
const TOPIC_VALIDATION_ERR: Symbol = symbol_short!("val_err");

/// Emits an event when a high-risk fraud alert is generated.
pub fn emit_fraud_alert(env: &Env, alert: &FraudAlertData) {
    let level_u32 = match alert.alert_level {
        AlertLevel::Low => 1,
        AlertLevel::Medium => 2,
        AlertLevel::High => 3,
        AlertLevel::Critical => 4,
    };

    env.events().publish(
        (TOPIC_FRAUD_ALERT, alert.user.clone()),
        (
            alert.risk_score,
            level_u32,
            alert.timestamp,
            alert.transaction_id,
        ),
    );
}

/// Emits an event capturing calculated risk score breakdown.
pub fn emit_risk_score_calculated(env: &Env, user: &Address, score: &RiskScore, tx_id: u64) {
    env.events().publish(
        (TOPIC_RISK_SCORE, user.clone()),
        (
            score.total_score,
            score.velocity_score,
            score.amount_score,
            score.timing_score,
            score.pattern_score,
            score.historical_score,
            tx_id,
        ),
    );
}

/// Emits an event when a suspicious heuristic pattern match is detected.
pub fn emit_pattern_detected(env: &Env, user: &Address, pattern: &PatternMatch, tx_id: u64) {
    env.events().publish(
        (TOPIC_PATTERN, user.clone()),
        (pattern.confidence, pattern.description.clone(), tx_id),
    );
}

/// Emits an event when a statistical anomaly is detected.
pub fn emit_anomaly_detected(
    env: &Env,
    user: &Address,
    is_anomalous: bool,
    anomaly_score: i64,
    tx_id: u64,
) {
    env.events().publish(
        (TOPIC_ANOMALY, user.clone()),
        (is_anomalous, anomaly_score, tx_id),
    );
}

/// Emits an event when a transaction is analyzed and recorded.
pub fn emit_transaction_analyzed(
    env: &Env,
    user: &Address,
    tx: &TransactionRecord,
    risk_score: u32,
    tx_id: u64,
) {
    env.events().publish(
        (TOPIC_TX_ANALYZED, user.clone()),
        (
            tx.amount,
            tx.timestamp,
            tx.transaction_type.clone(),
            risk_score,
            tx_id,
        ),
    );
}

/// Emits an event when contract configuration is updated.
pub fn emit_config_updated(
    env: &Env,
    velocity_threshold: u32,
    velocity_window: u64,
    max_amount: i128,
    risk_score_threshold: u32,
    anomaly_threshold: i64,
    admin: &Address,
) {
    env.events().publish(
        (TOPIC_CONFIG, admin.clone()),
        (
            velocity_threshold,
            velocity_window,
            max_amount,
            risk_score_threshold,
            anomaly_threshold,
        ),
    );
}

/// Emits an event when blacklist status is modified.
pub fn emit_blacklist_updated(env: &Env, target: &Address, added: bool, admin: &Address) {
    env.events().publish(
        (TOPIC_BLACKLIST, target.clone()),
        (added, env.ledger().timestamp(), admin.clone()),
    );
}

/// Emits an event when whitelist status is modified.
pub fn emit_whitelist_updated(env: &Env, target: &Address, added: bool, admin: &Address) {
    env.events().publish(
        (TOPIC_WHITELIST, target.clone()),
        (added, env.ledger().timestamp(), admin.clone()),
    );
}

/// Emits an explicit audit event when input validation fails and execution is rejected.
pub fn emit_validation_failure(env: &Env, caller: &Address, error_code: u32, tag: String) {
    env.events().publish(
        (TOPIC_VALIDATION_ERR, caller.clone()),
        (error_code, tag, env.ledger().timestamp()),
    );
}

/// Creates a `FraudAlertData` structure from score and transaction context.
pub fn create_fraud_alert(
    env: &Env,
    user: &Address,
    score: &RiskScore,
    _tx: &TransactionRecord,
    tx_id: u64,
) -> FraudAlertData {
    FraudAlertData {
        user: user.clone(),
        risk_score: score.total_score,
        alert_level: AlertLevel::from_score(score.total_score),
        timestamp: env.ledger().timestamp(),
        transaction_id: tx_id,
        reasons: score.risk_factors.clone(),
    }
}

/// Emits event when upgrade is performed.
pub fn emit_upgrade_performed(
    env: &Env,
    old_version: u32,
    new_version: u32,
    wasm_hash: &BytesN<32>,
    admin: &Address,
) {
    env.events().publish(
        (symbol_short!("upgraded"), admin.clone()),
        (old_version, new_version, wasm_hash.clone()),
    );
}

/// Emits event when rollback is performed.
pub fn emit_rollback_performed(
    env: &Env,
    current_version: u32,
    rolled_back_version: u32,
    admin: &Address,
) {
    env.events().publish(
        (symbol_short!("rollback"), admin.clone()),
        (current_version, rolled_back_version),
    );
}
