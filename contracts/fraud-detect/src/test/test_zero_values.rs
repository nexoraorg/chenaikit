use super::setup_test_fixture;
use crate::errors::ContractError;
use soroban_sdk::String;

#[test]
fn test_zero_amount_rejected() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "transfer");

    // Zero amount must be rejected with InvalidAmount error
    let result = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &0i128,
        &tx_type,
    );

    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidAmount);
}

#[test]
fn test_zero_velocity_threshold_rejected_in_config() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();
    config.velocity_threshold = 0; // Invalid: must be >= 1

    let result = fixture.client.try_update_config(&fixture.admin, &config);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidThreshold);
}

#[test]
fn test_zero_velocity_window_rejected_in_config() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();
    config.velocity_window = 0; // Invalid: must be >= 10 seconds

    let result = fixture.client.try_update_config(&fixture.admin, &config);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidWindow);
}

#[test]
fn test_zero_max_single_amount_rejected_in_config() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();
    config.max_single_amount = 0; // Invalid: must be >= 1

    let result = fixture.client.try_update_config(&fixture.admin, &config);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, ContractError::InvalidAmount);
}

#[test]
fn test_zero_risk_score_threshold_accepted() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();
    config.risk_score_threshold = 0; // Valid edge case: all scored transactions trigger alert

    let result = fixture.client.try_update_config(&fixture.admin, &config);
    assert!(result.is_ok());

    let updated = fixture.client.get_config();
    assert_eq!(updated.risk_score_threshold, 0);
}

#[test]
fn test_zero_history_user_returns_zero_risk_score() {
    let fixture = setup_test_fixture();
    // User with no transactions should have risk score of 0
    let score = fixture.client.get_risk_score(&fixture.user);
    assert_eq!(score, 0);
}

#[test]
fn test_zero_history_user_returns_empty_history() {
    let fixture = setup_test_fixture();
    let history = fixture.client.get_transaction_history(&fixture.user);
    assert_eq!(history.len(), 0);
}

#[test]
fn test_zero_history_user_returns_empty_indicators() {
    let fixture = setup_test_fixture();
    let indicators = fixture.client.get_indicators(&fixture.user);
    assert_eq!(indicators.len(), 0);
}

#[test]
fn test_zero_amount_validation_function_directly() {
    use crate::validation::validate_amount;
    assert_eq!(validate_amount(0), Err(ContractError::InvalidAmount));
    assert_eq!(validate_amount(1), Ok(()));
}

#[test]
fn test_zero_timestamp_validation_directly() {
    use crate::validation::validate_timestamp;
    assert_eq!(
        validate_timestamp(0, 1000),
        Err(ContractError::InvalidTimestamp)
    );
    assert_eq!(validate_timestamp(1, 1000), Ok(()));
}
