#![no_std]
//! model-attestation — on-chain attestation surface for model artifacts.
//!
//! Scaffolded fresh per issue #286; port real logic in from the old contracts/ tree.
//!
//! # Compatible provenance fields
//!
//! Off-chain, a model artifact carries a `ProvenanceMetadata` record produced by
//! the `@chenaikit/chenai-mlflow` package (`packages/chenai-mlflow/src/index.ts`)
//! and documented in `ml/README.md`. This contract documents which fields of
//! that record an attestation can carry, so producers know what an on-chain
//! attestation will and will not commit to.
//!
//! Provenance **format version 1** — the version this contract is written
//! against — requires all six fields below. They are exposed on-chain by
//! [`Contract::provenance_fields`], in the same canonical order used by the
//! TypeScript `REQUIRED_PROVENANCE_FIELDS` constant and by the serialized JSON
//! payload:
//!
//! | Field              | Off-chain type      | Meaning                                                            |
//! |--------------------|---------------------|--------------------------------------------------------------------|
//! | `formatVersion`    | integer             | Provenance format version; `1` is the version documented here.       |
//! | `sourceRevision`   | string              | Git commit SHA the artifact was built from.                          |
//! | `sourceRepository` | string              | URL of the repository holding that revision.                         |
//! | `dependencies`     | ordered `{name, version}` list | Resolved build dependencies; order is significant.        |
//! | `configurationId`  | string              | Identifier/hash of the training or build configuration.              |
//! | `createdAt`        | ISO 8601 string     | Artifact creation timestamp, with an explicit UTC offset.            |
//!
//! Attestation payloads should commit to `dependencies` by hash rather than
//! storing the list verbatim: the list is unbounded, while the other five
//! fields are fixed-size. Producers must not attest to an artifact whose
//! provenance is incomplete — `@chenaikit/chenai-mlflow` refuses to serialize
//! such a record, and the same rule applies here.
//!
//! When [`PROVENANCE_FORMAT_VERSION`] and the TypeScript
//! `PROVENANCE_FORMAT_VERSION` diverge, the two sides are no longer describing
//! the same record and must be reconciled before attestations are trusted.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, String, Symbol, Vec,
};

/// Provenance format version this contract documents and is compatible with.
pub const PROVENANCE_FORMAT_VERSION: u32 = 1;

