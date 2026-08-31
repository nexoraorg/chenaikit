//! Tests for contract upgrade boundaries and authorization.

use super::setup_test_fixture;
use crate::errors::ContractError;
use soroban_sdk::{testutils::Address as _, Address, BytesN};

#[test]
fn test_initial_version_is_one() {
    let fixture = setup_test_fixture();
    assert_eq!(fixture.client.get_version(), 1);
}

#[test]
fn test_initial_upgrade_history_is_empty() {
    let fixture = setup_test_fixture();
    let history = fixture.client.get_upgrade_history();
    assert_eq!(history.len(), 0);
}

#[test]
fn test_unauthorized_upgrade_rejected() {
    let fixture = setup_test_fixture();
    let attacker = Address::generate(&fixture.env);
    let dummy_hash = BytesN::from_array(&fixture.env, &[7u8; 32]);

    let result = fixture.client.try_upgrade(&attacker, &dummy_hash);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().unwrap(), ContractError::NotAuthorized);
}

#[test]
fn test_rollback_without_prior_upgrade_rejected() {
    let fixture = setup_test_fixture();
    let result = fixture.client.try_rollback(&fixture.admin);
    assert!(result.is_err());
    assert_eq!(
        result.unwrap_err().unwrap(),
        ContractError::RollbackNotAvailable
    );
}

#[test]
fn test_unauthorized_rollback_rejected() {
    let fixture = setup_test_fixture();
    let attacker = Address::generate(&fixture.env);

    let result = fixture.client.try_rollback(&attacker);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().unwrap(), ContractError::NotAuthorized);
}
