use crate::errors::ContractError;
use crate::test::setup_test_fixture;
use crate::types::RiskLevel;
use crate::{Contract, ContractClient};
use credit_score::{
    Contract as CreditContract, ContractClient as CreditClient, Error as CreditError,
};
use soroban_sdk::{testutils::Address as _, vec, Address, BytesN, Env, String, Symbol};

#[test]
fn test_writer_authorization_and_registry() {
    let fixture = setup_test_fixture();
    let env = &fixture.env;
    let client = &fixture.client;
    let admin = &fixture.admin;
    let writer = Address::generate(env);
    let stranger = Address::generate(env);

    assert!(!client.is_writer(&writer));

    client.set_writer(admin, &writer, &true);
    assert!(client.is_writer(&writer));

    let res = client.try_set_writer(&stranger, &writer, &false);
    assert_eq!(res, Err(Ok(ContractError::NotAuthorized)));

    client.set_writer(admin, &writer, &false);
    assert!(!client.is_writer(&writer));
}

#[test]
fn test_unauthorized_writer_rejected() {
    let fixture = setup_test_fixture();
    let env = &fixture.env;
    let client = &fixture.client;
    let stranger = Address::generate(env);
    let subject = Address::generate(env);

    let reasons = vec![env, Symbol::new(env, "rapid_burst")];
    let evidence_hash = BytesN::from_array(env, &[1u8; 32]);

    let res = client.try_submit_flag(
        &stranger,
        &subject,
        &RiskLevel::High,
        &reasons,
        &evidence_hash,
    );
    assert_eq!(res, Err(Ok(ContractError::UnauthorizedWriter)));
}

#[test]
fn test_flag_submission_and_monotonic_sequence() {
    let fixture = setup_test_fixture();
    let env = &fixture.env;
    let client = &fixture.client;
    let admin = &fixture.admin;
    let writer = Address::generate(env);
    let subject = Address::generate(env);

    client.set_writer(admin, &writer, &true);

    let reasons1 = vec![env, Symbol::new(env, "burst"), Symbol::new(env, "anomaly")];
    let evidence_hash1 = BytesN::from_array(env, &[2u8; 32]);

    let flag_id1 = client.submit_flag(
        &writer,
        &subject,
        &RiskLevel::Medium,
        &reasons1,
        &evidence_hash1,
    );
    assert_eq!(flag_id1, 1);

    let reasons2 = vec![env, Symbol::new(env, "mixer_interaction")];
    let evidence_hash2 = BytesN::from_array(env, &[3u8; 32]);

    let flag_id2 = client.submit_flag(
        &writer,
        &subject,
        &RiskLevel::Critical,
        &reasons2,
        &evidence_hash2,
    );
    assert_eq!(flag_id2, 2);

    let history = client.get_flag_history(&subject, &10);
    assert_eq!(history.len(), 2);

    let f1 = history.get_unchecked(0);
    assert_eq!(f1.id, 1);
    assert_eq!(f1.subject, subject);
    assert_eq!(f1.risk_level, RiskLevel::Medium);
    assert_eq!(f1.resolved, false);
    assert_eq!(f1.resolution_note, None);
    assert_eq!(f1.evidence_hash, evidence_hash1);
    assert_eq!(f1.flagged_by, writer);

    let f2 = history.get_unchecked(1);
    assert_eq!(f2.id, 2);
    assert_eq!(f2.subject, subject);
    assert_eq!(f2.risk_level, RiskLevel::Critical);
    assert_eq!(f2.resolved, false);
}

