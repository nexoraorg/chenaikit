use crate::{FraudDetectContract, FraudDetectContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Verify config was set with defaults
    let config = client.get_config();
    assert_eq!(config.0, 10); // velocity_threshold
    assert_eq!(config.1, 3600); // velocity_window
    assert_eq!(config.2, 10000i128); // max_single_amount
    assert_eq!(config.3, 70); // risk_score_threshold
    assert_eq!(config.4, 80); // anomaly_threshold
}

#[test]
fn test_basic_transaction_analysis() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let from_addr = Address::generate(&env);
    let to_addr = Address::generate(&env);

    client.initialize(&admin);

    let risk_score = client.analyze_transaction(
        &user,
        &from_addr,
        &to_addr,
        &100i128,
        &String::from_str(&env, "transfer"),
    );

    assert!(risk_score < 50); // Should be low risk for normal transaction
}

#[test]
fn test_blacklist_functionality() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let from_addr = Address::generate(&env);
    let to_addr = Address::generate(&env);

    client.initialize(&admin);

    // Initially not blacklisted
    assert!(!client.is_blacklisted(&user));

    // Add to blacklist
    client.add_to_blacklist(&admin, &user);
    assert!(client.is_blacklisted(&user));

    // Blacklisted user should get maximum risk score
    let risk_score = client.analyze_transaction(
        &user,
        &from_addr,
        &to_addr,
        &100i128,
        &String::from_str(&env, "transfer"),
    );

    assert_eq!(risk_score, 100); // Maximum risk for blacklisted users

    // Remove from blacklist
    client.remove_from_blacklist(&admin, &user);
    assert!(!client.is_blacklisted(&user));
}

#[test]
fn test_whitelist_functionality() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let from_addr = Address::generate(&env);
    let to_addr = Address::generate(&env);

    client.initialize(&admin);

    // Initially not whitelisted
    assert!(!client.is_whitelisted(&user));

    // Add to whitelist
    client.add_to_whitelist(&admin, &user);
    assert!(client.is_whitelisted(&user));

    // Whitelisted user should get zero risk score
    let risk_score = client.analyze_transaction(
        &user,
        &from_addr,
        &to_addr,
        &50000i128, // Even large amount
        &String::from_str(&env, "large_transfer"),
    );

    assert_eq!(risk_score, 0); // Zero risk for whitelisted users
}

#[test]
fn test_config_update() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Update configuration
    client.update_config(
        &admin, &20,        // velocity_threshold
        &7200,      // velocity_window
        &20000i128, // max_single_amount
        &80,        // risk_score_threshold
        &90,        // anomaly_threshold
    );

    let config = client.get_config();
    assert_eq!(config.0, 20); // velocity_threshold
    assert_eq!(config.1, 7200); // velocity_window
    assert_eq!(config.2, 20000i128); // max_single_amount
    assert_eq!(config.3, 80); // risk_score_threshold
    assert_eq!(config.4, 90); // anomaly_threshold
}

#[test]
fn test_large_amount_detection() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let from_addr = Address::generate(&env);
    let to_addr = Address::generate(&env);

    client.initialize(&admin);

    // Make a large transaction
    let risk_score = client.analyze_transaction(
        &user,
        &from_addr,
        &to_addr,
        &50000i128, // Much larger than default max of 10000
        &String::from_str(&env, "large_transfer"),
    );

    assert!(risk_score >= 30); // Should detect unusual amount
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialization_prevention() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Second initialization should fail
    client.initialize(&admin);
}
