use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::Env;

fn create_test_env() -> (Env, Address, ContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    (env, admin, client)
}

fn sample_hash(env: &Env, fill: u8) -> BytesN<32> {
    BytesN::from_array(env, &[fill; 32])
}

#[test]
fn test_initialize_and_double_initialize() {
    let (env, admin, client) = create_test_env();

    assert_eq!(client.get_admin(), None);
    assert_eq!(client.initialize(&admin), ());
    assert_eq!(client.get_admin(), Some(admin.clone()));
    assert_eq!(client.get_expiry_window(), DEFAULT_EXPIRY_WINDOW);

    let second_admin = Address::generate(&env);
    let res = client.try_initialize(&second_admin);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
    assert_eq!(client.get_admin(), Some(admin));
}

#[test]
fn test_admin_rotation() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let new_admin = Address::generate(&env);
    let rogue = Address::generate(&env);

    let fail_res = client.try_set_admin(&rogue, &new_admin);
    assert_eq!(fail_res, Err(Ok(Error::Unauthorized)));
    assert_eq!(client.get_admin(), Some(admin.clone()));

    assert_eq!(client.set_admin(&admin, &new_admin), ());
    assert_eq!(client.get_admin(), Some(new_admin.clone()));

    let writer = Address::generate(&env);
    let old_admin_try = client.try_set_writer(&admin, &writer, &true);
    assert_eq!(old_admin_try, Err(Ok(Error::Unauthorized)));

    assert_eq!(client.set_writer(&new_admin, &writer, &true), ());
    assert!(client.is_writer(&writer));
}

#[test]
fn test_set_writer_lifecycle() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let writer = Address::generate(&env);
    let rogue = Address::generate(&env);

    assert!(!client.is_writer(&writer));

    let unauthorized_try = client.try_set_writer(&rogue, &writer, &true);
    assert_eq!(unauthorized_try, Err(Ok(Error::Unauthorized)));

    assert_eq!(client.set_writer(&admin, &writer, &true), ());
    assert!(client.is_writer(&writer));

    let duplicate_try = client.try_set_writer(&admin, &writer, &true);
    assert_eq!(duplicate_try, Err(Ok(Error::WriterAlreadyAuthorized)));

    assert_eq!(client.set_writer(&admin, &writer, &false), ());
    assert!(!client.is_writer(&writer));
}

#[test]
fn test_submit_score_happy_path() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let writer = Address::generate(&env);
    client.set_writer(&admin, &writer, &true);

    let subject = Address::generate(&env);
    let model_version = String::from_str(&env, "v1.0.0");
    let evidence_hash = sample_hash(&env, 7);

    env.ledger().with_mut(|li| {
        li.sequence_number = 500;
    });

    let record = client.submit_score(&writer, &subject, &720, &model_version, &evidence_hash);
    assert_eq!(record.subject, subject);
    assert_eq!(record.score, 720);
    assert_eq!(record.band, ScoreBand::Good);
    assert_eq!(record.model_version, model_version);
    assert_eq!(record.evidence_hash, evidence_hash);
    assert_eq!(record.computed_at, 500);
    assert_eq!(record.expires_at, 500 + DEFAULT_EXPIRY_WINDOW);

    let fetched = client.get_score(&subject);
    assert_eq!(fetched, Some(record));

    assert!(client.is_score_valid(&subject));

    let history = client.get_score_history(&subject, &10);
    assert_eq!(history.len(), 1);
    assert_eq!(history.get(0).unwrap().score, 720);
}

#[test]
fn test_submit_score_unauthorized_writer() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let unauthorized_caller = Address::generate(&env);
    let subject = Address::generate(&env);
    let model_version = String::from_str(&env, "v1.0.0");
    let evidence_hash = sample_hash(&env, 1);

    let res = client.try_submit_score(
        &unauthorized_caller,
        &subject,
        &700,
        &model_version,
        &evidence_hash,
    );
    assert_eq!(res, Err(Ok(Error::Unauthorized)));
    assert_eq!(client.get_score(&subject), None);
}

