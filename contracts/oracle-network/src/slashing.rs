use soroban_sdk::{Env, Address};
use crate::{SubmissionStatus, SubmissionPhase};
use crate::commit_reveal::get_reveals_map;
use crate::node_registry::{slash_node, update_reputation};
use crate::events::emit_slash_executed;
use crate::storage::get_config_or_default;

/// Execute slashing for nodes that deviated from aggregate
pub fn execute_slashing(env: &Env, request_id: u64) {
    let config = get_config_or_default(env);
    
    // Get submission status
    let submissions = crate::storage::get_submissions_map(env);
    let status = submissions.get(request_id)
        .expect("submission not found");
    
    if status.phase != SubmissionPhase::Finalized {
        panic!("can only slash finalized submissions");
    }
    
    let final_score = status.final_score
        .expect("final score not set");
    
    // Get all reveals
    let reveals = get_reveals_map(env);
    
    // Calculate tolerance
    let tolerance = config.variance_tolerance;
    
    for ((req_id, node), reveal_data) in reveals {
        if req_id != request_id {
            continue;
        }
        
        let score = reveal_data.score;
        let deviation = (score - final_score).abs();
        
        // Check if deviation exceeds tolerance
        if deviation > tolerance {
            // Calculate slash amount
            let node_info = crate::node_registry::get_node(env, &node);
            let slash_amount = (node_info.stake * config.slash_percentage as i128) / 100;
            
            // Execute slash
            slash_node(env, &node, slash_amount);
            
            // Reduce reputation
            update_reputation(env, &node, -100);
            
            emit_slash_executed(env, &node, request_id, slash_amount);
        }
    }
}

/// Slash nodes that failed to reveal after committing
pub fn slash_non_revealers(env: &Env, request_id: u64) {
    let config = get_config_or_default(env);
    
    // Get commits and reveals
    let commits = crate::commit_reveal::get_commits_map(env);
    let reveals = crate::commit_reveal::get_reveals_map(env);
    
    // Find nodes that committed but didn't reveal
    for ((req_id, node), _commit_data) in commits {
        if req_id != request_id {
            continue;
        }
        
        let reveal_key = (request_id, node.clone());
        if !reveals.contains_key(&reveal_key) {
            // Node committed but didn't reveal - slash
            let node_info = crate::node_registry::get_node(env, &node);
            let slash_amount = (node_info.stake * config.slash_percentage as i128) / 100;
            
            slash_node(env, &node, slash_amount);
            update_reputation(env, &node, -50);
            
            emit_slash_executed(env, &node, request_id, slash_amount);
        }
    }
}

/// Get slash amount for a node
pub fn calculate_slash_amount(env: &Env, node: &Address, deviation: i128, tolerance: i128) -> i128 {
    let config = get_config_or_default(env);
    let node_info = crate::node_registry::get_node(env, node);
    
    // Base slash percentage
    let base_percentage = config.slash_percentage as i128;
    
    // Increase slash based on severity of deviation
    let severity_multiplier = if deviation > tolerance * 2 {
        2 // Double slash for severe deviation
    } else {
        1
    };
    
    (node_info.stake * base_percentage * severity_multiplier) / 100
}
