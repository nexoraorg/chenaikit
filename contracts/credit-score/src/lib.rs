#![no_std]
//! credit-score — stores subject credit scores behind explicit authorization.
//!
//! Privileged writes require admin or scorer roles. Rejected callers must leave
//! storage unchanged so sensitive decisions are not corrupted.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Scorer,
    Score(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreditScore {
    pub subject: Address,
    pub value: u32,
    pub factors: String,
    pub updated_at: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    NotFound = 4,
    InvalidScore = 5,
    AlreadyExists = 6,
}

/// Maximum accepted score value (inclusive).
pub const MAX_SCORE: u32 = 1000;

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Establish admin once. The admin is the only caller that can appoint a scorer
    /// or clear scores.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Admin-only: appoint the address allowed to record and update scores.
    pub fn set_scorer(env: Env, caller: Address, scorer: Address) -> Result<(), Error> {
        require_admin(&env, &caller)?;
        env.storage().instance().set(&DataKey::Scorer, &scorer);
        Ok(())
    }

    /// Scorer-only: create a score for a subject that has none yet.
    pub fn record_score(
        env: Env,
        caller: Address,
        subject: Address,
        value: u32,
        factors: String,
    ) -> Result<CreditScore, Error> {
        require_scorer(&env, &caller)?;
        if value > MAX_SCORE {
            return Err(Error::InvalidScore);
        }
        let key = DataKey::Score(subject.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyExists);
        }
        let record = CreditScore {
            subject,
            value,
            factors,
            updated_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&key, &record);
        Ok(record)
    }

    /// Scorer-only: overwrite an existing subject score.
    pub fn update_score(
        env: Env,
        caller: Address,
        subject: Address,
        value: u32,
        factors: String,
    ) -> Result<CreditScore, Error> {
        require_scorer(&env, &caller)?;
        if value > MAX_SCORE {
            return Err(Error::InvalidScore);
        }
        let key = DataKey::Score(subject.clone());
        if !env.storage().persistent().has(&key) {
            return Err(Error::NotFound);
        }
        let record = CreditScore {
            subject,
            value,
            factors,
            updated_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&key, &record);
        Ok(record)
    }

    /// Admin-only: remove a stored score.
    pub fn clear_score(env: Env, caller: Address, subject: Address) -> Result<(), Error> {
        require_admin(&env, &caller)?;
        let key = DataKey::Score(subject);
        if !env.storage().persistent().has(&key) {
            return Err(Error::NotFound);
        }
        env.storage().persistent().remove(&key);
        Ok(())
    }

    /// Public read — no authorization required.
    pub fn get_score(env: Env, subject: Address) -> Option<CreditScore> {
        env.storage()
            .persistent()
            .get::<DataKey, CreditScore>(&DataKey::Score(subject))
    }

    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    pub fn get_scorer(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Scorer)
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

