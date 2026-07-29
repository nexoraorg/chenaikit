use soroban_sdk::{Address, BytesN, Env, Map, Symbol};
use crate::{SubmissionStatus, SubmissionPhase, storage};
use crate::events::emit_commit_submitted;
use crate::events::emit_reveal_submitted;
use crate::storage::get_config_or_default;
use crate::model_version::is_model_approved;

/// Storage keys for commit-reveal
const COMMITS_KEY: Symbol = Symbol::short("commits");
const REVEALS_KEY: Symbol = Symbol::short("reveals");
const REQUEST_COUNTER_KEY: Symbol = Symbol::short("req_cnt");

/// Commit data structure
#[derive(Clone)]
pub struct CommitData {
    pub node: Address,
    pub commit_hash: BytesN<32>,
    pub model_hash: BytesN<32>,
    pub submitted_at: u64,
}

/// Reveal data structure
#[derive(Clone)]
pub struct RevealData {
    pub node: Address,
    pub score: i128,
    pub salt: BytesN<32>,
    pub revealed_at: u64,
}

/// Submit commit hash
pub fn submit_commit(env: &Env, node: &Address, commit_hash: BytesN<32>, model_hash: BytesN<32>) {
    // Check if model is approved
    if !is_model_approved(env, model_hash) {
        panic!("model version not approved");
    }
    
    // Get or create request ID (using ledger as simple request ID for now)
    let request_id = env.ledger().sequence();
    
    // Store commit
    let mut commits = get_commits_map(env);
    let commit_key = (request_id, node);
    
    if commits.contains_key(&commit_key) {
        panic!("node already committed for this request");
    }
    
    let commit_data = CommitData {
        node: node.clone(),
        commit_hash,
        model_hash,
        submitted_at: env.ledger().timestamp(),
    };
    
    commits.set(commit_key, commit_data);
    set_commits_map(env, &commits);
    
    // Update submission status
    update_submission_commit_count(env, request_id);
    
    emit_commit_submitted(env, node, request_id, &commit_data.commit_hash);
}

/// Reveal the actual score and salt
pub fn reveal(env: &Env, node: &Address, score: i128, salt: BytesN<32>) {
    let request_id = env.ledger().sequence();
    
    // Verify commit exists
    let commits = get_commits_map(env);
    let commit_key = (request_id, node);
    let commit_data = commits.get(&commit_key)
        .expect("no commit found for this node and request");
    
    // Verify commit hash matches
    let expected_hash = compute_commit_hash(env, score, salt);
    if expected_hash != commit_data.commit_hash {
        panic!("commit hash mismatch");
    }
    
    // Store reveal
    let mut reveals = get_reveals_map(env);
    let reveal_key = (request_id, node);
    
    if reveals.contains_key(&reveal_key) {
        panic!("node already revealed for this request");
    }
    
    let reveal_data = RevealData {
        node: node.clone(),
        score,
        salt,
        revealed_at: env.ledger().timestamp(),
    };
    
    reveals.set(reveal_key, reveal_data);
    set_reveals_map(env, &reveals);
    
    // Update submission status
    update_submission_reveal_count(env, request_id);
    
    emit_reveal_submitted(env, node, request_id, score);
}

/// Compute commit hash from score and salt
pub fn compute_commit_hash(_env: &Env, score: i128, salt: BytesN<32>) -> BytesN<32> {
    // In a real implementation, this would use a proper hash function
    // For now, we use a simple XOR-based approach (NOT SECURE - for testing only)
    let mut result = [0u8; 32];
    let score_bytes = score.to_le_bytes();
    
    for i in 0..32 {
        result[i] = salt[i] ^ score_bytes[i % 16];
    }
    
    BytesN::from_array(&result)
}

/// Get submission status
pub fn get_submission_status(env: &Env, request_id: u64) -> SubmissionStatus {
    let submissions = storage::get_submissions_map(env);
    submissions.get(request_id)
        .unwrap_or_else(|| {
            // Create default status if not exists
            SubmissionStatus {
                request_id,
                model_hash: BytesN::from_array(&[0u8; 32]),
                commit_count: 0,
                reveal_count: 0,
                phase: SubmissionPhase::Commit,
                final_score: None,
                finalized_at: None,
            }
        })
}

/// Update submission commit count
fn update_submission_commit_count(env: &Env, request_id: u64) {
    let mut submissions = storage::get_submissions_map(env);
    let mut status = get_submission_status(env, request_id);
    
    status.commit_count += 1;
    submissions.set(request_id, status);
    storage::set_submissions_map(env, &submissions);
}

/// Update submission reveal count
fn update_submission_reveal_count(env: &Env, request_id: u64) {
    let mut submissions = storage::get_submissions_map(env);
    let mut status = get_submission_status(env, request_id);
    
    status.reveal_count += 1;
    submissions.set(request_id, status);
    storage::set_submissions_map(env, &submissions);
}

/// Get commits map
pub fn get_commits_map(env: &Env) -> Map<(u64, Address), CommitData> {
    env.storage()
        .instance()
        .get(&COMMITS_KEY)
        .unwrap_or_else(|| Map::new(env))
}

/// Set commits map
pub fn set_commits_map(env: &Env, commits: &Map<(u64, Address), CommitData>) {
    env.storage().instance().set(&COMMITS_KEY, commits);
}

/// Get reveals map
pub fn get_reveals_map(env: &Env) -> Map<(u64, Address), RevealData> {
    env.storage()
        .instance()
        .get(&REVEALS_KEY)
        .unwrap_or_else(|| Map::new(env))
}

/// Set reveals map
pub fn set_reveals_map(env: &Env, reveals: &Map<(u64, Address), RevealData>) {
    env.storage().instance().set(&REVEALS_KEY, reveals);
}

/// Check if commit phase is complete
pub fn is_commit_phase_complete(env: &Env, request_id: u64) -> bool {
    let status = get_submission_status(env, request_id);
    let config = get_config_or_default(env);
    let active_nodes = crate::node_registry::get_active_node_count(env);
    
    status.commit_count >= active_nodes.saturating_sub(config.quorum_threshold - 1)
}

/// Check if reveal phase is complete
pub fn is_reveal_phase_complete(env: &Env, request_id: u64) -> bool {
    let status = get_submission_status(env, request_id);
    let config = get_config_or_default(env);
    
    status.reveal_count >= config.quorum_threshold
}