#[test]
fn test_flag_resolution_flow_and_rejections() {
    let fixture = setup_test_fixture();
    let env = &fixture.env;
    let client = &fixture.client;
    let admin = &fixture.admin;
    let writer = Address::generate(env);
    let stranger = Address::generate(env);
    let subject = Address::generate(env);

    client.set_writer(admin, &writer, &true);

    let reasons = vec![env, Symbol::new(env, "structuring")];
    let evidence_hash = BytesN::from_array(env, &[4u8; 32]);
    let flag_id = client.submit_flag(
        &writer,
        &subject,
        &RiskLevel::High,
        &reasons,
        &evidence_hash,
    );

    let note = Symbol::new(env, "cleared_kyc");
    let unauth_res = client.try_resolve_flag(&stranger, &subject, &flag_id, &note);
    assert_eq!(unauth_res, Err(Ok(ContractError::NotAuthorized)));

    let non_existent = client.try_resolve_flag(&writer, &subject, &999, &note);
    assert_eq!(non_existent, Err(Ok(ContractError::FlagNotFound)));

    client.resolve_flag(&writer, &subject, &flag_id, &note);

    let history = client.get_flag_history(&subject, &10);
    let flag = history.get_unchecked(0);
    assert_eq!(flag.resolved, true);
    assert_eq!(flag.resolution_note, Some(note.clone()));

    let dup_res = client.try_resolve_flag(&writer, &subject, &flag_id, &note);
    assert_eq!(dup_res, Err(Ok(ContractError::AlreadyResolved)));
}

#[test]
fn test_effective_risk_calculation_and_o1_lookup() {
    let fixture = setup_test_fixture();
    let env = &fixture.env;
    let client = &fixture.client;
    let admin = &fixture.admin;
    let writer = Address::generate(env);
    let subject = Address::generate(env);

    client.set_writer(admin, &writer, &true);

    assert_eq!(client.get_current_risk(&subject), RiskLevel::Low);
    assert!(!client.is_fraud_critical(&subject));

    let reasons = vec![env, Symbol::new(env, "suspicious")];
    let hash = BytesN::from_array(env, &[5u8; 32]);
    let f1 = client.submit_flag(&writer, &subject, &RiskLevel::Medium, &reasons, &hash);
    assert_eq!(client.get_current_risk(&subject), RiskLevel::Medium);
    assert!(!client.is_fraud_critical(&subject));

    let f2 = client.submit_flag(&writer, &subject, &RiskLevel::Critical, &reasons, &hash);
    assert_eq!(client.get_current_risk(&subject), RiskLevel::Critical);
    assert!(client.is_fraud_critical(&subject));

    let f3 = client.submit_flag(&writer, &subject, &RiskLevel::High, &reasons, &hash);
    assert_eq!(client.get_current_risk(&subject), RiskLevel::Critical);

    let note = Symbol::new(env, "false_pos");
    client.resolve_flag(&writer, &subject, &f2, &note);
    assert_eq!(client.get_current_risk(&subject), RiskLevel::High);
    assert!(!client.is_fraud_critical(&subject));

    client.resolve_flag(&writer, &subject, &f3, &note);
    assert_eq!(client.get_current_risk(&subject), RiskLevel::Medium);

    client.resolve_flag(&writer, &subject, &f1, &note);
    assert_eq!(client.get_current_risk(&subject), RiskLevel::Low);
    assert!(!client.is_fraud_critical(&subject));
}

#[test]
fn test_administrative_override_lifecycle() {
    let fixture = setup_test_fixture();
    let env = &fixture.env;
    let client = &fixture.client;
    let admin = &fixture.admin;
    let writer = Address::generate(env);
    let stranger = Address::generate(env);
    let subject = Address::generate(env);

    client.set_writer(admin, &writer, &true);

    let reasons = vec![env, Symbol::new(env, "exploit_drain")];
    let hash = BytesN::from_array(env, &[6u8; 32]);
    client.submit_flag(&writer, &subject, &RiskLevel::Critical, &reasons, &hash);
    assert_eq!(client.get_current_risk(&subject), RiskLevel::Critical);

    let unauth_override = client.try_override_status(&stranger, &subject, &RiskLevel::Low);
    assert_eq!(unauth_override, Err(Ok(ContractError::NotAuthorized)));

    client.override_status(admin, &subject, &RiskLevel::Low);
    assert_eq!(client.get_current_risk(&subject), RiskLevel::Low);
    assert!(!client.is_fraud_critical(&subject));

    let unauth_remove = client.try_remove_override(&stranger, &subject);
    assert_eq!(unauth_remove, Err(Ok(ContractError::NotAuthorized)));

    client.remove_override(admin, &subject);
    assert_eq!(client.get_current_risk(&subject), RiskLevel::Critical);
    assert!(client.is_fraud_critical(&subject));
}

