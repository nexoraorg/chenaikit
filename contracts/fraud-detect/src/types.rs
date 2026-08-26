//! Data structures, domain entities, and value objects for the fraud detection contract.

use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

/// Represents an individual recorded transaction in user history.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransactionRecord {
    /// Ledger timestamp when the transaction was analyzed.
    pub timestamp: u64,
    /// Transaction amount in base units (strictly positive).
    pub amount: i128,
    /// Originating sender address.
    pub from_address: Address,
    /// Beneficiary destination address.
    pub to_address: Address,
    /// Transaction classification tag or operation type.
    pub transaction_type: String,
}

/// Operational configuration defining boundary thresholds for anomaly and risk calculation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FraudConfig {
    /// Max allowable transactions within velocity window before triggering alert.
    pub velocity_threshold: u32,
    /// Time window in seconds for velocity evaluation.
    pub velocity_window: u64,
    /// Threshold amount above which unusual amount scoring activates.
    pub max_single_amount: i128,
    /// Total risk score threshold (0-100) above which a fraud alert is emitted.
    pub risk_score_threshold: u32,
    /// Anomaly deviation threshold above which an anomaly alert is emitted.
    pub anomaly_threshold: i64,
}

impl Default for FraudConfig {
    fn default() -> Self {
        Self {
            velocity_threshold: 10,
            velocity_window: 3600,
            max_single_amount: 10_000,
            risk_score_threshold: 70,
            anomaly_threshold: 80,
        }
    }
}

/// Identifies heuristic pattern types recognized by the contract.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PatternType {
    HighVelocity = 1,
    UnusualAmount = 2,
    RoundNumberAmount = 3,
    RapidSuccession = 4,
    CircularTransactions = 5,
    SuspiciousTiming = 6,
    AddressRepetition = 7,
}

/// Details of a detected heuristic pattern match.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PatternMatch {
    pub pattern_type: PatternType,
    pub confidence: i64,
    pub description: String,
    pub related_transactions: Vec<u64>,
}

/// Aggregated breakdown of risk scoring dimensions.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RiskScore {
    pub total_score: u32,
    pub velocity_score: u32,
    pub amount_score: u32,
    pub timing_score: u32,
    pub pattern_score: u32,
    pub historical_score: u32,
    pub risk_factors: Vec<String>,
}

/// Output from statistical anomaly detection.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnomalyDetection {
    pub is_anomalous: bool,
    pub anomaly_score: i64,
    pub deviation_factors: Vec<String>,
}

/// Severity classification for fraud alert notifications.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum AlertLevel {
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4,
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
}

/// Structured fraud alert event payload.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FraudAlertData {
    pub user: Address,
    pub risk_score: u32,
    pub alert_level: AlertLevel,
    pub timestamp: u64,
    pub transaction_id: u64,
    pub reasons: Vec<String>,
}

/// Audit record for contract WASM upgrade migrations.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeRecord {
    pub from_version: u32,
    pub to_version: u32,
    pub wasm_hash: BytesN<32>,
    pub timestamp: u64,
    pub executor: Address,
    pub migration_notes: String,
}

/// Public inventory of contract input constraints and boundary limits.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InputBoundsInventory {
    pub min_amount: i128,
    pub max_amount: i128,
    pub min_velocity_threshold: u32,
    pub max_velocity_threshold: u32,
    pub min_velocity_window: u64,
    pub max_velocity_window: u64,
    pub max_score: u32,
    pub max_tx_type_len: u32,
    pub max_history_capacity: u32,
}
