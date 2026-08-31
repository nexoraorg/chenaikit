//! Tests for configuration parameter boundaries, limits, and administrator authorization.

use super::setup_test_fixture;
use crate::errors::ContractError;
use soroban_sdk::{testutils::Address as _, Address};

#[test]
fn test_velocity_threshold_boundaries() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();

    // Bound 0: rejected
    config.velocity_threshold = 0;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_err());

    // Bound 1: accepted
    config.velocity_threshold = 1;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_ok());
    assert_eq!(fixture.client.get_config().velocity_threshold, 1);

    // Bound 10,000: accepted
    config.velocity_threshold = 10_000;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_ok());
    assert_eq!(fixture.client.get_config().velocity_threshold, 10_000);

    // Bound 10,001: rejected
    config.velocity_threshold = 10_001;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_err());
}

#[test]
fn test_velocity_window_boundaries() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();

    // Bound 9: rejected (below 10s minimum)
    config.velocity_window = 9;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_err());

    // Bound 10: accepted
    config.velocity_window = 10;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_ok());
    assert_eq!(fixture.client.get_config().velocity_window, 10);

    // Bound 31,536,000 (1 year): accepted
    config.velocity_window = 31_536_000;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_ok());
    assert_eq!(fixture.client.get_config().velocity_window, 31_536_000);

    // Bound 31,536,001: rejected
    config.velocity_window = 31_536_001;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_err());
}

#[test]
fn test_risk_score_threshold_boundaries() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();

    // 0: accepted
    config.risk_score_threshold = 0;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_ok());

    // 100: accepted
    config.risk_score_threshold = 100;
    assert!(fixture
        .client
        .try_update_config(&fixture.admin, &config)
        .is_ok());

    // 101: rejected
    config.risk_score_threshold = 101;
    let res = fixture.client.try_update_config(&fixture.admin, &config);
    assert!(res.is_err());
    assert_eq!(res.unwrap_err().unwrap(), ContractError::InvalidScore);
}

#[test]
fn test_non_admin_cannot_update_config() {
    let fixture = setup_test_fixture();
    let unauthorized = Address::generate(&fixture.env);
    let config = fixture.client.get_config();

    let result = fixture.client.try_update_config(&unauthorized, &config);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().unwrap(), ContractError::NotAuthorized);
}

#[test]
fn test_non_admin_cannot_modify_blacklist() {
    let fixture = setup_test_fixture();
    let unauthorized = Address::generate(&fixture.env);
    let target = Address::generate(&fixture.env);

    let result = fixture.client.try_add_to_blacklist(&unauthorized, &target);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().unwrap(), ContractError::NotAuthorized);
}

#[test]
fn test_non_admin_cannot_modify_whitelist() {
    let fixture = setup_test_fixture();
    let unauthorized = Address::generate(&fixture.env);
    let target = Address::generate(&fixture.env);

    let result = fixture.client.try_add_to_whitelist(&unauthorized, &target);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().unwrap(), ContractError::NotAuthorized);
}
