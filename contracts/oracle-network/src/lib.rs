#![no_std]
//! oracle-network — multi-source oracle feed with explicit failure modes.
//!
//! Consumers must not treat missing, delayed, or inconsistent readings as
//! current. Aggregation either returns a fresh consensus value or rejects.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String, Vec};

/// A reading older than this many seconds is stale and cannot be current.
pub const STALE_THRESHOLD_SECS: u64 = 300;
/// Minimum fresh sources required before a quote is accepted.
pub const MIN_FRESH_SOURCES: u32 = 2;
/// Maximum allowed deviation from the median, in basis points (5%).
pub const MAX_DEVIATION_BPS: i128 = 500;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Sources,
    Registered(Address),
    Reading(String, Address),
    FeedSources(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OracleReading {
    pub source: Address,
    pub feed_id: String,
    pub value: i128,
    pub observed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AggregatedQuote {
    pub feed_id: String,
    pub value: i128,
    pub source_count: u32,
    pub observed_at: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    SourceUnavailable = 4,
    StaleData = 5,
    InsufficientSources = 6,
    ConflictingSources = 7,
    AlreadyRegistered = 8,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        let sources: Vec<Address> = Vec::new(&env);
        env.storage().instance().set(&DataKey::Sources, &sources);
        Ok(())
    }

    pub fn stale_threshold_secs(_env: Env) -> u64 {
        STALE_THRESHOLD_SECS
    }

    /// Register an oracle source. Admin only.
    pub fn register_source(env: Env, caller: Address, source: Address) -> Result<(), Error> {
        require_admin(&env, &caller)?;
        if env
            .storage()
            .instance()
            .has(&DataKey::Registered(source.clone()))
        {
            return Err(Error::AlreadyRegistered);
        }
        env.storage()
            .instance()
            .set(&DataKey::Registered(source.clone()), &true);
        let mut sources: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Sources)
            .unwrap_or_else(|| Vec::new(&env));
        sources.push_back(source);
        env.storage().instance().set(&DataKey::Sources, &sources);
        Ok(())
    }

    /// Store a source reading. Rejects unregistered sources.
    pub fn submit_reading(
        env: Env,
        source: Address,
        feed_id: String,
        value: i128,
        observed_at: u64,
    ) -> Result<OracleReading, Error> {
        source.require_auth();
        if !env
            .storage()
            .instance()
            .has(&DataKey::Registered(source.clone()))
        {
            return Err(Error::Unauthorized);
        }

        let reading = OracleReading {
            source: source.clone(),
            feed_id: feed_id.clone(),
            value,
            observed_at,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Reading(feed_id.clone(), source.clone()), &reading);

        let mut feed_sources: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::FeedSources(feed_id.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        if !contains_address(&feed_sources, &source) {
            feed_sources.push_back(source);
            env.storage()
                .persistent()
                .set(&DataKey::FeedSources(feed_id), &feed_sources);
        }
        Ok(reading)
    }

    pub fn get_reading(env: Env, feed_id: String, source: Address) -> Option<OracleReading> {
        env.storage()
            .persistent()
            .get(&DataKey::Reading(feed_id, source))
    }

    /// Aggregate fresh, agreeing sources. Never treats stale data as current.
    ///
    /// Rejects when sources are missing, all stale, below quorum, or in conflict.
    pub fn aggregate(env: Env, feed_id: String) -> Result<AggregatedQuote, Error> {
        let feed_sources: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::FeedSources(feed_id.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        if feed_sources.is_empty() {
            return Err(Error::SourceUnavailable);
        }

        let now = env.ledger().timestamp();
        let mut fresh_values: Vec<i128> = Vec::new(&env);
        let mut fresh_observed: Vec<u64> = Vec::new(&env);
        let mut stale_count: u32 = 0;

        let mut i: u32 = 0;
        while i < feed_sources.len() {
            let source = feed_sources.get(i).unwrap();
            if let Some(reading) = env
                .storage()
                .persistent()
                .get::<DataKey, OracleReading>(&DataKey::Reading(feed_id.clone(), source))
            {
                if is_stale(now, reading.observed_at) {
                    stale_count = stale_count.saturating_add(1);
                } else {
                    fresh_values.push_back(reading.value);
                    fresh_observed.push_back(reading.observed_at);
                }
            }
            i += 1;
        }

        if fresh_values.is_empty() {
            if stale_count > 0 {
                return Err(Error::StaleData);
            }
            return Err(Error::SourceUnavailable);
        }
        if fresh_values.len() < MIN_FRESH_SOURCES {
            return Err(Error::InsufficientSources);
        }

        sort_i128(&mut fresh_values);
        let median = fresh_values.get(fresh_values.len() / 2).unwrap();
        if has_conflict(&fresh_values, median) {
            return Err(Error::ConflictingSources);
        }

        let mut newest: u64 = 0;
        let mut j: u32 = 0;
        while j < fresh_observed.len() {
            let ts = fresh_observed.get(j).unwrap();
            if ts > newest {
                newest = ts;
            }
            j += 1;
        }

        Ok(AggregatedQuote {
            feed_id,
            value: median,
            source_count: fresh_values.len(),
            observed_at: newest,
        })
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

fn is_stale(now: u64, observed_at: u64) -> bool {
    now.saturating_sub(observed_at) > STALE_THRESHOLD_SECS
}

fn contains_address(list: &Vec<Address>, target: &Address) -> bool {
    let mut i: u32 = 0;
    while i < list.len() {
        if list.get(i).unwrap() == *target {
            return true;
        }
        i += 1;
    }
    false
}

fn sort_i128(values: &mut Vec<i128>) {
    let n = values.len();
    let mut i: u32 = 0;
    while i < n {
        let mut j: u32 = 0;
        while j + 1 < n.saturating_sub(i) {
            let a = values.get(j).unwrap();
            let b = values.get(j + 1).unwrap();
            if a > b {
                values.set(j, b);
                values.set(j + 1, a);
            }
            j += 1;
        }
        i += 1;
    }
}

fn has_conflict(sorted_values: &Vec<i128>, median: i128) -> bool {
    let mut i: u32 = 0;
    while i < sorted_values.len() {
        let value = sorted_values.get(i).unwrap();
        if exceeds_tolerance(value, median) {
            return true;
        }
        i += 1;
    }
    false
}

fn exceeds_tolerance(value: i128, median: i128) -> bool {
    let delta = (value - median).abs();
    let scale = median.abs();
    if scale == 0 {
        return delta > 0;
    }
    delta.saturating_mul(10_000) / scale > MAX_DEVIATION_BPS
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    fn feed(env: &Env) -> String {
        String::from_str(env, "credit-score")
    }

    fn set_time(env: &Env, ts: u64) {
        env.ledger().with_mut(|info| {
            info.timestamp = ts;
        });
    }

    fn setup(env: &Env) -> (Address, ContractClient<'_>) {
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(env, &contract_id);
        let admin = Address::generate(env);
        env.mock_all_auths();
        client.initialize(&admin);
        (admin, client)
    }

    fn register_pair(
        env: &Env,
        admin: &Address,
        client: &ContractClient<'_>,
    ) -> (Address, Address) {
        let a = Address::generate(env);
        let b = Address::generate(env);
        client.register_source(admin, &a);
        client.register_source(admin, &b);
        (a, b)
    }

    #[test]
    fn threshold_is_explicit() {
        let env = Env::default();
        let (_, client) = setup(&env);
        assert_eq!(client.stale_threshold_secs(), STALE_THRESHOLD_SECS);
        assert_eq!(STALE_THRESHOLD_SECS, 300);
    }

    #[test]
    fn unavailable_feed_is_rejected() {
        let env = Env::default();
        let (_, client) = setup(&env);
        assert_eq!(
            client.try_aggregate(&feed(&env)),
            Err(Ok(Error::SourceUnavailable))
        );
    }

    #[test]
    fn unregistered_source_cannot_submit() {
        let env = Env::default();
        let (_, client) = setup(&env);
        let ghost = Address::generate(&env);
        assert_eq!(
            client.try_submit_reading(&ghost, &feed(&env), &100, &1_000),
            Err(Ok(Error::Unauthorized))
        );
        assert!(client.get_reading(&feed(&env), &ghost).is_none());
    }

    #[test]
    fn stale_readings_are_not_treated_as_current() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let (a, b) = register_pair(&env, &admin, &client);
        let id = feed(&env);

        set_time(&env, 10_000);
        client.submit_reading(&a, &id, &100, &9_000);
        client.submit_reading(&b, &id, &101, &9_000);

        // Age 10_000 - 9_000 = 1_000s > 300s stale threshold.
        assert_eq!(client.try_aggregate(&id), Err(Ok(Error::StaleData)));
        let stored = client.get_reading(&id, &a).unwrap();
        assert_eq!(stored.value, 100);
        assert_eq!(stored.observed_at, 9_000);
    }

    #[test]
    fn stale_source_cannot_fill_quorum() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let (a, b) = register_pair(&env, &admin, &client);
        let id = feed(&env);

        set_time(&env, 10_000);
        // Fresh
        client.submit_reading(&a, &id, &100, &9_900);
        // Stale — must not count toward MIN_FRESH_SOURCES.
        client.submit_reading(&b, &id, &100, &9_000);

        assert_eq!(
            client.try_aggregate(&id),
            Err(Ok(Error::InsufficientSources))
        );
    }

    #[test]
    fn exactly_threshold_age_is_still_current() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let (a, b) = register_pair(&env, &admin, &client);
        let id = feed(&env);

        set_time(&env, 10_000);
        client.submit_reading(&a, &id, &100, &(10_000 - STALE_THRESHOLD_SECS));
        client.submit_reading(&b, &id, &100, &(10_000 - STALE_THRESHOLD_SECS));

        let quote = client.aggregate(&id);
        assert_eq!(quote.value, 100);
        assert_eq!(quote.source_count, 2);
        assert_eq!(quote.observed_at, 10_000 - STALE_THRESHOLD_SECS);
    }

    #[test]
    fn agreeing_fresh_sources_aggregate_to_median() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let (a, b) = register_pair(&env, &admin, &client);
        let c = Address::generate(&env);
        client.register_source(&admin, &c);
        let id = feed(&env);

        set_time(&env, 5_000);
        client.submit_reading(&a, &id, &100, &4_900);
        client.submit_reading(&b, &id, &101, &4_950);
        client.submit_reading(&c, &id, &102, &4_980);

        let quote = client.aggregate(&id);
        assert_eq!(quote.value, 101);
        assert_eq!(quote.source_count, 3);
        assert_eq!(quote.observed_at, 4_980);
        assert_eq!(quote.feed_id, id);
    }

    #[test]
    fn conflicting_sources_are_rejected_deterministically() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let (a, b) = register_pair(&env, &admin, &client);
        let id = feed(&env);

        set_time(&env, 5_000);
        client.submit_reading(&a, &id, &100, &4_900);
        client.submit_reading(&b, &id, &200, &4_900);

        assert_eq!(
            client.try_aggregate(&id),
            Err(Ok(Error::ConflictingSources))
        );
        // Storage is unchanged; neither value is promoted as current.
        assert_eq!(client.get_reading(&id, &a).unwrap().value, 100);
        assert_eq!(client.get_reading(&id, &b).unwrap().value, 200);
        assert_eq!(
            client.try_aggregate(&id),
            Err(Ok(Error::ConflictingSources))
        );
    }

    #[test]
    fn outlier_against_median_is_conflict_not_fallback() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let (a, b) = register_pair(&env, &admin, &client);
        let c = Address::generate(&env);
        client.register_source(&admin, &c);
        let id = feed(&env);

        set_time(&env, 5_000);
        client.submit_reading(&a, &id, &100, &4_900);
        client.submit_reading(&b, &id, &101, &4_900);
        client.submit_reading(&c, &id, &10_000, &4_900);

        assert_eq!(
            client.try_aggregate(&id),
            Err(Ok(Error::ConflictingSources))
        );
    }
}
