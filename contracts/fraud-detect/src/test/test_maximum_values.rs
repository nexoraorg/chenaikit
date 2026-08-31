//! Validation tests for maximum boundary bounds and overflow limits.

use super::setup_test_fixture;
use crate::errors::ContractError;
use crate::validation::{
    MAX_SCORE_BOUND, MAX_TX_TYPE_LEN, MAX_VALID_AMOUNT, MAX_VELOCITY_THRESHOLD, MAX_VELOCITY_WINDOW,
};
use soroban_sdk::String;

#[test]
fn test_max_valid_amount_accepted() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "max_transfer");

    let result = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &MAX_VALID_AMOUNT,
        &tx_type,
    );

    assert!(result.is_ok());
    let score = result.unwrap().unwrap();
    assert!(score <= 100);
}

#[test]
fn test_amount_exceeding_max_rejected() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "oversized");

    // MAX_VALID_AMOUNT + 1 must be rejected
    let result = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &(MAX_VALID_AMOUNT + 1),
        &tx_type,
    );

    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidAmount);
}

#[test]
fn test_i128_max_amount_rejected() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "overflow_amount");

    // i128::MAX exceeds MAX_VALID_AMOUNT
    let result = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &i128::MAX,
        &tx_type,
    );

    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidAmount);
}

#[test]
fn test_max_velocity_threshold_boundary() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();

    // Max threshold (10,000) is valid
    config.velocity_threshold = MAX_VELOCITY_THRESHOLD;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_ok());

    // 10,001 is out of bounds
    config.velocity_threshold = MAX_VELOCITY_THRESHOLD + 1;
    let result = fixture.client.try_update_config(&fixture.admin, &config);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidThreshold);
}

#[test]
fn test_max_velocity_window_boundary() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();

    // Max window (31,536,000 = 1 year) is valid
    config.velocity_window = MAX_VELOCITY_WINDOW;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_ok());

    // 31,536,001 is out of bounds
    config.velocity_window = MAX_VELOCITY_WINDOW + 1;
    let result = fixture.client.try_update_config(&fixture.admin, &config);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidWindow);
}

#[test]
fn test_max_risk_score_threshold_boundary() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();

    // 100 is valid
    config.risk_score_threshold = MAX_SCORE_BOUND;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_ok());

    // 101 is invalid
    config.risk_score_threshold = MAX_SCORE_BOUND + 1;
    let result = fixture.client.try_update_config(&fixture.admin, &config);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidScore);
}

#[test]
fn test_max_length_transaction_type_accepted() {
    let fixture = setup_test_fixture();

    // Exactly 64 ASCII bytes
    let exact_64 = String::from_str(
        &fixture.env,
        "1234567890123456789012345678901234567890123456789012345678901234",
    );
    assert_eq!(exact_64.len(), MAX_TX_TYPE_LEN);

    let result = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &500,
        &exact_64,
    );

    assert!(result.is_ok());
}

#[test]
fn test_oversized_transaction_type_rejected() {
    let fixture = setup_test_fixture();

    // 65 bytes string (exceeds MAX_TX_TYPE_LEN of 64)
    let oversized_65 = String::from_str(
        &fixture.env,
        "12345678901234567890123456789012345678901234567890123456789012345",
    );
    assert_eq!(oversized_65.len(), MAX_TX_TYPE_LEN + 1);

    let result = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &500,
        &oversized_65,
    );

    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::StringTooLong);
}

#[test]
fn test_history_capacity_boundary_and_eviction() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "ring_tx");

    // Perform multiple transactions and verify history length expands
    for i in 1..=5 {
        fixture.client.analyze_transaction(
            &fixture.user,
            &fixture.from_addr,
            &fixture.to_addr,
            &(i * 100),
            &tx_type,
        );
    }

    let history = fixture.client.get_transaction_history(&fixture.user);
    assert_eq!(history.len(), 5);
}
