use crate::patterns::PatternMatch;
use crate::risk_scorer::RiskScore;
use crate::storage::TransactionRecord;
use soroban_sdk::{symbol_short, Address, Env, String, Symbol, Vec};

const TOPIC_FRAUD_ALERT: Symbol = symbol_short!("fraud_al");
const TOPIC_RISK_SCORE: Symbol = symbol_short!("risk_scr");
const TOPIC_PATTERN_DETECTED: Symbol = symbol_short!("pattern");
const TOPIC_BLACKLIST_UPDATE: Symbol = symbol_short!("blk_upd");
const TOPIC_WHITELIST_UPDATE: Symbol = symbol_short!("wht_upd");
const TOPIC_CONFIG_UPDATE: Symbol = symbol_short!("cfg_upd");
const TOPIC_ANOMALY_DETECTED: Symbol = symbol_short!("anomaly");
const TOPIC_TRANSACTION_ANALYZED: Symbol = symbol_short!("tx_anlz");

#[derive(Clone)]
pub struct FraudAlertData {
    pub user: Address,
    pub risk_score: u32,
    pub alert_level: AlertLevel,
    pub timestamp: u64,
    pub transaction_id: u64,
    pub reasons: Vec<String>,
}

#[derive(Clone)]
pub enum AlertLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl AlertLevel {
    pub fn from_score(score: u32) -> Self {
        if score >= 80 {
            AlertLevel::Critical
        } else if score >= 60 {
            AlertLevel::High
        } else if score >= 40 {
            AlertLevel::Medium
        } else {
            AlertLevel::Low
        }
    }

    pub fn to_u32(&self) -> u32 {
        match self {
            AlertLevel::Low => 1,
            AlertLevel::Medium => 2,
            AlertLevel::High => 3,
            AlertLevel::Critical => 4,
        }
    }
}

pub fn emit_fraud_alert(env: &Env, alert_data: &FraudAlertData) {
    let alert_level_u32 = alert_data.alert_level.to_u32();

    let event_data = (
        alert_data.user.clone(),
        alert_data.risk_score,
        alert_level_u32,
        alert_data.timestamp,
        alert_data.transaction_id,
    );

    env.events().publish((TOPIC_FRAUD_ALERT,), event_data);

    for (i, reason) in alert_data.reasons.iter().enumerate() {
        env.events().publish(
            (TOPIC_FRAUD_ALERT, symbol_short!("reason"), i as u32),
            reason.clone(),
        );
    }
}

pub fn emit_risk_score_calculated(
    env: &Env,
    user: &Address,
    risk_score: &RiskScore,
    transaction_id: u64,
) {
    env.events().publish(
        (TOPIC_RISK_SCORE,),
        (
            user.clone(),
            risk_score.total_score,
            risk_score.velocity_score,
            risk_score.amount_score,
            risk_score.timing_score,
            risk_score.pattern_score,
            risk_score.historical_score,
            transaction_id,
        ),
    );

    for (i, factor) in risk_score.risk_factors.iter().enumerate() {
        env.events().publish(
            (TOPIC_RISK_SCORE, symbol_short!("factor"), i as u32),
            factor.clone(),
        );
    }
}

pub fn emit_pattern_detected(
    env: &Env,
    user: &Address,
    pattern: &PatternMatch,
    transaction_id: u64,
) {
    let pattern_type_u32: u32 = match pattern.pattern_type {
        crate::patterns::PatternType::HighVelocity => 1,
        crate::patterns::PatternType::UnusualAmount => 2,
        crate::patterns::PatternType::RoundNumberAmount => 3,
        crate::patterns::PatternType::RapidSuccession => 4,
        crate::patterns::PatternType::CircularTransactions => 5,
        crate::patterns::PatternType::SuspiciousTiming => 6,
        crate::patterns::PatternType::AddressRepetition => 7,
    };

    env.events().publish(
        (TOPIC_PATTERN_DETECTED,),
        (
            user.clone(),
            pattern_type_u32,
            pattern.confidence,
            pattern.description.clone(),
            transaction_id,
        ),
    );

    for (i, tx_timestamp) in pattern.related_transactions.iter().enumerate() {
        env.events().publish(
            (TOPIC_PATTERN_DETECTED, symbol_short!("rel_tx"), i as u32),
            tx_timestamp,
        );
    }
}

