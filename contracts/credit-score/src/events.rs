use soroban_sdk::{Env, Address, Symbol, symbol_short, BytesN};

const TOPIC_SCORE_UPDATE: Symbol = symbol_short!("sc_upd");
const TOPIC_SCORE_UPDATE_WITH_MODEL: Symbol = symbol_short!("sc_up_m");
const TOPIC_UPGRADE: Symbol = symbol_short!("upgd");

pub fn emit_score_updated(env: &Env, user: &Address, new_score: &i128) {
    env.events().publish((TOPIC_SCORE_UPDATE, user.clone()), *new_score);
}

pub fn emit_score_updated_with_model(env: &Env, user: &Address, new_score: &i128, model_hash: &BytesN<32>) {
    env.events().publish((TOPIC_SCORE_UPDATE_WITH_MODEL, user.clone()), (*new_score, model_hash));
}

pub fn emit_upgraded(env: &Env, version: &u32) {
    env.events().publish(((TOPIC_UPGRADE,),), *version);
}

// For "handling": Off-chain via RPC, but stub for in-contract log if needed
pub fn log_event(env: &Env, topic: Symbol, data: i128) {
    // Could extend to temp storage log for debugging
    env.storage().temporary().set(&topic, &data);
}