/// Required provenance fields of format version 1 in canonical order.
pub const PROVENANCE_FIELDS: [&str; 6] = [
    "formatVersion",
    "sourceRevision",
    "sourceRepository",
    "dependencies",
    "configurationId",
    "createdAt",
];

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum AttestationStatus {
    Active = 1,
    Deprecated = 2,
    Invalidated = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AttestationRecord {
    pub record_id: String,
    pub model_hash: BytesN<32>,
    pub version: u32,
    pub status: AttestationStatus,
    pub created_at: u64,
    pub updated_at: u64,
    pub invalidated_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ModelAttestation {
    pub model_id: Symbol,
    pub version: String,
    pub weights_hash: BytesN<32>,
    pub metadata_uri: String,
    pub attested_by: Address,
    pub attested_at: u64,
    pub status: AttestationStatus,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Governance,
    GovernanceLive,
    Record(String),
    ActiveModel(Symbol),
    ModelByVersion(Symbol, String),
    ModelHistory(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    NotFound = 4,
    AlreadyExists = 5,
    AlreadyInvalidated = 6,
    StaleVersion = 7,
    InvalidState = 8,
}

impl From<Error> for common_utils::ErrorCategory {
    fn from(err: Error) -> Self {
        match err {
            Error::Unauthorized => common_utils::ErrorCategory::Authorization,
            Error::NotFound => common_utils::ErrorCategory::NotFound,
            Error::AlreadyExists
            | Error::AlreadyInitialized
            | Error::AlreadyInvalidated
            | Error::StaleVersion
            | Error::InvalidState => common_utils::ErrorCategory::Validation,
            Error::NotInitialized => common_utils::ErrorCategory::Validation,
        }
    }
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Establish the admin once. Subsequent calls fail with AlreadyInitialized.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::GovernanceLive, &false);
        Ok(())
    }

    /// Retrieve the format version constant.
    pub fn provenance_format_version(_env: Env) -> u32 {
        PROVENANCE_FORMAT_VERSION
    }

    /// Retrieve the canonical list of provenance fields.
    pub fn provenance_fields(env: Env) -> Vec<Symbol> {
        let mut fields: Vec<Symbol> = Vec::new(&env);
        for field in PROVENANCE_FIELDS.iter() {
            fields.push_back(Symbol::new(&env, field));
        }
        fields
    }

    /// Appoint governance address and hand off model attestation authority. Admin only.
    pub fn set_governance(env: Env, caller: Address, governance: Address) -> Result<(), Error> {
        require_admin(&env, &caller)?;
        env.storage()
            .instance()
            .set(&DataKey::Governance, &governance);
        env.storage()
            .instance()
            .set(&DataKey::GovernanceLive, &true);
        env.events().publish(
            (soroban_sdk::symbol_short!("gov_set"), governance),
            env.ledger().timestamp(),
        );
        Ok(())
    }

    /// Check if governance has been handed off and is active.
    pub fn is_governance_live(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::GovernanceLive)
            .unwrap_or(false)
    }

    /// Retrieve configured governance contract address.
    pub fn get_governance(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Governance)
    }

    /// Retrieve configured admin address.
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    /// Attest a new model artifact. Deprecates any currently active version of the model.
    pub fn attest_model(
        env: Env,
        caller: Address,
        model_id: Symbol,
        version: String,
        weights_hash: BytesN<32>,
        metadata_uri: String,
    ) -> Result<ModelAttestation, Error> {
        caller.require_auth();
        let gov_live: bool = env
            .storage()
            .instance()
            .get(&DataKey::GovernanceLive)
            .unwrap_or(false);

        if gov_live {
            let gov: Address = env
                .storage()
                .instance()
                .get(&DataKey::Governance)
                .ok_or(Error::NotInitialized)?;
            if caller != gov {
                return Err(Error::Unauthorized);
            }
        } else {
            let admin: Address = env
                .storage()
                .instance()
                .get(&DataKey::Admin)
                .ok_or(Error::NotInitialized)?;
            if caller != admin {
                return Err(Error::Unauthorized);
            }
        }

        let now = env.ledger().timestamp();

        if let Some(mut prev_active) = env
            .storage()
            .persistent()
            .get::<DataKey, ModelAttestation>(&DataKey::ActiveModel(model_id.clone()))
        {
            prev_active.status = AttestationStatus::Deprecated;
            env.storage().persistent().set(
                &DataKey::ModelByVersion(model_id.clone(), prev_active.version.clone()),
                &prev_active,
            );
            env.events().publish(
                (soroban_sdk::symbol_short!("deprec"), model_id.clone()),
                prev_active.version,
            );
        }

        let attestation = ModelAttestation {
            model_id: model_id.clone(),
            version: version.clone(),
            weights_hash,
            metadata_uri,
            attested_by: caller.clone(),
            attested_at: now,
            status: AttestationStatus::Active,
        };

        env.storage()
            .persistent()
            .set(&DataKey::ActiveModel(model_id.clone()), &attestation);
        env.storage().persistent().set(
            &DataKey::ModelByVersion(model_id.clone(), version),
            &attestation,
        );

        let mut history: Vec<ModelAttestation> = env
            .storage()
            .persistent()
            .get(&DataKey::ModelHistory(model_id.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        history.push_back(attestation.clone());
        env.storage()
            .persistent()
            .set(&DataKey::ModelHistory(model_id.clone()), &history);

        env.events().publish(
            (soroban_sdk::symbol_short!("attest"), model_id, caller),
            attestation.clone(),
        );

        Ok(attestation)
    }

    /// Retrieve the currently active model attestation for a model ID.
    pub fn get_active_model(env: Env, model_id: Symbol) -> Option<ModelAttestation> {
        env.storage()
            .persistent()
            .get(&DataKey::ActiveModel(model_id))
    }

    /// Check if a specific version of a model ID has been attested.
    pub fn is_version_attested(env: Env, model_id: Symbol, version: String) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::ModelByVersion(model_id, version))
    }

    /// Retrieve attestation history for a model ID.
    pub fn get_attestation_history(env: Env, model_id: Symbol) -> Vec<ModelAttestation> {
        env.storage()
            .persistent()
            .get(&DataKey::ModelHistory(model_id))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Create a new attestation record in Active status at version 1.
    pub fn create_attestation(
        env: Env,
        caller: Address,
        record_id: String,
        model_hash: BytesN<32>,
    ) -> Result<AttestationRecord, Error> {
        require_admin_or_governance(&env, &caller)?;

        let key = DataKey::Record(record_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyExists);
        }

        let now = env.ledger().timestamp();
        let record = AttestationRecord {
            record_id,
            model_hash,
            version: 1,
            status: AttestationStatus::Active,
            created_at: now,
            updated_at: now,
            invalidated_at: None,
        };
        env.storage().persistent().set(&key, &record);
        Ok(record)
    }

    /// Update an Active record's model hash, bumping version.
    pub fn update_attestation(
        env: Env,
        caller: Address,
        record_id: String,
        model_hash: BytesN<32>,
        expected_version: u32,
    ) -> Result<AttestationRecord, Error> {
        require_admin_or_governance(&env, &caller)?;

        let (key, mut record) = load_active(&env, record_id, expected_version)?;
        let now = env.ledger().timestamp();
        record.model_hash = model_hash;
        record.version = expected_version + 1;
        record.updated_at = now;
        env.storage().persistent().set(&key, &record);
        Ok(record)
    }

    /// Invalidate an Active record. Terminal state.
    pub fn invalidate_attestation(
        env: Env,
        caller: Address,
        record_id: String,
        expected_version: u32,
    ) -> Result<AttestationRecord, Error> {
        require_admin_or_governance(&env, &caller)?;

        let (key, mut record) = load_active(&env, record_id, expected_version)?;
        let now = env.ledger().timestamp();
        record.status = AttestationStatus::Invalidated;
        record.updated_at = now;
        record.invalidated_at = Some(now);
        env.storage().persistent().set(&key, &record);
        Ok(record)
    }

    /// Read a stored attestation record, if present.
    pub fn get_attestation(env: Env, record_id: String) -> Option<AttestationRecord> {
        env.storage().persistent().get(&DataKey::Record(record_id))
    }
}

fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    if caller != &admin {
        return Err(Error::Unauthorized);
    }
    caller.require_auth();
    Ok(())
}

fn require_admin_or_governance(env: &Env, caller: &Address) -> Result<(), Error> {
    caller.require_auth();
    let admin: Option<Address> = env.storage().instance().get(&DataKey::Admin);
    let gov: Option<Address> = env.storage().instance().get(&DataKey::Governance);
    let is_admin = admin.as_ref() == Some(caller);
    let is_gov = gov.as_ref() == Some(caller);
    if is_admin || is_gov {
        Ok(())
    } else if admin.is_none() {
        Err(Error::NotInitialized)
    } else {
        Err(Error::Unauthorized)
    }
}

fn load_active(
    env: &Env,
    record_id: String,
    expected_version: u32,
) -> Result<(DataKey, AttestationRecord), Error> {
    let key = DataKey::Record(record_id);
    let record: AttestationRecord = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::NotFound)?;
    if record.status == AttestationStatus::Invalidated {
        return Err(Error::AlreadyInvalidated);
    }
    if record.version != expected_version {
        return Err(Error::StaleVersion);
    }
    Ok((key, record))
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::vec;

    fn hash(env: &Env, fill: u8) -> BytesN<32> {
        BytesN::from_array(env, &[fill; 32])
    }

    fn record_id(env: &Env, s: &str) -> String {
        String::from_str(env, s)
    }

    fn setup(env: &Env) -> (Address, Address, ContractClient<'_>) {
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let stranger = Address::generate(env);
        env.mock_all_auths();
        client.initialize(&admin);
        (admin, stranger, client)
    }

    #[test]
    fn create_transitions_to_active_v1() {
        let env = Env::default();
        let (admin, _, client) = setup(&env);
        let id = record_id(&env, "model-a");
        let model_hash = hash(&env, 1);

        let created = client.create_attestation(&admin, &id, &model_hash);

        assert_eq!(created.status, AttestationStatus::Active);
        assert_eq!(created.version, 1);
        assert_eq!(created.model_hash, model_hash);
        assert_eq!(created.invalidated_at, None);

        let stored = client.get_attestation(&id).unwrap();
        assert_eq!(stored, created);
        assert_eq!(stored.status, AttestationStatus::Active);
        assert_eq!(stored.version, 1);
    }

    #[test]
    fn update_active_bumps_version_and_hash() {
        let env = Env::default();
        let (admin, _, client) = setup(&env);
        let id = record_id(&env, "model-b");
        let h1 = hash(&env, 1);
        let h2 = hash(&env, 2);

        client.create_attestation(&admin, &id, &h1);
        let updated = client.update_attestation(&admin, &id, &h2, &1);

        assert_eq!(updated.status, AttestationStatus::Active);
        assert_eq!(updated.version, 2);
        assert_eq!(updated.model_hash, h2);

        let stored = client.get_attestation(&id).unwrap();
        assert_eq!(stored.status, AttestationStatus::Active);
        assert_eq!(stored.version, 2);
        assert_eq!(stored.model_hash, h2);
        assert_eq!(stored.invalidated_at, None);
    }

    #[test]
    fn invalidate_active_sets_terminal_state() {
        let env = Env::default();
        let (admin, _, client) = setup(&env);
        let id = record_id(&env, "model-c");
        let h1 = hash(&env, 3);

        client.create_attestation(&admin, &id, &h1);
        let invalidated = client.invalidate_attestation(&admin, &id, &1);

        assert_eq!(invalidated.status, AttestationStatus::Invalidated);
        assert_eq!(invalidated.version, 1);
        assert!(invalidated.invalidated_at.is_some());

        let stored = client.get_attestation(&id).unwrap();
        assert_eq!(stored.status, AttestationStatus::Invalidated);
        assert_eq!(stored.version, 1);
        assert_eq!(stored.model_hash, h1);
        assert!(stored.invalidated_at.is_some());
    }

    #[test]
    fn full_valid_lifecycle_create_update_invalidate() {
        let env = Env::default();
        let (admin, _, client) = setup(&env);
        let id = record_id(&env, "model-d");

        let created = client.create_attestation(&admin, &id, &hash(&env, 1));
        assert_eq!(created.status, AttestationStatus::Active);
        assert_eq!(created.version, 1);

        let updated = client.update_attestation(&admin, &id, &hash(&env, 2), &1);
        assert_eq!(updated.status, AttestationStatus::Active);
        assert_eq!(updated.version, 2);

        let invalidated = client.invalidate_attestation(&admin, &id, &2);
        assert_eq!(invalidated.status, AttestationStatus::Invalidated);
        assert_eq!(invalidated.version, 2);

        let stored = client.get_attestation(&id).unwrap();
        assert_eq!(stored.status, AttestationStatus::Invalidated);
        assert_eq!(stored.version, 2);
        assert_eq!(stored.model_hash, hash(&env, 2));
        assert!(stored.invalidated_at.is_some());
    }

    #[test]
    fn reject_duplicate_create() {
        let env = Env::default();
        let (admin, _, client) = setup(&env);
        let id = record_id(&env, "model-e");
        let h = hash(&env, 1);

        client.create_attestation(&admin, &id, &h);
        assert_eq!(
            client.try_create_attestation(&admin, &id, &h),
            Err(Ok(Error::AlreadyExists))
        );

        let stored = client.get_attestation(&id).unwrap();
        assert_eq!(stored.status, AttestationStatus::Active);
        assert_eq!(stored.version, 1);
    }

    #[test]
    fn reject_update_and_invalidate_when_already_invalidated() {
        let env = Env::default();
        let (admin, _, client) = setup(&env);
        let id = record_id(&env, "model-f");

        client.create_attestation(&admin, &id, &hash(&env, 1));
        client.invalidate_attestation(&admin, &id, &1);

        assert_eq!(
            client.try_update_attestation(&admin, &id, &hash(&env, 9), &1),
            Err(Ok(Error::AlreadyInvalidated))
        );
        assert_eq!(
            client.try_invalidate_attestation(&admin, &id, &1),
            Err(Ok(Error::AlreadyInvalidated))
        );

        let stored = client.get_attestation(&id).unwrap();
        assert_eq!(stored.status, AttestationStatus::Invalidated);
        assert_eq!(stored.version, 1);
        assert_eq!(stored.model_hash, hash(&env, 1));
    }

    #[test]
    fn reject_stale_update_and_invalidate() {
        let env = Env::default();
        let (admin, _, client) = setup(&env);
        let id = record_id(&env, "model-g");

        client.create_attestation(&admin, &id, &hash(&env, 1));
        client.update_attestation(&admin, &id, &hash(&env, 2), &1);

        assert_eq!(
            client.try_update_attestation(&admin, &id, &hash(&env, 3), &1),
            Err(Ok(Error::StaleVersion))
        );
        assert_eq!(
            client.try_invalidate_attestation(&admin, &id, &1),
            Err(Ok(Error::StaleVersion))
        );

        let stored = client.get_attestation(&id).unwrap();
        assert_eq!(stored.status, AttestationStatus::Active);
        assert_eq!(stored.version, 2);
        assert_eq!(stored.model_hash, hash(&env, 2));
        assert_eq!(stored.invalidated_at, None);
    }

    #[test]
    fn reject_unauthorized_transitions() {
        let env = Env::default();
        let (admin, stranger, client) = setup(&env);
        let id = record_id(&env, "model-h");

        assert_eq!(
            client.try_create_attestation(&stranger, &id, &hash(&env, 1)),
            Err(Ok(Error::Unauthorized))
        );
        assert!(client.get_attestation(&id).is_none());

        client.create_attestation(&admin, &id, &hash(&env, 1));

        assert_eq!(
            client.try_update_attestation(&stranger, &id, &hash(&env, 2), &1),
            Err(Ok(Error::Unauthorized))
        );
        assert_eq!(
            client.try_invalidate_attestation(&stranger, &id, &1),
            Err(Ok(Error::Unauthorized))
        );

        let stored = client.get_attestation(&id).unwrap();
        assert_eq!(stored.status, AttestationStatus::Active);
        assert_eq!(stored.version, 1);
        assert_eq!(stored.model_hash, hash(&env, 1));
    }

    #[test]
    fn reject_missing_record_mutations() {
        let env = Env::default();
        let (admin, _, client) = setup(&env);
        let id = record_id(&env, "missing");

        assert_eq!(
            client.try_update_attestation(&admin, &id, &hash(&env, 1), &1),
            Err(Ok(Error::NotFound))
        );
        assert_eq!(
            client.try_invalidate_attestation(&admin, &id, &1),
            Err(Ok(Error::NotFound))
        );
        assert!(client.get_attestation(&id).is_none());
    }

    #[test]
    fn reject_mutations_before_initialize() {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(&env, &contract_id);
        let caller = Address::generate(&env);
        env.mock_all_auths();
        let id = record_id(&env, "early");

        assert_eq!(
            client.try_create_attestation(&caller, &id, &hash(&env, 1)),
            Err(Ok(Error::NotInitialized))
        );
        assert!(client.get_attestation(&id).is_none());
    }

    #[test]
    fn test_provenance_format_version() {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(&env, &contract_id);
        assert_eq!(client.provenance_format_version(), 1);
        assert_eq!(
            client.provenance_format_version(),
            PROVENANCE_FORMAT_VERSION
        );
    }

    #[test]
    fn test_provenance_fields_match_documented_format() {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(&env, &contract_id);

        let expected = vec![
            &env,
            Symbol::new(&env, "formatVersion"),
            Symbol::new(&env, "sourceRevision"),
            Symbol::new(&env, "sourceRepository"),
            Symbol::new(&env, "dependencies"),
            Symbol::new(&env, "configurationId"),
            Symbol::new(&env, "createdAt"),
        ];

        assert_eq!(client.provenance_fields(), expected);
    }

    #[test]
    fn test_provenance_fields_constant_is_the_source_of_truth() {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(&env, &contract_id);

        let fields = client.provenance_fields();
        assert_eq!(fields.len() as usize, PROVENANCE_FIELDS.len());
        for (index, name) in PROVENANCE_FIELDS.iter().enumerate() {
            assert_eq!(fields.get_unchecked(index as u32), Symbol::new(&env, name));
        }
    }

    #[test]
    fn test_attest_model_lifecycle_and_deprecation() {
        let env = Env::default();
        let (admin, stranger, client) = setup(&env);
        let model_id = Symbol::new(&env, "credit_risk_v1");
        let v1 = String::from_str(&env, "1.0.0");
        let v2 = String::from_str(&env, "2.0.0");
        let h1 = hash(&env, 1);
        let h2 = hash(&env, 2);
        let uri1 = String::from_str(&env, "ipfs://hash1");
        let uri2 = String::from_str(&env, "ipfs://hash2");

        assert_eq!(
            client.try_attest_model(&stranger, &model_id, &v1, &h1, &uri1),
            Err(Ok(Error::Unauthorized))
        );

        let att1 = client.attest_model(&admin, &model_id, &v1, &h1, &uri1);
        assert_eq!(att1.status, AttestationStatus::Active);
        assert_eq!(att1.version, v1);
        assert_eq!(att1.weights_hash, h1);

        assert!(client.is_version_attested(&model_id, &v1));
        assert!(!client.is_version_attested(&model_id, &v2));

        let active = client.get_active_model(&model_id).unwrap();
        assert_eq!(active.status, AttestationStatus::Active);
        assert_eq!(active.version, v1);

        let att2 = client.attest_model(&admin, &model_id, &v2, &h2, &uri2);
        assert_eq!(att2.status, AttestationStatus::Active);
        assert_eq!(att2.version, v2);

        let active2 = client.get_active_model(&model_id).unwrap();
        assert_eq!(active2.version, v2);

        let history = client.get_attestation_history(&model_id);
        assert_eq!(history.len(), 2);
        assert_eq!(history.get(0).unwrap().version, v1);
        assert_eq!(history.get(1).unwrap().version, v2);
    }

    #[test]
    fn test_governance_handoff_and_attestation() {
        let env = Env::default();
        let (admin, _, client) = setup(&env);
        let gov = Address::generate(&env);
        let model_id = Symbol::new(&env, "fraud_nn");
        let v1 = String::from_str(&env, "1.0.0");
        let h1 = hash(&env, 5);
        let uri = String::from_str(&env, "ipfs://gov_attested");

        assert!(!client.is_governance_live());
        assert_eq!(client.get_governance(), None);

        client.set_governance(&admin, &gov);
        assert!(client.is_governance_live());
        assert_eq!(client.get_governance(), Some(gov.clone()));

        assert_eq!(
            client.try_attest_model(&admin, &model_id, &v1, &h1, &uri),
            Err(Ok(Error::Unauthorized))
        );

        let att = client.attest_model(&gov, &model_id, &v1, &h1, &uri);
        assert_eq!(att.status, AttestationStatus::Active);
        assert_eq!(att.attested_by, gov);
    }

    #[test]
    fn test_error_category_conversions() {
        assert_eq!(
            common_utils::ErrorCategory::from(Error::Unauthorized),
            common_utils::ErrorCategory::Authorization
        );
        assert_eq!(
            common_utils::ErrorCategory::from(Error::NotFound),
            common_utils::ErrorCategory::NotFound
        );
        assert_eq!(
            common_utils::ErrorCategory::from(Error::AlreadyExists),
            common_utils::ErrorCategory::Validation
        );
    }
}