#[test]
fn test_submit_score_uninitialized() {
    let (env, _admin, client) = create_test_env();

    let writer = Address::generate(&env);
    let subject = Address::generate(&env);
    let model_version = String::from_str(&env, "v1.0.0");
    let evidence_hash = sample_hash(&env, 1);

    let res = client.try_submit_score(&writer, &subject, &700, &model_version, &evidence_hash);
    assert_eq!(res, Err(Ok(Error::NotInitialized)));
}

#[test]
fn test_submit_score_range_validation() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let writer = Address::generate(&env);
    client.set_writer(&admin, &writer, &true);

    let subject = Address::generate(&env);
    let model_version = String::from_str(&env, "v1.0.0");
    let evidence_hash = sample_hash(&env, 2);

    let out_of_bounds = client.try_submit_score(
        &writer,
        &subject,
        &1001,
        &model_version,
        &evidence_hash,
    );
    assert_eq!(out_of_bounds, Err(Ok(Error::InvalidScore)));

    let lower_boundary = client.submit_score(&writer, &subject, &0, &model_version, &evidence_hash);
    assert_eq!(lower_boundary.score, 0);
    assert_eq!(lower_boundary.band, ScoreBand::Poor);

    let upper_boundary =
        client.submit_score(&writer, &subject, &1000, &model_version, &evidence_hash);
    assert_eq!(upper_boundary.score, 1000);
    assert_eq!(upper_boundary.band, ScoreBand::Excellent);
}

#[test]
fn test_submit_score_empty_model_version() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let writer = Address::generate(&env);
    client.set_writer(&admin, &writer, &true);

    let subject = Address::generate(&env);
    let empty_version = String::from_str(&env, "");
    let evidence_hash = sample_hash(&env, 3);

    let res = client.try_submit_score(&writer, &subject, &600, &empty_version, &evidence_hash);
    assert_eq!(res, Err(Ok(Error::InvalidModelVersion)));
}

#[test]
fn test_score_validity_and_expiry_handling() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let writer = Address::generate(&env);
    client.set_writer(&admin, &writer, &true);

    let subject = Address::generate(&env);
    let model_version = String::from_str(&env, "v1.0.0");
    let evidence_hash = sample_hash(&env, 4);

    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
    });

    client.submit_score(&writer, &subject, &650, &model_version, &evidence_hash);
    assert!(client.is_score_valid(&subject));

    env.ledger().with_mut(|li| {
        li.sequence_number = 1000 + (DEFAULT_EXPIRY_WINDOW as u32);
    });
    assert!(client.is_score_valid(&subject));

    env.ledger().with_mut(|li| {
        li.sequence_number = 1000 + (DEFAULT_EXPIRY_WINDOW as u32) + 1;
    });
    assert!(!client.is_score_valid(&subject));

    let unknown_subject = Address::generate(&env);
    assert!(!client.is_score_valid(&unknown_subject));
}

#[test]
fn test_set_expiry_window() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let rogue = Address::generate(&env);
    let unauthorized_try = client.try_set_expiry_window(&rogue, &50_000);
    assert_eq!(unauthorized_try, Err(Ok(Error::Unauthorized)));

    let zero_try = client.try_set_expiry_window(&admin, &0);
    assert_eq!(zero_try, Err(Ok(Error::InvalidExpiryWindow)));

    assert_eq!(client.set_expiry_window(&admin, &50_000), ());
    assert_eq!(client.get_expiry_window(), 50_000);

    let writer = Address::generate(&env);
    client.set_writer(&admin, &writer, &true);

    let subject = Address::generate(&env);
    let model_version = String::from_str(&env, "v1.0.0");
    let evidence_hash = sample_hash(&env, 5);

    env.ledger().with_mut(|li| {
        li.sequence_number = 200;
    });

    let record = client.submit_score(&writer, &subject, &850, &model_version, &evidence_hash);
    assert_eq!(record.expires_at, 200 + 50_000);
}

