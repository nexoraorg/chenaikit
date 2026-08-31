//! Invariant tests ensuring that rejected/malformed inputs cannot advance contract state.

use super::setup_test_fixture;
use soroban_sdk::String;

#[test]
fn test_rejected_amount_does_not_advance_history() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "transfer");

    // Attempt malformed transaction with 0 amount
    let _ = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &0,
        &tx_type,
    );

    // Verify history remains untouched and empty
    let history = fixture.client.get_transaction_history(&fixture.user);
    assert_eq!(history.len(), 0);

    // Verify risk score remains 0
    let score = fixture.client.get_risk_score(&fixture.user);
    assert_eq!(score, 0);
}

#[test]
fn test_rejected_negative_amount_does_not_advance_history() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "transfer");

    // Attempt negative amount
    let _ = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &-500,
        &tx_type,
    );

    let history = fixture.client.get_transaction_history(&fixture.user);
    assert_eq!(history.len(), 0);
}

#[test]
fn test_rejected_empty_tx_type_does_not_advance_history() {
    let fixture = setup_test_fixture();
    let empty_type = String::from_str(&fixture.env, "");

    let _ = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &1000,
        &empty_type,
    );

    let history = fixture.client.get_transaction_history(&fixture.user);
    assert_eq!(history.len(), 0);
}

#[test]
fn test_blacklisted_user_does_not_pollute_history() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "transfer");

    fixture
        .client
        .add_to_blacklist(&fixture.admin, &fixture.user);
    assert!(fixture.client.is_blacklisted(&fixture.user));

    // Calling analyze on blacklisted user returns max score 100
    let score = fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &100,
        &tx_type,
    );
    assert_eq!(score, 100);

    // State invariant: History should remain empty for blacklisted transactions
    let history = fixture.client.get_transaction_history(&fixture.user);
    assert_eq!(history.len(), 0);
}

#[test]
fn test_whitelisted_user_advances_history_with_zero_risk() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "safe_transfer");

    fixture
        .client
        .add_to_whitelist(&fixture.admin, &fixture.user);
    assert!(fixture.client.is_whitelisted(&fixture.user));

    let score = fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &50_000,
        &tx_type,
    );
    assert_eq!(score, 0);

    let history = fixture.client.get_transaction_history(&fixture.user);
    assert_eq!(history.len(), 1);
    assert_eq!(history.get(0).unwrap().amount, 50_000);
}

#[test]
fn test_clear_user_history_state_reversion() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "transfer");

    fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &100,
        &tx_type,
    );
    assert_eq!(
        fixture.client.get_transaction_history(&fixture.user).len(),
        1
    );

    fixture
        .client
        .clear_user_history(&fixture.admin, &fixture.user);
    assert_eq!(
        fixture.client.get_transaction_history(&fixture.user).len(),
        0
    );
}
