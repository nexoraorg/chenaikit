//! Tests for indicator string generation under boundary conditions.

use super::setup_test_fixture;
use soroban_sdk::String;

#[test]
fn test_blacklisted_indicator_priority() {
    let fixture = setup_test_fixture();
    fixture
        .client
        .add_to_blacklist(&fixture.admin, &fixture.user);

    let indicators = fixture.client.get_indicators(&fixture.user);
    assert_eq!(indicators.len(), 1);
    assert_eq!(
        indicators.get(0).unwrap(),
        String::from_str(&fixture.env, "Account is blacklisted")
    );
}

#[test]
fn test_whitelisted_indicator_priority() {
    let fixture = setup_test_fixture();
    fixture
        .client
        .add_to_whitelist(&fixture.admin, &fixture.user);

    let indicators = fixture.client.get_indicators(&fixture.user);
    assert_eq!(indicators.len(), 1);
    assert_eq!(
        indicators.get(0).unwrap(),
        String::from_str(&fixture.env, "Account is verified whitelisted")
    );
}

#[test]
fn test_circular_transaction_indicator() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "circular");

    // tx1: user -> to_addr
    fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.user,
        &fixture.to_addr,
        &1000,
        &tx_type,
    );

    // tx2: to_addr -> user (circular)
    fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.to_addr,
        &fixture.user,
        &1000,
        &tx_type,
    );

    let indicators = fixture.client.get_indicators(&fixture.user);
    let mut found_circular = false;
    for ind in indicators.iter() {
        if ind
            == String::from_str(
                &fixture.env,
                "Circular transaction cycle detected between parties",
            )
        {
            found_circular = true;
            break;
        }
    }
    assert!(found_circular, "Circular transaction indicator expected");
}
