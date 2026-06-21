use soroban_sdk::{symbol_short, Address, Env, IntoVal, Map, String, Symbol, TryFromVal, Val, Vec};

const TRANSACTION_HISTORY_KEY: Symbol = symbol_short!("tx_hist");
const BLACKLIST_KEY: Symbol = symbol_short!("blacklist");
const WHITELIST_KEY: Symbol = symbol_short!("whitelist");
const CONFIG_KEY: Symbol = symbol_short!("config");
const YEAR_LEDGERS: u32 = 6_307_200;

#[derive(Clone, Debug)]
pub struct TransactionRecord {
    pub timestamp: u64,
    pub amount: i128,
    pub from_address: Address,
    pub to_address: Address,
    pub transaction_type: String,
}

impl TryFromVal<Env, Val> for TransactionRecord {
    type Error = soroban_sdk::Error;

    fn try_from_val(env: &Env, val: &Val) -> Result<Self, Self::Error> {
        let tuple: (u64, i128, Address, Address, String) = TryFromVal::try_from_val(env, val)?;
        Ok(TransactionRecord {
            timestamp: tuple.0,
            amount: tuple.1,
            from_address: tuple.2,
            to_address: tuple.3,
            transaction_type: tuple.4,
        })
    }
}

impl IntoVal<Env, Val> for TransactionRecord {
    fn into_val(&self, env: &Env) -> Val {
        (
            self.timestamp,
            self.amount,
            self.from_address.clone(),
            self.to_address.clone(),
            self.transaction_type.clone(),
        )
            .into_val(env)
    }
}

#[derive(Clone)]
pub struct FraudConfig {
    pub velocity_threshold: u32,
    pub velocity_window: u64,
    pub max_single_amount: i128,
    pub risk_score_threshold: u32,
    pub anomaly_threshold: i64,
}

impl TryFromVal<Env, Val> for FraudConfig {
    type Error = soroban_sdk::Error;

    fn try_from_val(env: &Env, val: &Val) -> Result<Self, Self::Error> {
        let tuple: (u32, u64, i128, u32, i64) = TryFromVal::try_from_val(env, val)?;
        Ok(FraudConfig {
            velocity_threshold: tuple.0,
            velocity_window: tuple.1,
            max_single_amount: tuple.2,
            risk_score_threshold: tuple.3,
            anomaly_threshold: tuple.4,
        })
    }
}

impl IntoVal<Env, Val> for FraudConfig {
    fn into_val(&self, env: &Env) -> Val {
        (
            self.velocity_threshold,
            self.velocity_window,
            self.max_single_amount,
            self.risk_score_threshold,
            self.anomaly_threshold,
        )
            .into_val(env)
    }
}

impl Default for FraudConfig {
    fn default() -> Self {
        Self {
            velocity_threshold: 10,
            velocity_window: 3600,
            max_single_amount: 10000i128,
            risk_score_threshold: 70,
            anomaly_threshold: 80,
        }
    }
}

pub fn store_transaction(env: &Env, user: &Address, record: &TransactionRecord) {
    let mut user_history: Vec<TransactionRecord> = get_transaction_history(env, user);

    user_history.push_back(record.clone());

    let max_history_size = 1000;
    if user_history.len() > max_history_size {
        user_history.remove(0);
    }

    env.storage()
        .persistent()
        .set(&(TRANSACTION_HISTORY_KEY, user), &user_history);
    env.storage().persistent().extend_ttl(
        &(TRANSACTION_HISTORY_KEY, user),
        YEAR_LEDGERS,
        YEAR_LEDGERS,
    );
}

pub fn get_transaction_history(env: &Env, user: &Address) -> Vec<TransactionRecord> {
    env.storage()
        .persistent()
        .get(&(TRANSACTION_HISTORY_KEY, user))
        .unwrap_or_else(|| Vec::new(env))
}

pub fn add_to_blacklist(env: &Env, address: &Address) {
    let mut blacklist: Map<Address, u64> = get_blacklist(env);
    let current_ledger = env.ledger().sequence();
    blacklist.set(address.clone(), current_ledger as u64);
    env.storage().persistent().set(&BLACKLIST_KEY, &blacklist);
    env.storage()
        .persistent()
        .extend_ttl(&BLACKLIST_KEY, YEAR_LEDGERS, YEAR_LEDGERS);
}

pub fn remove_from_blacklist(env: &Env, address: &Address) {
    let mut blacklist: Map<Address, u64> = get_blacklist(env);
    blacklist.remove(address.clone());
    env.storage().persistent().set(&BLACKLIST_KEY, &blacklist);
    env.storage()
        .persistent()
        .extend_ttl(&BLACKLIST_KEY, YEAR_LEDGERS, YEAR_LEDGERS);
}

pub fn get_blacklist(env: &Env) -> Map<Address, u64> {
    env.storage()
        .persistent()
        .get(&BLACKLIST_KEY)
        .unwrap_or_else(|| Map::new(env))
}

pub fn is_blacklisted(env: &Env, address: &Address) -> bool {
    let blacklist = get_blacklist(env);
    blacklist.contains_key(address.clone())
}

pub fn add_to_whitelist(env: &Env, address: &Address) {
    let mut whitelist: Map<Address, u64> = get_whitelist(env);
    let current_ledger = env.ledger().sequence();
    whitelist.set(address.clone(), current_ledger as u64);
    env.storage().persistent().set(&WHITELIST_KEY, &whitelist);
    env.storage()
        .persistent()
        .extend_ttl(&WHITELIST_KEY, YEAR_LEDGERS, YEAR_LEDGERS);
}

pub fn remove_from_whitelist(env: &Env, address: &Address) {
    let mut whitelist: Map<Address, u64> = get_whitelist(env);
    whitelist.remove(address.clone());
    env.storage().persistent().set(&WHITELIST_KEY, &whitelist);
    env.storage()
        .persistent()
        .extend_ttl(&WHITELIST_KEY, YEAR_LEDGERS, YEAR_LEDGERS);
}

pub fn get_whitelist(env: &Env) -> Map<Address, u64> {
    env.storage()
        .persistent()
        .get(&WHITELIST_KEY)
        .unwrap_or_else(|| Map::new(env))
}

pub fn is_whitelisted(env: &Env, address: &Address) -> bool {
    let whitelist = get_whitelist(env);
    whitelist.contains_key(address.clone())
}

pub fn set_config(env: &Env, config: &FraudConfig) {
    env.storage().instance().set(&CONFIG_KEY, config);
}

pub fn get_config(env: &Env) -> FraudConfig {
    env.storage()
        .instance()
        .get(&CONFIG_KEY)
        .unwrap_or_default()
}

pub fn get_transactions_in_window(
    env: &Env,
    user: &Address,
    window_start: u64,
    window_end: u64,
) -> Vec<TransactionRecord> {
    let history = get_transaction_history(env, user);
    let mut filtered = Vec::new(env);

    for record in history.iter() {
        if record.timestamp >= window_start && record.timestamp <= window_end {
            filtered.push_back(record.clone());
        }
    }

    filtered
}

pub fn clear_transaction_history(env: &Env, user: &Address) {
    env.storage()
        .persistent()
        .remove(&(TRANSACTION_HISTORY_KEY, user));
}
