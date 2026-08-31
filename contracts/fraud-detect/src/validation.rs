//! Input boundary validation and rejection semantics engine.
//!
//! Enforces strict bounds checking across numeric, temporal, and string parameters
//! to prevent malformed or out-of-range inputs from entering or modifying contract state.

use crate::errors::ContractError;
use crate::types::FraudConfig;
use soroban_sdk::String;

/// Minimum allowable transaction amount (base units).
pub const MIN_VALID_AMOUNT: i128 = 1;

/// Maximum allowable transaction amount (base units) ~ 100 million tokens with 18 decimals.
pub const MAX_VALID_AMOUNT: i128 = 100_000_000_000_000_000_000_000_000;

/// Minimum velocity threshold (must be at least 1 tx).
pub const MIN_VELOCITY_THRESHOLD: u32 = 1;

/// Maximum velocity threshold allowable in configuration.
pub const MAX_VELOCITY_THRESHOLD: u32 = 10_000;

/// Minimum velocity window in seconds (10 seconds).
pub const MIN_VELOCITY_WINDOW: u64 = 10;

/// Maximum velocity window in seconds (1 year = 31,536,000 seconds).
pub const MAX_VELOCITY_WINDOW: u64 = 31_536_000;

/// Maximum risk score bound (scores are normalized 0..=100).
pub const MAX_SCORE_BOUND: u32 = 100;

/// Maximum allowable byte length for transaction type string.
pub const MAX_TX_TYPE_LEN: u32 = 64;

/// Maximum history entries retained per account before eviction.
pub const MAX_HISTORY_CAPACITY: u32 = 1_000;

/// Maximum allowable future timestamp drift (5 minutes clock skew allowance).
pub const MAX_FUTURE_SKEW_SECONDS: u64 = 300;

/// Validates that a numeric transaction amount strictly satisfies boundary constraints:
/// - Must not be zero.
/// - Must not be negative.
/// - Must not exceed `MAX_VALID_AMOUNT`.
pub fn validate_amount(amount: i128) -> Result<(), ContractError> {
    if amount < MIN_VALID_AMOUNT {
        return Err(ContractError::InvalidAmount);
    }
    if amount > MAX_VALID_AMOUNT {
        return Err(ContractError::InvalidAmount);
    }
    Ok(())
}

/// Validates that a transaction type descriptor is well-formed:
/// - Must not be empty.
/// - Must not exceed `MAX_TX_TYPE_LEN` characters.
pub fn validate_transaction_type(tx_type: &String) -> Result<(), ContractError> {
    let len = tx_type.len();
    if len == 0 {
        return Err(ContractError::EmptyString);
    }
    if len > MAX_TX_TYPE_LEN {
        return Err(ContractError::StringTooLong);
    }
    Ok(())
}

/// Validates all parameters of a `FraudConfig` against hard boundary limits.
pub fn validate_config(config: &FraudConfig) -> Result<(), ContractError> {
    if config.velocity_threshold < MIN_VELOCITY_THRESHOLD
        || config.velocity_threshold > MAX_VELOCITY_THRESHOLD
    {
        return Err(ContractError::InvalidThreshold);
    }

    if config.velocity_window < MIN_VELOCITY_WINDOW || config.velocity_window > MAX_VELOCITY_WINDOW
    {
        return Err(ContractError::InvalidWindow);
    }

    if config.max_single_amount < MIN_VALID_AMOUNT || config.max_single_amount > MAX_VALID_AMOUNT {
        return Err(ContractError::InvalidAmount);
    }

    if config.risk_score_threshold > MAX_SCORE_BOUND {
        return Err(ContractError::InvalidScore);
    }

    if config.anomaly_threshold < 0 || config.anomaly_threshold > 10_000 {
        return Err(ContractError::InvalidThreshold);
    }

    Ok(())
}

/// Validates that a score value is clamped within 0..=100.
pub fn validate_score(score: u32) -> Result<(), ContractError> {
    if score > MAX_SCORE_BOUND {
        return Err(ContractError::InvalidScore);
    }
    Ok(())
}

/// Validates that a timestamp does not exceed reasonable ledger time bounds.
pub fn validate_timestamp(timestamp: u64, current_ledger_time: u64) -> Result<(), ContractError> {
    if timestamp == 0 {
        return Err(ContractError::InvalidTimestamp);
    }
    let max_future = current_ledger_time.saturating_add(MAX_FUTURE_SKEW_SECONDS);
    if timestamp > max_future {
        return Err(ContractError::InvalidTimestamp);
    }
    Ok(())
}
