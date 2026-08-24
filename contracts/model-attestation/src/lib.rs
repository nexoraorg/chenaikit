#![no_std]
//! model-attestation — on-chain registry for model attestation records.
//!
//! Provides explicit lifecycle guarantees so consumers can distinguish
//! current evidence from revoked or stale records.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, String,
};

/// Persistent storage keys.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Record(String),
}

/// Lifecycle status of an attestation record.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AttestationStatus {
    /// Record exists and is valid evidence.
    Active,
    /// Record was revoked; must not be treated as current evidence.
    Invalidated,
}

/// Stored attestation record.
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
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Establish the admin once. Subsequent calls fail with `AlreadyInitialized`.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Create a new attestation record in `Active` status at version 1.
    pub fn create_attestation(
        env: Env,
        caller: Address,
        record_id: String,
        model_hash: BytesN<32>,
    ) -> Result<AttestationRecord, Error> {
        require_admin(&env, &caller)?;

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

    /// Update an `Active` record's model hash, bumping `version`.
    ///
    /// Rejects unauthorized callers, missing records, already-invalidated
    /// records, and stale `expected_version` values.
    pub fn update_attestation(
        env: Env,
        caller: Address,
        record_id: String,
        model_hash: BytesN<32>,
        expected_version: u32,
    ) -> Result<AttestationRecord, Error> {
        require_admin(&env, &caller)?;

        let (key, mut record) = load_active(&env, record_id, expected_version)?;
        let now = env.ledger().timestamp();
        record.model_hash = model_hash;
        record.version = expected_version + 1;
        record.updated_at = now;
        env.storage().persistent().set(&key, &record);
        Ok(record)
    }

    /// Invalidate an `Active` record. Terminal state — no further updates.
    ///
    /// Rejects unauthorized callers, missing records, already-invalidated
    /// records, and stale `expected_version` values.
    pub fn invalidate_attestation(
        env: Env,
        caller: Address,
        record_id: String,
        expected_version: u32,
    ) -> Result<AttestationRecord, Error> {
        require_admin(&env, &caller)?;

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

        // Caller still holds expected_version=1 after the record moved to v2.
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
}