#[test]
fn test_empty_reasons_rejected() {
    let fixture = setup_test_fixture();
    let env = &fixture.env;
    let client = &fixture.client;
    let admin = &fixture.admin;
    let writer = Address::generate(env);
    let subject = Address::generate(env);

    client.set_writer(admin, &writer, &true);
    let empty_reasons = vec![env];
    let hash = BytesN::from_array(env, &[7u8; 32]);

    let res = client.try_submit_flag(&writer, &subject, &RiskLevel::High, &empty_reasons, &hash);
    assert_eq!(res, Err(Ok(ContractError::MalformedInput)));
}

#[test]
fn test_uninitialized_contract_rejects_flag_operations() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let caller = Address::generate(&env);
    let subject = Address::generate(&env);

    let reasons = vec![&env, Symbol::new(&env, "reason")];
    let hash = BytesN::from_array(&env, &[8u8; 32]);

    let sub_res = client.try_submit_flag(&caller, &subject, &RiskLevel::High, &reasons, &hash);
    assert_eq!(sub_res, Err(Ok(ContractError::NotInitialized)));

    let note = Symbol::new(&env, "note");
    let res_res = client.try_resolve_flag(&caller, &subject, &1, &note);
    assert_eq!(res_res, Err(Ok(ContractError::NotInitialized)));
}

#[test]
fn test_bounded_history_capacity_and_eviction() {
    let fixture = setup_test_fixture();
    let env = &fixture.env;
    let client = &fixture.client;
    let admin = &fixture.admin;
    let writer = Address::generate(env);
    let subject = Address::generate(env);

    client.set_writer(admin, &writer, &true);

    let reasons = vec![env, Symbol::new(env, "capacity_test")];
    let hash = BytesN::from_array(env, &[9u8; 32]);

    for _ in 0..52 {
        client.submit_flag(&writer, &subject, &RiskLevel::Low, &reasons, &hash);
    }

    let history = client.get_flag_history(&subject, &100);
    assert_eq!(history.len(), 50);

    let latest_slice = client.get_flag_history(&subject, &5);
    assert_eq!(latest_slice.len(), 5);
}

#[test]
fn test_cross_contract_credit_score_integration() {
    let env = Env::default();
    env.mock_all_auths();

    let fraud_id = env.register(Contract, ());
    let fraud_client = ContractClient::new(&env, &fraud_id);

    let credit_id = env.register(CreditContract, ());
    let credit_client = CreditClient::new(&env, &credit_id);

    let admin = Address::generate(&env);
    let writer = Address::generate(&env);
    let scorer = Address::generate(&env);
    let subject = Address::generate(&env);

    fraud_client.initialize(&admin);
    fraud_client.set_writer(&admin, &writer, &true);

    credit_client.initialize(&admin);
    credit_client.set_scorer(&admin, &scorer);
    credit_client.set_fraud_contract(&admin, &fraud_id);

    assert_eq!(credit_client.get_fraud_contract(), Some(fraud_id.clone()));

    let factors = String::from_str(&env, "good_history");
    let score = credit_client.record_score(&scorer, &subject, &750, &factors);
    assert_eq!(score.value, 750);

    let reasons = vec![&env, Symbol::new(&env, "sybil_attack")];
    let hash = BytesN::from_array(&env, &[10u8; 32]);
    let flag_id =
        fraud_client.submit_flag(&writer, &subject, &RiskLevel::Critical, &reasons, &hash);

    assert_eq!(fraud_client.get_current_risk(&subject), RiskLevel::Critical);

    let update_res = credit_client.try_update_score(&scorer, &subject, &800, &factors);
    assert_eq!(update_res, Err(Ok(CreditError::FraudDetected)));

    let subject2 = Address::generate(&env);
    fraud_client.submit_flag(&writer, &subject2, &RiskLevel::Critical, &reasons, &hash);
    let record_res = credit_client.try_record_score(&scorer, &subject2, &600, &factors);
    assert_eq!(record_res, Err(Ok(CreditError::FraudDetected)));

    let note = Symbol::new(&env, "identity_verified");
    fraud_client.resolve_flag(&writer, &subject, &flag_id, &note);
    assert_eq!(fraud_client.get_current_risk(&subject), RiskLevel::Low);

    let update_success = credit_client.update_score(&scorer, &subject, &800, &factors);
    assert_eq!(update_success.value, 800);
}
