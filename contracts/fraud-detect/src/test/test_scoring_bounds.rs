//! Tests verifying that risk scores remain bounded within 0..=100 under all conditions.

use super::setup_test_fixture;
use soroban_sdk::String;

#[test]
fn test_risk_score_never_exceeds_100() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "round_burst");

    // Perform many round-number high-amount transactions in rapid succession
    for _ in 0..15 {
        let score = fixture.client.analyze_transaction(
            &fixture.user,
            &fixture.from_addr,
            &fixture.to_addr,
            &50_000, // Round amount above default max_single_amount of 10000
            &tx_type,
        );
        assert!(score <= 100, "Score {} exceeded 100", score);
    }

    let final_score = fixture.client.get_risk_score(&fixture.user);
    assert!(final_score <= 100);
}

#[test]
fn test_low_risk_transaction_scoring() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "grocery");

    // Normal modest transaction
    let score = fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &50,
        &tx_type,
    );

    // Normal single modest transaction should have a low risk score
    assert!(score < 40, "Expected low score, got {}", score);
}

#[test]
fn test_large_amount_elevates_score() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "large_purchase");

    // Amount substantially above default max_single_amount (10,000)
    let score = fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &100_000,
        &tx_type,
    );

    assert!(
        score >= 30,
        "Large amount should elevate score, got {}",
        score
    );
}
