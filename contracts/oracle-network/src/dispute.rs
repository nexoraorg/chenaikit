use soroban_sdk::{Address, Env, String};
use crate::{SubmissionStatus, SubmissionPhase};
use crate::storage::get_config_or_default;
use crate::events::emit_dispute_filed;

/// Dispute data structure
#[derive(Clone)]
pub struct Dispute {
    pub disputer: Address,
    pub request_id: u64,
    pub filed_at: u64,
    pub evidence: String,
    pub status: DisputeStatus,
    pub resolved_at: Option<u64>,
}

#[derive(Clone, Copy)]
pub enum DisputeStatus {
    Pending,
    Accepted,
    Rejected,
}

/// File a dispute against a finalized score
pub fn file_dispute(env: &Env, disputer: &Address, request_id: u64, evidence: String) {
    let config = get_config_or_default(env);
    
    // Get submission status
    let submissions = crate::storage::get_submissions_map(env);
    let status = submissions.get(request_id)
        .expect("submission not found");
    
    if status.phase != SubmissionPhase::Finalized {
        panic!("can only dispute finalized submissions");
    }
    
    // Check dispute window
    if let Some(finalized_at) = status.finalized_at {
        let current_time = env.ledger().timestamp();
        let window = config.dispute_window_ledgers as u64 * 5; // Approximate seconds per ledger
        
        if current_time - finalized_at > window {
            panic!("dispute window expired");
        }
    }
    
    // Check if disputer is staked
    let node_info = crate::node_registry::get_node(env, disputer);
    if node_info.stake < config.min_stake {
        panic!("disputer must have minimum stake");
    }
    
    // Create dispute record
    let dispute = Dispute {
        disputer: disputer.clone(),
        request_id,
        filed_at: env.ledger().timestamp(),
        evidence,
        status: DisputeStatus::Pending,
        resolved_at: None,
    };
    
    // Store dispute
    let mut disputes = get_disputes_map(env);
    let dispute_key = (request_id, disputer);
    
    if disputes.contains_key(&dispute_key) {
        panic!("dispute already filed");
    }
    
    disputes.set(dispute_key, dispute);
    set_disputes_map(env, &disputes);
    
    emit_dispute_filed(env, disputer, request_id);
}

/// Accept a dispute and trigger re-aggregation
pub fn accept_dispute(env: &Env, request_id: u64, disputer: &Address) {
    let mut disputes = get_disputes_map(env);
    let dispute_key = (request_id, disputer);
    let mut dispute = disputes.get(&dispute_key)
        .expect("dispute not found");
    
    if dispute.status != DisputeStatus::Pending {
        panic!("dispute already resolved");
    }
    
    dispute.status = DisputeStatus::Accepted;
    dispute.resolved_at = Some(env.ledger().timestamp());
    
    disputes.set(dispute_key, dispute);
    set_disputes_map(env, &disputes);
    
    // Trigger re-aggregation with fresh node set
    trigger_re_aggregation(env, request_id);
}

/// Reject a dispute
pub fn reject_dispute(env: &Env, request_id: u64, disputer: &Address) {
    let mut disputes = get_disputes_map(env);
    let dispute_key = (request_id, disputer);
    let mut dispute = disputes.get(&dispute_key)
        .expect("dispute not found");
    
    if dispute.status != DisputeStatus::Pending {
        panic!("dispute already resolved");
    }
    
    dispute.status = DisputeStatus::Rejected;
    dispute.resolved_at = Some(env.ledger().timestamp());
    
    disputes.set(dispute_key, dispute);
    set_disputes_map(env, &disputes);
    
    // Slash disputer for frivolous dispute
    let config = get_config_or_default(env);
    let node_info = crate::node_registry::get_node(env, disputer);
    let slash_amount = (node_info.stake * config.slash_percentage as i128) / 200; // Half slash
    
    crate::node_registry::slash_node(env, disputer, slash_amount);
}

/// Trigger re-aggregation with fresh node set
fn trigger_re_aggregation(env: &Env, request_id: u64) {
    // Update submission status to disputed
    let mut submissions = crate::storage::get_submissions_map(env);
    let mut status = submissions.get(request_id)
        .expect("submission not found");
    
    status.phase = SubmissionPhase::Disputed;
    submissions.set(request_id, status);
    crate::storage::set_submissions_map(env, &submissions);
    
    // In a real implementation, this would:
    // 1. Select a fresh set of nodes using verifiable randomness
    // 2. Request new submissions from those nodes
    // 3. Re-aggregate and compare with original
    // 4. Slash nodes if the new aggregate differs significantly
}

/// Get disputes map
pub fn get_disputes_map(env: &Env) -> soroban_sdk::Map<(u64, Address), Dispute> {
    env.storage()
        .instance()
        .get(&soroban_sdk::Symbol::short("disputes"))
        .unwrap_or_else(|| soroban_sdk::Map::new(env))
}

/// Set disputes map
pub fn set_disputes_map(env: &Env, disputes: &soroban_sdk::Map<(u64, Address), Dispute>) {
    env.storage().instance().set(&soroban_sdk::Symbol::short("disputes"), disputes);
}

/// Get dispute for a request
pub fn get_dispute(env: &Env, request_id: u64, disputer: &Address) -> Dispute {
    let disputes = get_disputes_map(env);
    disputes.get((request_id, disputer))
        .expect("dispute not found")
}
