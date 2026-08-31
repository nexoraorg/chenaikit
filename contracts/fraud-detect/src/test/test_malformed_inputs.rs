//! Validation tests for malformed, negative, and invalid structured inputs.

use super::setup_test_fixture;
use crate::errors::ContractError;
use soroban_sdk::String;

#[test]
fn test_negative_amount_minus_one_rejected() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "transfer");

    let result = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &-1i128,
        &tx_type,
    );

    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidAmount);
}

#[test]
fn test_negative_amount_large_rejected() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "transfer");

    let result = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &-50_000_000i128,
        &tx_type,
    );

    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidAmount);
}

#[test]
fn test_i128_min_negative_amount_rejected() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "transfer");

    let result = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &i128::MIN,
        &tx_type,
    );

    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidAmount);
}

#[test]
fn test_empty_string_transaction_type_rejected() {
    let fixture = setup_test_fixture();
    let empty_type = String::from_str(&fixture.env, "");

    let result = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &100i128,
        &empty_type,
    );

    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::EmptyString);
}

#[test]
fn test_negative_anomaly_threshold_in_config_rejected() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();
    config.anomaly_threshold = -1; // Negative is malformed

    let result = fixture.client.try_update_config(&fixture.admin, &config);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidThreshold);
}

#[test]
fn test_excessive_anomaly_threshold_in_config_rejected() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();
    config.anomaly_threshold = 10_001; // Limit is 10,000

    let result = fixture.client.try_update_config(&fixture.admin, &config);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidThreshold);
}

#[test]
fn test_bounds_inventory_matches_contract_constants() {
    let fixture = setup_test_fixture();
    let bounds = fixture.client.get_bounds_inventory();

    assert_eq!(bounds.min_amount, 1);
    assert_eq!(bounds.max_amount, 100_000_000_000_000_000_000_000_000);
    assert_eq!(bounds.min_velocity_threshold, 1);
    assert_eq!(bounds.max_velocity_threshold, 10_000);
    assert_eq!(bounds.min_velocity_window, 10);
    assert_eq!(bounds.max_velocity_window, 31_536_000);
    assert_eq!(bounds.max_score, 100);
    assert_eq!(bounds.max_tx_type_len, 64);
    assert_eq!(bounds.max_history_capacity, 1000);
}
