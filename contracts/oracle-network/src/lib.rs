#![no_std]
//! Oracle Network smart contract for decentralized feeds, staking, and governance-driven slashing.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String,
    Symbol, Vec,
};

/// Default minimum stake required to register an oracle node.
pub const DEFAULT_MIN_STAKE: i128 = 100_000_000;

/// Default baseline reputation score assigned to newly registered nodes.
pub const INITIAL_REPUTATION: u32 = 1000;

/// Reputation penalty applied when a node submits an outlier value.
pub const OUTLIER_PENALTY: u32 = 100;

/// Reputation penalty applied when a node is slashed by governance.
pub const SLASH_PENALTY: u32 = 200;

/// Maximum number of submissions tracked in history per feed.
pub const MAX_SUBMISSION_HISTORY: u32 = 50;

/// Legacy stale threshold in seconds for backward compatibility.
pub const STALE_THRESHOLD_SECS: u64 = 300;

/// Legacy minimum fresh sources required for backward compatibility.
pub const MIN_FRESH_SOURCES: u32 = 2;

/// Legacy maximum deviation allowed in basis points.
pub const MAX_DEVIATION_BPS: i128 = 500;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NodeMetadata {
    pub address: Address,
    pub stake: i128,
    pub registered_at: u64,
    pub reputation: u32,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedConfig {
    pub feed_id: Symbol,
    pub freshness_window: u64,
    pub max_deviation_bps: u32,
    pub min_submissions: u32,
    pub registered_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Submission {
    pub node: Address,
    pub feed_id: Symbol,
    pub value: i128,
    pub timestamp: u64,
    pub submitted_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AggregatedValue {
    pub feed_id: Symbol,
    pub value: i128,
    pub timestamp: u64,
    pub node_count: u32,
    pub round: u64,
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

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Governance,
    MinStake,
    Node(Address),
    NodeList,
    Feed(Symbol),
    FeedList,
    Submissions(Symbol),
    Aggregated(Symbol),
    RoundCount(Symbol),
    Sources,
    Registered(Address),
    Reading(String, Address),
    FeedSources(String),
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
    InsufficientStake = 9,
    NodeNotRegistered = 10,
    NodeInactive = 11,
    FeedNotFound = 12,
    FeedAlreadyExists = 13,
    InvalidAmount = 14,
    FutureTimestamp = 15,
    InsufficientSubmissions = 16,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Initializes the contract with an admin account and default stake requirements.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::MinStake, &DEFAULT_MIN_STAKE);

        let sources: Vec<Address> = Vec::new(&env);
        env.storage().instance().set(&DataKey::Sources, &sources);

        let node_list: Vec<Address> = Vec::new(&env);
        env.storage().instance().set(&DataKey::NodeList, &node_list);

        let feed_list: Vec<Symbol> = Vec::new(&env);
        env.storage().instance().set(&DataKey::FeedList, &feed_list);

        Ok(())
    }

    /// Sets the governance contract address authorized to trigger slashing.
    pub fn set_governance(env: Env, admin: Address, governance: Address) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        env.storage()
            .instance()
            .set(&DataKey::Governance, &governance);
        Ok(())
    }

    /// Retrieves the configured governance contract address.
    pub fn get_governance(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Governance)
    }

    /// Configures the minimum stake required to register an active oracle node.
    pub fn set_min_stake(env: Env, admin: Address, min_stake: i128) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        if min_stake <= 0 {
            return Err(Error::InvalidAmount);
        }
        env.storage().instance().set(&DataKey::MinStake, &min_stake);
        Ok(())
    }

    /// Returns the current minimum stake threshold.
    pub fn get_min_stake(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::MinStake)
            .unwrap_or(DEFAULT_MIN_STAKE)
    }

    /// Registers an oracle node with deposited stake.
    pub fn register_node(env: Env, caller: Address, stake: i128) -> Result<(), Error> {
        caller.require_auth();

        let min_stake = Self::get_min_stake(env.clone());
        if stake < min_stake {
            return Err(Error::InsufficientStake);
        }

        if let Some(existing) = env
            .storage()
            .persistent()
            .get::<DataKey, NodeMetadata>(&DataKey::Node(caller.clone()))
        {
            if existing.is_active {
                return Err(Error::AlreadyRegistered);
            }
        }

        let metadata = NodeMetadata {
            address: caller.clone(),
            stake,
            registered_at: env.ledger().timestamp(),
            reputation: INITIAL_REPUTATION,
            is_active: true,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Node(caller.clone()), &metadata);

        let mut node_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::NodeList)
            .unwrap_or_else(|| Vec::new(&env));

        if !contains_address(&node_list, &caller) {
            node_list.push_back(caller.clone());
            env.storage().instance().set(&DataKey::NodeList, &node_list);
        }

        env.events()
            .publish((symbol_short!("reg_node"), caller), stake);
        Ok(())
    }

    /// Deregisters an active oracle node.
    pub fn deregister_node(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();

        let mut metadata: NodeMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::Node(caller.clone()))
            .ok_or(Error::NodeNotRegistered)?;

        if !metadata.is_active {
            return Err(Error::NodeInactive);
        }

        metadata.is_active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Node(caller.clone()), &metadata);

        env.events()
            .publish((symbol_short!("dereg"), caller), 0i128);
        Ok(())
    }

    /// Retrieves metadata for a registered oracle node.
    pub fn get_node(env: Env, node: Address) -> Option<NodeMetadata> {
        env.storage().persistent().get(&DataKey::Node(node))
    }

    /// Registers a new data feed with specified freshness, deviation tolerance, and quorum.
    pub fn register_feed(
        env: Env,
        admin: Address,
        feed_id: Symbol,
        freshness_window: u64,
        max_deviation_bps: u32,
        min_submissions: u32,
    ) -> Result<(), Error> {
        require_admin(&env, &admin)?;

        if freshness_window == 0 || min_submissions == 0 {
            return Err(Error::InvalidAmount);
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::Feed(feed_id.clone()))
        {
            return Err(Error::FeedAlreadyExists);
        }

        let config = FeedConfig {
            feed_id: feed_id.clone(),
            freshness_window,
            max_deviation_bps,
            min_submissions,
            registered_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Feed(feed_id.clone()), &config);

        let mut feed_list: Vec<Symbol> = env
            .storage()
            .instance()
            .get(&DataKey::FeedList)
            .unwrap_or_else(|| Vec::new(&env));

        if !contains_symbol(&feed_list, &feed_id) {
            feed_list.push_back(feed_id.clone());
            env.storage().instance().set(&DataKey::FeedList, &feed_list);
        }

        env.events()
            .publish((symbol_short!("feed_reg"), feed_id), 0i128);
        Ok(())
    }

    /// Retrieves configuration for a registered feed.
    pub fn get_feed_config(env: Env, feed_id: Symbol) -> Option<FeedConfig> {
        env.storage().persistent().get(&DataKey::Feed(feed_id))
    }

    /// Submits a data point from an authorized, staked oracle node.
    pub fn submit_data(
        env: Env,
        caller: Address,
        feed_id: Symbol,
        value: i128,
        timestamp: u64,
    ) -> Result<(), Error> {
        caller.require_auth();

        let mut node_meta: NodeMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::Node(caller.clone()))
            .ok_or(Error::NodeNotRegistered)?;

        if !node_meta.is_active {
            return Err(Error::NodeInactive);
        }

        let min_stake = Self::get_min_stake(env.clone());
        if node_meta.stake < min_stake {
            return Err(Error::InsufficientStake);
        }

        let feed_config: FeedConfig = env
            .storage()
            .persistent()
            .get(&DataKey::Feed(feed_id.clone()))
            .ok_or(Error::FeedNotFound)?;

        let now = env.ledger().timestamp();
        if timestamp > now.saturating_add(60) {
            return Err(Error::FutureTimestamp);
        }
        if now.saturating_sub(timestamp) > feed_config.freshness_window {
            return Err(Error::StaleData);
        }

        let submission = Submission {
            node: caller.clone(),
            feed_id: feed_id.clone(),
            value,
            timestamp,
            submitted_at: now,
        };

        let mut submissions: Vec<Submission> = env
            .storage()
            .persistent()
            .get(&DataKey::Submissions(feed_id.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        submissions.push_back(submission);
        if submissions.len() > MAX_SUBMISSION_HISTORY {
            let overflow = submissions.len() - MAX_SUBMISSION_HISTORY;
            let mut trimmed: Vec<Submission> = Vec::new(&env);
            let mut k = overflow;
            while k < submissions.len() {
                trimmed.push_back(submissions.get(k).unwrap());
                k += 1;
            }
            submissions = trimmed;
        }
        env.storage()
            .persistent()
            .set(&DataKey::Submissions(feed_id.clone()), &submissions);

        let mut fresh_values: Vec<i128> = Vec::new(&env);
        let mut idx: u32 = 0;
        while idx < submissions.len() {
            let sub = submissions.get(idx).unwrap();
            if now.saturating_sub(sub.timestamp) <= feed_config.freshness_window {
                fresh_values.push_back(sub.value);
            }
            idx += 1;
        }

        if fresh_values.len() >= feed_config.min_submissions {
            sort_i128(&mut fresh_values);
            let median_value = compute_median(&fresh_values);

            let delta = (value - median_value).abs();
            let base_scale = median_value.abs();
            let exceeds_threshold = if base_scale == 0 {
                delta > 0
            } else {
                delta.saturating_mul(10_000) / base_scale > feed_config.max_deviation_bps as i128
            };

            if exceeds_threshold {
                node_meta.reputation = node_meta.reputation.saturating_sub(OUTLIER_PENALTY);
                env.storage()
                    .persistent()
                    .set(&DataKey::Node(caller.clone()), &node_meta);

                env.events().publish(
                    (symbol_short!("repute"), caller.clone()),
                    node_meta.reputation as i128,
                );
            }

            let mut round: u64 = env
                .storage()
                .persistent()
                .get(&DataKey::RoundCount(feed_id.clone()))
                .unwrap_or(0);
            round += 1;
            env.storage()
                .persistent()
                .set(&DataKey::RoundCount(feed_id.clone()), &round);

            let aggregated = AggregatedValue {
                feed_id: feed_id.clone(),
                value: median_value,
                timestamp: now,
                node_count: fresh_values.len(),
                round,
            };

            env.storage()
                .persistent()
                .set(&DataKey::Aggregated(feed_id.clone()), &aggregated);

            env.events()
                .publish((symbol_short!("aggregate"), feed_id.clone()), median_value);
        }

        env.events()
            .publish((symbol_short!("submit"), feed_id, caller), value);
        Ok(())
    }

    /// Retrieves the most recent aggregated value for a feed.
    pub fn get_aggregated_value(env: Env, feed_id: Symbol) -> Option<AggregatedValue> {
        env.storage()
            .persistent()
            .get(&DataKey::Aggregated(feed_id))
    }

    /// Slashes a node stake and penalizes reputation via admin or governance invocation.
    pub fn slash_node(env: Env, admin: Address, node: Address, amount: i128) -> Result<(), Error> {
        admin.require_auth();

        let stored_admin: Option<Address> = env.storage().instance().get(&DataKey::Admin);
        let stored_gov: Option<Address> = env.storage().instance().get(&DataKey::Governance);

        let is_admin = stored_admin.as_ref() == Some(&admin);
        let is_gov = stored_gov.as_ref() == Some(&admin);

        if !is_admin && !is_gov {
            return Err(Error::Unauthorized);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut node_meta: NodeMetadata = env
            .storage()
            .persistent()
            .get(&DataKey::Node(node.clone()))
            .ok_or(Error::NodeNotRegistered)?;

        node_meta.stake = node_meta.stake.saturating_sub(amount);
        node_meta.reputation = node_meta.reputation.saturating_sub(SLASH_PENALTY);

        let min_stake = Self::get_min_stake(env.clone());
        if node_meta.stake < min_stake {
            node_meta.is_active = false;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Node(node.clone()), &node_meta);

        env.events().publish((symbol_short!("slash"), node), amount);
        Ok(())
    }

    /// Returns the legacy stale threshold in seconds.
    pub fn stale_threshold_secs(_env: Env) -> u64 {
        STALE_THRESHOLD_SECS
    }

    /// Registers a source in legacy reading registry. Admin only.
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

    /// Stores a source reading in legacy storage.
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

    /// Retrieves a single reading from legacy storage.
    pub fn get_reading(env: Env, feed_id: String, source: Address) -> Option<OracleReading> {
        env.storage()
            .persistent()
            .get(&DataKey::Reading(feed_id, source))
    }

    /// Computes consensus quote over legacy readings.
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

fn contains_symbol(list: &Vec<Symbol>, target: &Symbol) -> bool {
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

fn compute_median(sorted_values: &Vec<i128>) -> i128 {
    let len = sorted_values.len();
    if len % 2 == 1 {
        sorted_values.get(len / 2).unwrap()
    } else {
        let mid1 = sorted_values.get(len / 2 - 1).unwrap();
        let mid2 = sorted_values.get(len / 2).unwrap();
        (mid1 + mid2) / 2
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
        client.submit_reading(&a, &id, &100, &9_900);
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

    #[test]
    fn test_node_registration_and_staking() {
        let env = Env::default();
        let (_, client) = setup(&env);
        let node = Address::generate(&env);

        let stake_err = client.try_register_node(&node, &50_000_000);
        assert_eq!(stake_err, Err(Ok(Error::InsufficientStake)));

        client.register_node(&node, &100_000_000);
        let meta = client.get_node(&node).unwrap();
        assert_eq!(meta.address, node);
        assert_eq!(meta.stake, 100_000_000);
        assert_eq!(meta.reputation, INITIAL_REPUTATION);
        assert!(meta.is_active);

        let dup_err = client.try_register_node(&node, &100_000_000);
        assert_eq!(dup_err, Err(Ok(Error::AlreadyRegistered)));

        client.deregister_node(&node);
        let updated = client.get_node(&node).unwrap();
        assert!(!updated.is_active);

        let inactive_dereg = client.try_deregister_node(&node);
        assert_eq!(inactive_dereg, Err(Ok(Error::NodeInactive)));
    }

    #[test]
    fn test_feed_registration_and_config() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let non_admin = Address::generate(&env);
        let feed_sym = symbol_short!("credit_sc");

        let auth_err = client.try_register_feed(&non_admin, &feed_sym, &120, &500, &3);
        assert_eq!(auth_err, Err(Ok(Error::Unauthorized)));

        client.register_feed(&admin, &feed_sym, &120, &500, &3);
        let config = client.get_feed_config(&feed_sym).unwrap();
        assert_eq!(config.feed_id, feed_sym);
        assert_eq!(config.freshness_window, 120);
        assert_eq!(config.max_deviation_bps, 500);
        assert_eq!(config.min_submissions, 3);

        let dup_err = client.try_register_feed(&admin, &feed_sym, &120, &500, &3);
        assert_eq!(dup_err, Err(Ok(Error::FeedAlreadyExists)));
    }

    #[test]
    fn test_adversarial_data_submission_and_median_aggregation() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let feed_sym = symbol_short!("fraud_flg");

        client.register_feed(&admin, &feed_sym, &300, &1000, &3);

        let node1 = Address::generate(&env);
        let node2 = Address::generate(&env);
        let node3 = Address::generate(&env);
        let adversary = Address::generate(&env);

        client.register_node(&node1, &100_000_000);
        client.register_node(&node2, &100_000_000);
        client.register_node(&node3, &100_000_000);
        client.register_node(&adversary, &100_000_000);

        set_time(&env, 1000);

        client.submit_data(&node1, &feed_sym, &500, &1000);
        assert!(client.get_aggregated_value(&feed_sym).is_none());

        client.submit_data(&node2, &feed_sym, &510, &1000);
        assert!(client.get_aggregated_value(&feed_sym).is_none());

        client.submit_data(&node3, &feed_sym, &505, &1000);
        let agg = client.get_aggregated_value(&feed_sym).unwrap();
        assert_eq!(agg.value, 505);
        assert_eq!(agg.node_count, 3);
        assert_eq!(agg.round, 1);

        client.submit_data(&adversary, &feed_sym, &999_999, &1000);
        let adv_meta = client.get_node(&adversary).unwrap();
        assert_eq!(adv_meta.reputation, INITIAL_REPUTATION - OUTLIER_PENALTY);

        let agg2 = client.get_aggregated_value(&feed_sym).unwrap();
        assert_eq!(agg2.value, 507);
        assert_eq!(agg2.node_count, 4);
    }

    #[test]
    fn test_governance_slashing_and_deactivation() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let governance = Address::generate(&env);
        let node = Address::generate(&env);
        let impostor = Address::generate(&env);

        client.set_governance(&admin, &governance);
        assert_eq!(client.get_governance(), Some(governance.clone()));

        client.register_node(&node, &100_000_000);

        let unauth = client.try_slash_node(&impostor, &node, &10_000_000);
        assert_eq!(unauth, Err(Ok(Error::Unauthorized)));

        client.slash_node(&governance, &node, &30_000_000);
        let meta = client.get_node(&node).unwrap();
        assert_eq!(meta.stake, 70_000_000);
        assert_eq!(meta.reputation, INITIAL_REPUTATION - SLASH_PENALTY);
        assert!(!meta.is_active);

        let feed_sym = symbol_short!("credit_sc");
        client.register_feed(&admin, &feed_sym, &300, &500, &1);
        set_time(&env, 1000);

        let sub_err = client.try_submit_data(&node, &feed_sym, &750, &1000);
        assert_eq!(sub_err, Err(Ok(Error::NodeInactive)));
    }

    #[test]
    fn test_stale_and_future_submissions_rejected() {
        let env = Env::default();
        let (admin, client) = setup(&env);
        let node = Address::generate(&env);
        let feed_sym = symbol_short!("price_usd");

        client.register_node(&node, &100_000_000);
        client.register_feed(&admin, &feed_sym, &60, &500, &1);

        set_time(&env, 1000);

        let future_err = client.try_submit_data(&node, &feed_sym, &100, &1100);
        assert_eq!(future_err, Err(Ok(Error::FutureTimestamp)));

        let stale_err = client.try_submit_data(&node, &feed_sym, &100, &900);
        assert_eq!(stale_err, Err(Ok(Error::StaleData)));
    }
}
