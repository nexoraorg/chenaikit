//! Fraud detection validation and boundary test suite.

use crate::{Contract, ContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

pub mod test_boundary_config;
pub mod test_concurrency_sim;
pub mod test_events_validation;
pub mod test_indicator_bounds;
pub mod test_malformed_inputs;
pub mod test_maximum_values;
pub mod test_patterns_boundary;
pub mod test_scoring_bounds;
pub mod test_state_rejection;
pub mod test_upgrade_boundary;
pub mod test_zero_values;

/// Test fixture providing an initialized environment and test client.
pub struct TestFixture<'a> {
    pub env: Env,
    pub client: ContractClient<'a>,
    pub admin: Address,
    pub user: Address,
    pub from_addr: Address,
    pub to_addr: Address,
}

pub fn setup_test_fixture() -> TestFixture<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let from_addr = Address::generate(&env);
    let to_addr = Address::generate(&env);

    client.initialize(&admin);

    TestFixture {
        env,
        client,
        admin,
        user,
        from_addr,
        to_addr,
    }
}

#[test]
fn test_contract_ping() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    assert!(client.ping());
}

#[test]
fn test_contract_initialization_state() {
    let fixture = setup_test_fixture();
    let config = fixture.client.get_config();
    assert_eq!(config.velocity_threshold, 10);
    assert_eq!(config.velocity_window, 3600);
    assert_eq!(config.max_single_amount, 10000);
    assert_eq!(config.risk_score_threshold, 70);
    assert_eq!(config.anomaly_threshold, 80);
    assert_eq!(fixture.client.get_version(), 1);
}

#[test]
fn test_prevent_double_initialization() {
    let fixture = setup_test_fixture();
    let second_admin = Address::generate(&fixture.env);
    let result = fixture.client.try_initialize(&second_admin);
    assert!(result.is_err());
}
