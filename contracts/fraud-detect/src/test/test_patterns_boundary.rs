//! Tests for boundary behavior in pattern recognition heuristics.

use super::setup_test_fixture;
use soroban_sdk::String;

#[test]
fn test_round_number_pattern_detection() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "round_test");

    // 10,000 is a round number (divisible by 1000)
    fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &10_000,
        &tx_type,
    );

    let indicators = fixture.client.get_indicators(&fixture.user);
    let mut found_round = false;
    for ind in indicators.iter() {
        if ind == String::from_str(&fixture.env, "Round number amount detected") {
            found_round = true;
            break;
        }
    }
    assert!(found_round, "Round number indicator expected");
}

#[test]
fn test_non_round_number_pattern() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "odd_amount");

    // 9,999 is not divisible by 1000
    fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &9_999,
        &tx_type,
    );

    let indicators = fixture.client.get_indicators(&fixture.user);
    let mut found_round = false;
    for ind in indicators.iter() {
        if ind == String::from_str(&fixture.env, "Round number amount detected") {
            found_round = true;
            break;
        }
    }
    assert!(!found_round, "Round number indicator should not be present");
}

#[test]
fn test_velocity_pattern_triggers_at_threshold() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "velocity_test");

    // Default velocity threshold is 10 transactions
    for _ in 0..10 {
        fixture.client.analyze_transaction(
            &fixture.user,
            &fixture.from_addr,
            &fixture.to_addr,
            &100,
            &tx_type,
        );
    }

    let indicators = fixture.client.get_indicators(&fixture.user);
    let mut found_velocity = false;
    for ind in indicators.iter() {
        if ind
            == String::from_str(
                &fixture.env,
                "High velocity: excessive transactions within time window",
            )
        {
            found_velocity = true;
            break;
        }
    }
    assert!(
        found_velocity,
        "Velocity pattern should trigger at threshold 10"
    );
}

#[test]
fn test_address_repetition_triggers_at_five_transfers() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "repeat_test");

    // 5 transactions to the exact same to_addr
    for _ in 0..5 {
        fixture.client.analyze_transaction(
            &fixture.user,
            &fixture.from_addr,
            &fixture.to_addr,
            &150,
            &tx_type,
        );
    }

    let indicators = fixture.client.get_indicators(&fixture.user);
    let mut found_repetition = false;
    for ind in indicators.iter() {
        if ind
            == String::from_str(
                &fixture.env,
                "Address repetition: concentrated transactions to single counterparty",
            )
        {
            found_repetition = true;
            break;
        }
    }
    assert!(
        found_repetition,
        "Address repetition should trigger at 5 transfers"
    );
}