fn require_scorer(env: &Env, caller: &Address) -> Result<(), Error> {
    let scorer: Address = env
        .storage()
        .instance()
        .get(&DataKey::Scorer)
        .ok_or(Error::NotInitialized)?;
    if caller != &scorer {
        return Err(Error::Unauthorized);
    }
    caller.require_auth();
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn factors(env: &Env) -> String {
        String::from_str(env, "base:100")
    }

    fn setup(env: &Env) -> (Address, Address, Address, ContractClient<'_>) {
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let scorer = Address::generate(env);
        let stranger = Address::generate(env);
        env.mock_all_auths();
        client.initialize(&admin);
        client.set_scorer(&admin, &scorer);
        (admin, scorer, stranger, client)
    }

    #[test]
    fn authorized_admin_sets_scorer() {
        let env = Env::default();
        let (admin, _, _, client) = setup(&env);
        let replacement = Address::generate(&env);

        client.set_scorer(&admin, &replacement);
        assert_eq!(client.get_scorer(), Some(replacement));
    }

    #[test]
    fn unauthorized_set_scorer_rejects_and_preserves_state() {
        let env = Env::default();
        let (_, scorer, stranger, client) = setup(&env);
        let before = client.get_scorer();

        assert_eq!(
            client.try_set_scorer(&stranger, &stranger),
            Err(Ok(Error::Unauthorized))
        );
        assert_eq!(client.get_scorer(), before);
        assert_eq!(client.get_scorer(), Some(scorer));
    }

    #[test]
    fn authorized_scorer_records_score() {
        let env = Env::default();
        let (_, scorer, _, client) = setup(&env);
        let subject = Address::generate(&env);

        let recorded = client.record_score(&scorer, &subject, &720, &factors(&env));
        assert_eq!(recorded.value, 720);
        assert_eq!(recorded.subject, subject);

        let stored = client.get_score(&subject).unwrap();
        assert_eq!(stored, recorded);
    }

    #[test]
    fn unauthorized_record_score_rejects_and_preserves_state() {
        let env = Env::default();
        let (admin, _, stranger, client) = setup(&env);
        let subject = Address::generate(&env);

        // Admin is privileged for other ops but is not the scorer.
        assert_eq!(
            client.try_record_score(&admin, &subject, &800, &factors(&env)),
            Err(Ok(Error::Unauthorized))
        );
        assert_eq!(
            client.try_record_score(&stranger, &subject, &800, &factors(&env)),
            Err(Ok(Error::Unauthorized))
        );
        assert!(client.get_score(&subject).is_none());
    }

    #[test]
    fn authorized_scorer_updates_score() {
        let env = Env::default();
        let (_, scorer, _, client) = setup(&env);
        let subject = Address::generate(&env);

        client.record_score(&scorer, &subject, &700, &factors(&env));
        let updated = client.update_score(&scorer, &subject, &750, &factors(&env));
        assert_eq!(updated.value, 750);

        let stored = client.get_score(&subject).unwrap();
        assert_eq!(stored.value, 750);
    }

    #[test]
    fn unauthorized_update_score_rejects_and_preserves_state() {
        let env = Env::default();
        let (admin, scorer, stranger, client) = setup(&env);
        let subject = Address::generate(&env);

        client.record_score(&scorer, &subject, &700, &factors(&env));
        let before = client.get_score(&subject).unwrap();

        assert_eq!(
            client.try_update_score(&stranger, &subject, &999, &factors(&env)),
            Err(Ok(Error::Unauthorized))
        );
        assert_eq!(
            client.try_update_score(&admin, &subject, &999, &factors(&env)),
            Err(Ok(Error::Unauthorized))
        );

        let after = client.get_score(&subject).unwrap();
        assert_eq!(after, before);
        assert_eq!(after.value, 700);
    }

    #[test]
    fn authorized_admin_clears_score() {
        let env = Env::default();
        let (admin, scorer, _, client) = setup(&env);
        let subject = Address::generate(&env);

        client.record_score(&scorer, &subject, &700, &factors(&env));
        client.clear_score(&admin, &subject);
        assert!(client.get_score(&subject).is_none());
    }

    #[test]
    fn unauthorized_clear_score_rejects_and_preserves_state() {
        let env = Env::default();
        let (_, scorer, stranger, client) = setup(&env);
        let subject = Address::generate(&env);

        client.record_score(&scorer, &subject, &700, &factors(&env));
        let before = client.get_score(&subject).unwrap();

        // Scorer can write but cannot clear.
        assert_eq!(
            client.try_clear_score(&scorer, &subject),
            Err(Ok(Error::Unauthorized))
        );
        assert_eq!(
            client.try_clear_score(&stranger, &subject),
            Err(Ok(Error::Unauthorized))
        );

        let after = client.get_score(&subject).unwrap();
        assert_eq!(after, before);
        assert_eq!(after.value, 700);
    }

    #[test]
    fn privileged_ops_before_initialize_reject_without_writes() {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(&env, &contract_id);
        let caller = Address::generate(&env);
        let subject = Address::generate(&env);
        env.mock_all_auths();

        assert_eq!(
            client.try_set_scorer(&caller, &caller),
            Err(Ok(Error::NotInitialized))
        );
        assert_eq!(
            client.try_record_score(&caller, &subject, &500, &factors(&env)),
            Err(Ok(Error::NotInitialized))
        );
        assert_eq!(
            client.try_update_score(&caller, &subject, &500, &factors(&env)),
            Err(Ok(Error::NotInitialized))
        );
        assert_eq!(
            client.try_clear_score(&caller, &subject),
            Err(Ok(Error::NotInitialized))
        );
        assert!(client.get_score(&subject).is_none());
        assert!(client.get_admin().is_none());
        assert!(client.get_scorer().is_none());
    }

    #[test]
    fn public_get_score_needs_no_privilege() {
        let env = Env::default();
        let (_, scorer, _, client) = setup(&env);
        let subject = Address::generate(&env);

        assert!(client.get_score(&subject).is_none());
        client.record_score(&scorer, &subject, &640, &factors(&env));
        assert_eq!(client.get_score(&subject).unwrap().value, 640);
    }

    #[test]
    fn reinitialize_is_rejected_without_replacing_admin() {
        let env = Env::default();
        let (admin, _, stranger, client) = setup(&env);

        assert_eq!(
            client.try_initialize(&stranger),
            Err(Ok(Error::AlreadyInitialized))
        );
        assert_eq!(client.get_admin(), Some(admin));
    }
}
