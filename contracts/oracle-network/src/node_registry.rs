use soroban_sdk::{Address, Env, Map};
use crate::{NodeInfo, storage};
use crate::events::emit_node_registered;
use crate::events::emit_node_unregistered;
use crate::storage::get_config_or_default;

/// Register a new oracle node with stake
pub fn register_node(env: &Env, node: &Address, stake_amount: i128) {
    let config = get_config_or_default(env);
    
    // Check minimum stake
    if stake_amount < config.min_stake {
        panic!("stake below minimum required");
    }
    
    // Check max nodes
    let mut nodes = storage::get_nodes_map(env);
    if nodes.len() >= config.max_nodes as u32 {
        panic!("maximum nodes reached");
    }
    
    // Check if already registered
    if nodes.contains_key(node) {
        panic!("node already registered");
    }
    
    // Create node info
    let node_info = NodeInfo {
        address: node.clone(),
        stake: stake_amount,
        reputation: 1000, // Starting reputation
        registered_at: env.ledger().timestamp(),
        is_active: true,
    };
    
    nodes.set(node, node_info);
    storage::set_nodes_map(env, &nodes);
    
    emit_node_registered(env, node, stake_amount);
}

/// Unregister a node and return stake
pub fn unregister_node(env: &Env, node: &Address) {
    let mut nodes = storage::get_nodes_map(env);
    
    let node_info = nodes.get(node)
        .expect("node not registered");
    
    // In a real implementation, this would initiate stake return
    // For now, we just mark as inactive
    let mut updated_info = node_info;
    updated_info.is_active = false;
    
    nodes.set(node, updated_info);
    storage::set_nodes_map(env, &nodes);
    
    emit_node_unregistered(env, node);
}

/// Get node information
pub fn get_node(env: &Env, node: &Address) -> NodeInfo {
    let nodes = storage::get_nodes_map(env);
    nodes.get(node)
        .expect("node not registered")
}

/// Get all registered nodes
pub fn get_all_nodes(env: &Env) -> soroban_sdk::Vec<NodeInfo> {
    let nodes = storage::get_nodes_map(env);
    let mut result = soroban_sdk::Vec::new(env);
    
    for (_addr, node_info) in nodes {
        if node_info.is_active {
            result.push_back(node_info);
        }
    }
    
    result
}

/// Get active node count
pub fn get_active_node_count(env: &Env) -> u32 {
    let nodes = storage::get_nodes_map(env);
    let mut count = 0u32;
    
    for (_addr, node_info) in nodes {
        if node_info.is_active {
            count += 1;
        }
    }
    
    count
}

/// Update node reputation
pub fn update_reputation(env: &Env, node: &Address, delta: i128) {
    let mut nodes = storage::get_nodes_map(env);
    let mut node_info = nodes.get(node)
        .expect("node not registered");
    
    node_info.reputation = node_info.reputation.checked_add(delta)
        .expect("reputation overflow");
    
    // Clamp reputation
    node_info.reputation = node_info.reputation.max(0);
    
    nodes.set(node, node_info);
    storage::set_nodes_map(env, &nodes);
}

/// Slash node stake
pub fn slash_node(env: &Env, node: &Address, slash_amount: i128) {
    let mut nodes = storage::get_nodes_map(env);
    let mut node_info = nodes.get(node)
        .expect("node not registered");
    
    if slash_amount > node_info.stake {
        panic!("slash amount exceeds stake");
    }
    
    node_info.stake -= slash_amount;
    
    nodes.set(node, node_info);
    storage::set_nodes_map(env, &nodes);
}
