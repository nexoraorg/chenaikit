use soroban_sdk::{Env, Map, Address, Symbol, symbol_short};

const SCORE_KEY: Symbol = symbol_short!("score");
const YEAR_LEDGERS: u32 = 6_307_200;  // ~1 year in ledgers

pub fn get_score(env: &Env, user: &Address) -> i128 {
    let scores: Map<Address, i128> = env.storage().persistent().get(&SCORE_KEY)
        .unwrap_or_else(|| Map::new(env));
    scores.get(user.clone()).unwrap_or(0i128)
}

pub fn set_score(env: &Env, user: &Address, score: &i128) {
    // Note: Authorization should be handled by the caller (public contract functions)

    let mut scores: Map<Address, i128> = env.storage().persistent().get(&SCORE_KEY)
        .unwrap_or_else(|| Map::new(env));

    let old_score = scores.get(user.clone()).unwrap_or(0i128);
    scores.set(user.clone(), *score);

    env.storage().persistent().set(&SCORE_KEY, &scores);

    // Extend TTL for efficiency
    env.storage().persistent().extend_ttl(&SCORE_KEY, YEAR_LEDGERS, YEAR_LEDGERS);

    // Temporary storage for old score if needed
    env.storage().temporary().set(&symbol_short!("old_sc"), &old_score);
}

pub fn has_score(env: &Env, user: &Address) -> bool {
    let scores: Map<Address, i128> = env.storage().persistent().get(&SCORE_KEY)
        .unwrap_or_else(|| Map::new(env));
    scores.contains_key(user.clone())
}