use soroban_sdk::{Env, Symbol, Address, BytesN};

/// Event topics
const NODE_REGISTERED: Symbol = Symbol::short("node_reg");
const NODE_UNREGISTERED: Symbol = Symbol::short("node_unreg");
const COMMIT_SUBMITTED: Symbol = Symbol::short("commit");
const REVEAL_SUBMITTED: Symbol = Symbol::short("reveal");
const AGGREGATION_FINALIZED: Symbol = Symbol::short("final");
const DISPUTE_FILED: Symbol = Symbol::short("dispute");
const SLASH_EXECUTED: Symbol = Symbol::short("slash");
const MODEL_APPROVED: Symbol = Symbol::short("model_app");
const MODEL_REVOKED: Symbol = Symbol::short("model_rev");

/// Emit node registered event
pub fn emit_node_registered(env: &Env, node: &Address, stake: i128) {
    env.events()
        .publish((NODE_REGISTERED, node), stake);
}

/// Emit node unregistered event
pub fn emit_node_unregistered(env: &Env, node: &Address) {
    env.events()
        .publish((NODE_UNREGISTERED, node), true);
}

/// Emit commit submitted event
pub fn emit_commit_submitted(env: &Env, node: &Address, request_id: u64, commit_hash: &BytesN<32>) {
    env.events()
        .publish((COMMIT_SUBMITTED, node, request_id), commit_hash);
}

/// Emit reveal submitted event
pub fn emit_reveal_submitted(env: &Env, node: &Address, request_id: u64, score: i128) {
    env.events()
        .publish((REVEAL_SUBMITTED, node, request_id), score);
}

/// Emit aggregation finalized event
pub fn emit_aggregation_finalized(env: &Env, request_id: u64, final_score: i128, node_count: u32) {
    env.events()
        .publish((AGGREGATION_FINALIZED, request_id), (final_score, node_count));
}

/// Emit dispute filed event
pub fn emit_dispute_filed(env: &Env, disputer: &Address, request_id: u64) {
    env.events()
        .publish((DISPUTE_FILED, disputer, request_id), true);
}

/// Emit slash executed event
pub fn emit_slash_executed(env: &Env, node: &Address, request_id: u64, slash_amount: i128) {
    env.events()
        .publish((SLASH_EXECUTED, node, request_id), slash_amount);
}

/// Emit model approved event
pub fn emit_model_approved(env: &Env, model_hash: &BytesN<32>) {
    env.events()
        .publish((MODEL_APPROVED,), model_hash);
}

/// Emit model revoked event
pub fn emit_model_revoked(env: &Env, model_hash: &BytesN<32>) {
    env.events()
        .publish((MODEL_REVOKED,), model_hash);
}
