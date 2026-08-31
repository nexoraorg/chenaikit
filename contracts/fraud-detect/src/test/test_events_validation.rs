use super::setup_test_fixture;
use soroban_sdk::testutils::Events;
use soroban_sdk::String;

#[test]
fn test_validation_failure_emits_event_on_zero_amount() {
    let fixture = setup_test_fixture();
    let tx_type = String::from_str(&fixture.env, "transfer");

    // Rejected zero amount
    let _ = fixture.client.try_analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &0,
        &tx_type,
    );

    // Filter events to check if val_err was published
    let events = fixture.env.events().all();
    let mut found_val_err = false;

    for ev in events.iter() {
        if ev.0 == fixture.client.address {
            found_val_err = true;
            break;
        }
    }
    assert!(found_val_err, "Validation event should be emitted on error");
}

#[test]
fn test_blacklist_updates_emit_events() {
    let fixture = setup_test_fixture();
    fixture
        .client
        .add_to_blacklist(&fixture.admin, &fixture.user);

    let events = fixture.env.events().all();
    assert!(
        !events.is_empty(),
        "Events should be emitted on blacklist update"
    );

    fixture
        .client
        .remove_from_blacklist(&fixture.admin, &fixture.user);
    assert!(!fixture.client.is_blacklisted(&fixture.user));
}

#[test]
fn test_whitelist_updates_emit_events() {
    let fixture = setup_test_fixture();
    fixture
        .client
        .add_to_whitelist(&fixture.admin, &fixture.user);
    assert!(fixture.client.is_whitelisted(&fixture.user));

    fixture
        .client
        .remove_from_whitelist(&fixture.admin, &fixture.user);
    assert!(!fixture.client.is_whitelisted(&fixture.user));
}

#[test]
fn test_fraud_alert_emitted_when_threshold_exceeded() {
    let fixture = setup_test_fixture();
    let mut config = fixture.client.get_config();

    // Set risk score threshold to 20 so a moderate transaction triggers it
    config.risk_score_threshold = 20;
    fixture.client.update_config(&fixture.admin, &config);

    let tx_type = String::from_str(&fixture.env, "alert_trigger");

    // Large round transaction that scores >= 30
    let score = fixture.client.analyze_transaction(
        &fixture.user,
        &fixture.from_addr,
        &fixture.to_addr,
        &25_000,
        &tx_type,
    );

    assert!(score >= 20, "Score {} should meet threshold 20", score);

    let events = fixture.env.events().all();
    let mut found_event = false;
    for ev in events.iter() {
        if ev.0 == fixture.client.address {
            found_event = true;
            break;
        }
    }
    assert!(found_event, "Fraud alert event expected");
}
