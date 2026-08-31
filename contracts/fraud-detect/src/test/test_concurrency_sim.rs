//! Simulation tests for concurrent and burst transaction patterns in identical blocks.

use super::setup_test_fixture;
use soroban_sdk::String;

#[test]
fn test_same_block_multiple_transactions() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "burst_tx");

    // Submit multiple transactions with the exact same timestamp
    for i in 1..=5 {
        let score = fixture.client.analyze_transaction(
            &fixture.user,
            &fixture.from_addr,
            &fixture.to_addr,
            &(i * 200),
            &tx_type,
        );
        assert!(score <= 100);
    }

    let history = fixture.client.get_transaction_history(&fixture.user);
    assert_eq!(history.len(), 5);
}

#[test]
fn test_alternating_whitelisted_and_normal_transactions() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "alt_tx");

    // First transaction when normal
    let score1 = fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &500,
        &tx_type,
    );
    assert!(score1 < 40);

    // Whitelist user
    fixture
        .client
        .add_to_whitelist(&fixture.admin, &fixture.user);

    let score2 = fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &500,
        &tx_type,
    );
    assert_eq!(score2, 0);

    // Remove from whitelist
    fixture
        .client
        .remove_from_whitelist(&fixture.admin, &fixture.user);

    let score3 = fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &500,
        &tx_type,
    );
    assert!(score3 <= 100);

    let history = fixture.client.get_transaction_history(&fixture.user);
    assert_eq!(history.len(), 3);
}