#[test]
fn test_score_history_pagination_and_limits() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let writer = Address::generate(&env);
    client.set_writer(&admin, &writer, &true);

    let subject = Address::generate(&env);
    let model_version = String::from_str(&env, "v1.0.0");
    let evidence_hash = sample_hash(&env, 6);

    for score in [500, 600, 700, 800, 900] {
        client.submit_score(&writer, &subject, &score, &model_version, &evidence_hash);
    }

    let zero_limit = client.get_score_history(&subject, &0);
    assert_eq!(zero_limit.len(), 0);

    let two_limit = client.get_score_history(&subject, &2);
    assert_eq!(two_limit.len(), 2);
    assert_eq!(two_limit.get(0).unwrap().score, 800);
    assert_eq!(two_limit.get(1).unwrap().score, 900);

    let all_history = client.get_score_history(&subject, &5);
    assert_eq!(all_history.len(), 5);
    assert_eq!(all_history.get(0).unwrap().score, 500);
    assert_eq!(all_history.get(4).unwrap().score, 900);

    let oversized_limit = client.get_score_history(&subject, &50);
    assert_eq!(oversized_limit.len(), 5);
}

#[test]
fn test_score_history_ring_buffer_capacity() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let writer = Address::generate(&env);
    client.set_writer(&admin, &writer, &true);

    let subject = Address::generate(&env);
    let model_version = String::from_str(&env, "v1.0.0");
    let evidence_hash = sample_hash(&env, 7);

    for i in 1..=60 {
        client.submit_score(&writer, &subject, &i, &model_version, &evidence_hash);
    }

    let history = client.get_score_history(&subject, &100);
    assert_eq!(history.len(), MAX_HISTORY_CAPACITY);
    assert_eq!(history.get(0).unwrap().score, 11);
    assert_eq!(
        history.get(MAX_HISTORY_CAPACITY - 1).unwrap().score,
        60
    );
}

#[contract]
struct MockFraudContract;

#[contractimpl]
impl MockFraudContract {
    pub fn get_current_risk(env: Env, subject: Address) -> RiskLevel {
        let flag_key = symbol_short!("is_crit");
        if env.storage().instance().get::<Symbol, bool>(&flag_key).unwrap_or(false) {
            RiskLevel::Critical
        } else {
            let _ = subject;
            RiskLevel::Low
        }
    }

    pub fn set_critical(env: Env, critical: bool) {
        let flag_key = symbol_short!("is_crit");
        env.storage().instance().set(&flag_key, &critical);
    }
}

#[test]
fn test_cross_contract_fraud_integration() {
    let (env, admin, client) = create_test_env();
    client.initialize(&admin);

    let fraud_id = env.register(MockFraudContract, ());
    let fraud_client = MockFraudContractClient::new(&env, &fraud_id);

    client.set_fraud_contract(&admin, &fraud_id);
    assert_eq!(client.get_fraud_contract(), Some(fraud_id.clone()));

    let writer = Address::generate(&env);
    client.set_writer(&admin, &writer, &true);

    let subject = Address::generate(&env);
    let model_version = String::from_str(&env, "v1.0.0");
    let evidence_hash = sample_hash(&env, 8);

    fraud_client.set_critical(&false);
    let ok_res = client.submit_score(&writer, &subject, &750, &model_version, &evidence_hash);
    assert_eq!(ok_res.score, 750);

    fraud_client.set_critical(&true);
    let blocked_res =
        client.try_submit_score(&writer, &subject, &760, &model_version, &evidence_hash);
    assert_eq!(blocked_res, Err(Ok(Error::FraudDetected)));
}

#[test]
fn test_score_band_categorization() {
    assert_eq!(ScoreBand::from_score(0), ScoreBand::Poor);
    assert_eq!(ScoreBand::from_score(579), ScoreBand::Poor);
    assert_eq!(ScoreBand::from_score(580), ScoreBand::Fair);
    assert_eq!(ScoreBand::from_score(669), ScoreBand::Fair);
    assert_eq!(ScoreBand::from_score(670), ScoreBand::Good);
    assert_eq!(ScoreBand::from_score(799), ScoreBand::Good);
    assert_eq!(ScoreBand::from_score(800), ScoreBand::Excellent);
    assert_eq!(ScoreBand::from_score(1000), ScoreBand::Excellent);
}

#[test]
fn test_validate_score_helper() {
    let env = Env::default();
    assert_eq!(Contract::validate_score(&env, 0), Ok(()));
    assert_eq!(Contract::validate_score(&env, 1000), Ok(()));
    assert_eq!(
        Contract::validate_score(&env, 1001),
        Err(ErrorCategory::Validation)
    );
}