pub fn emit_blacklist_updated(
    env: &Env,
    address: &Address,
    added: bool,
    timestamp: u64,
    updated_by: &Address,
) {
    env.events().publish(
        (TOPIC_BLACKLIST_UPDATE,),
        (address.clone(), added, timestamp, updated_by.clone()),
    );
}

pub fn emit_whitelist_updated(
    env: &Env,
    address: &Address,
    added: bool,
    timestamp: u64,
    updated_by: &Address,
) {
    env.events().publish(
        (TOPIC_WHITELIST_UPDATE,),
        (address.clone(), added, timestamp, updated_by.clone()),
    );
}

pub fn emit_config_updated(
    env: &Env,
    velocity_threshold: u32,
    velocity_window: u64,
    max_amount: i128,
    risk_score_threshold: u32,
    anomaly_threshold: i64,
    updated_by: &Address,
) {
    env.events().publish(
        (TOPIC_CONFIG_UPDATE,),
        (
            velocity_threshold,
            velocity_window,
            max_amount,
            risk_score_threshold,
            anomaly_threshold,
            updated_by.clone(),
        ),
    );
}

pub fn emit_anomaly_detected(
    env: &Env,
    user: &Address,
    is_anomalous: bool,
    anomaly_score: i64,
    deviation_factors: &Vec<String>,
    transaction_id: u64,
) {
    env.events().publish(
        (TOPIC_ANOMALY_DETECTED,),
        (user.clone(), is_anomalous, anomaly_score, transaction_id),
    );

    for (i, factor) in deviation_factors.iter().enumerate() {
        env.events().publish(
            (TOPIC_ANOMALY_DETECTED, symbol_short!("factor"), i as u32),
            factor.clone(),
        );
    }
}

pub fn emit_transaction_analyzed(
    env: &Env,
    user: &Address,
    transaction: &TransactionRecord,
    risk_score: u32,
    is_flagged: bool,
    transaction_id: u64,
) {
    env.events().publish(
        (TOPIC_TRANSACTION_ANALYZED,),
        (
            user.clone(),
            transaction.from_address.clone(),
            transaction.to_address.clone(),
            transaction.amount,
            transaction.timestamp,
            transaction.transaction_type.clone(),
            risk_score,
            is_flagged,
            transaction_id,
        ),
    );
}

#[allow(dead_code)]
pub fn emit_batch_analysis_complete(
    env: &Env,
    user: &Address,
    transactions_analyzed: u32,
    total_risk_score: u32,
    alerts_generated: u32,
    analysis_timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("batch_an"),),
        (
            user.clone(),
            transactions_analyzed,
            total_risk_score,
            alerts_generated,
            analysis_timestamp,
        ),
    );
}

#[allow(dead_code)]
pub fn emit_model_updated(
    env: &Env,
    model_version: u32,
    update_type: String,
    updated_by: &Address,
    timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("model_up"),),
        (
            model_version,
            update_type.clone(),
            updated_by.clone(),
            timestamp,
        ),
    );
}

#[allow(dead_code)]
pub fn emit_threshold_breached(
    env: &Env,
    user: &Address,
    threshold_type: String,
    current_value: u32,
    threshold_value: u32,
    transaction_id: u64,
) {
    env.events().publish(
        (symbol_short!("thresh_br"),),
        (
            user.clone(),
            threshold_type.clone(),
            current_value,
            threshold_value,
            transaction_id,
        ),
    );
}

#[allow(dead_code)]
pub fn emit_system_status(env: &Env, status: String, details: String, timestamp: u64) {
    env.events().publish(
        (symbol_short!("sys_stat"),),
        (status.clone(), details.clone(), timestamp),
    );
}

pub fn create_fraud_alert(
    env: &Env,
    user: &Address,
    risk_score: &RiskScore,
    _transaction: &TransactionRecord,
    transaction_id: u64,
) -> FraudAlertData {
    let alert_level = AlertLevel::from_score(risk_score.total_score);
    let current_time = env.ledger().timestamp();

    FraudAlertData {
        user: user.clone(),
        risk_score: risk_score.total_score,
        alert_level,
        timestamp: current_time,
        transaction_id,
        reasons: risk_score.risk_factors.clone(),
    }
}

#[allow(dead_code)]
pub fn log_analysis_metrics(
    env: &Env,
    analysis_duration_ms: u64,
    patterns_checked: u32,
    risk_calculations: u32,
    storage_operations: u32,
) {
    env.events().publish(
        (symbol_short!("metrics"),),
        (
            analysis_duration_ms,
            patterns_checked,
            risk_calculations,
            storage_operations,
        ),
    );
}
