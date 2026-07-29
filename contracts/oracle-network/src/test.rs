#[cfg(test)]
mod tests {
    use soroban_sdk::{Address, BytesN, Env};
    use super::*;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        
        let config = OracleNetworkContract::get_config(env.clone());
        assert_eq!(config.min_stake, 1_000_000);
        assert_eq!(config.quorum_threshold, 5);
    }

    #[test]
    fn test_register_node() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let node = Address::generate(&env);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::register_node(env.clone(), node.clone(), 1_000_000);
        
        let node_info = OracleNetworkContract::get_node(env.clone(), node.clone());
        assert_eq!(node_info.stake, 1_000_000);
        assert_eq!(node_info.reputation, 1000);
        assert!(node_info.is_active);
    }

    #[test]
    #[should_panic(expected = "stake below minimum required")]
    fn test_register_node_insufficient_stake() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let node = Address::generate(&env);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::register_node(env.clone(), node.clone(), 500_000);
    }

    #[test]
    fn test_approve_model_version() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let model_hash = BytesN::from_array(&[1u8; 32]);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::approve_model_version(
            env.clone(),
            governance.clone(),
            model_hash,
            soroban_sdk::String::from_str(&env, "Test model"),
        );
        
        assert!(OracleNetworkContract::is_model_approved(env.clone(), model_hash));
    }

    #[test]
    fn test_commit_reveal_flow() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let node = Address::generate(&env);
        let model_hash = BytesN::from_array(&[1u8; 32]);
        let commit_hash = BytesN::from_array(&[2u8; 32]);
        let salt = BytesN::from_array(&[3u8; 32]);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::approve_model_version(
            env.clone(),
            governance.clone(),
            model_hash,
            soroban_sdk::String::from_str(&env, "Test model"),
        );
        OracleNetworkContract::register_node(env.clone(), node.clone(), 1_000_000);
        
        OracleNetworkContract::submit_commit(env.clone(), node.clone(), commit_hash, model_hash);
        
        let status = OracleNetworkContract::get_submission(env.clone(), env.ledger().sequence());
        assert_eq!(status.commit_count, 1);
    }

    #[test]
    fn test_median_calculation() {
        let env = Env::default();
        let mut scores = soroban_sdk::Vec::new(&env);
        
        scores.push_back(100);
        scores.push_back(200);
        scores.push_back(300);
        scores.push_back(400);
        scores.push_back(500);
        
        let median = aggregation::calculate_median(&env, &scores);
        assert_eq!(median, 300);
    }

    #[test]
    fn test_variance_calculation() {
        let env = Env::default();
        let mut scores = soroban_sdk::Vec::new(&env);
        
        scores.push_back(100);
        scores.push_back(100);
        scores.push_back(100);
        
        let mean = aggregation::calculate_mean(&env, &scores);
        let variance = aggregation::calculate_variance(&env, &scores, mean);
        
        assert_eq!(variance, 0);
    }

    // Adversarial tests

    #[test]
    #[should_panic(expected = "no reveal submitted")]
    fn test_no_reveal_attack() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let node = Address::generate(&env);
        let model_hash = BytesN::from_array(&[1u8; 32]);
        let commit_hash = BytesN::from_array(&[2u8; 32]);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::approve_model_version(
            env.clone(),
            governance.clone(),
            model_hash,
            soroban_sdk::String::from_str(&env, "Test model"),
        );
        OracleNetworkContract::register_node(env.clone(), node.clone(), 1_000_000);
        
        OracleNetworkContract::submit_commit(env.clone(), node.clone(), commit_hash, model_hash);
        
        // Skip reveal phase and try to finalize
        env.ledger().set_timestamp(env.ledger().timestamp() + 10_000);
        
        // This should panic because no reveal was submitted
        OracleNetworkContract::finalize_aggregation(env.clone());
    }

    #[test]
    #[should_panic(expected = "reveal phase not active")]
    fn test_late_reveal_attack() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let node = Address::generate(&env);
        let model_hash = BytesN::from_array(&[1u8; 32]);
        let commit_hash = BytesN::from_array(&[2u8; 32]);
        let salt = BytesN::from_array(&[3u8; 32]);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::approve_model_version(
            env.clone(),
            governance.clone(),
            model_hash,
            soroban_sdk::String::from_str(&env, "Test model"),
        );
        OracleNetworkContract::register_node(env.clone(), node.clone(), 1_000_000);
        
        OracleNetworkContract::submit_commit(env.clone(), node.clone(), commit_hash, model_hash);
        
        // Skip past the reveal phase
        env.ledger().set_timestamp(env.ledger().timestamp() + 20_000);
        
        // Try to reveal after the phase is over
        OracleNetworkContract::submit_reveal(env.clone(), node.clone(), 100, salt);
    }

    #[test]
    fn test_dishonest_majority_attack() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let model_hash = BytesN::from_array(&[1u8; 32]);
        
        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::approve_model_version(
            env.clone(),
            governance.clone(),
            model_hash,
            soroban_sdk::String::from_str(&env, "Test model"),
        );

        // Register 7 nodes (dishonest majority = 4)
        let mut nodes = Vec::new();
        for i in 0..7 {
            let node = Address::generate(&env);
            OracleNetworkContract::register_node(env.clone(), node.clone(), 1_000_000);
            nodes.push(node);
        }

        // Honest nodes submit correct scores (around 100)
        let salt_honest = BytesN::from_array(&[1u8; 32]);
        for i in 0..3 {
            let commit_hash = BytesN::from_array(&[i as u8; 32]);
            OracleNetworkContract::submit_commit(env.clone(), nodes[i].clone(), commit_hash, model_hash);
            OracleNetworkContract::submit_reveal(env.clone(), nodes[i].clone(), 100, salt_honest);
        }

        // Dishonest nodes submit incorrect scores (around 1000)
        let salt_dishonest = BytesN::from_array(&[2u8; 32]);
        for i in 3..7 {
            let commit_hash = BytesN::from_array(&[i as u8; 32]);
            OracleNetworkContract::submit_commit(env.clone(), nodes[i].clone(), commit_hash, model_hash);
            OracleNetworkContract::submit_reveal(env.clone(), nodes[i].clone(), 1000, salt_dishonest);
        }

        env.ledger().set_timestamp(env.ledger().timestamp() + 10_000);
        
        // Finalize should detect high variance and trigger dispute window
        OracleNetworkContract::finalize_aggregation(env.clone());
        
        // Check that dispute window is active
        let config = OracleNetworkContract::get_config(env.clone());
        assert!(config.dispute_window_active);
    }

    #[test]
    #[should_panic(expected = "model not approved")]
    fn test_unapproved_model_attack() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let node = Address::generate(&env);
        let unapproved_model_hash = BytesN::from_array(&[99u8; 32]);
        let commit_hash = BytesN::from_array(&[2u8; 32]);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::register_node(env.clone(), node.clone(), 1_000_000);
        
        // Try to submit with an unapproved model
        OracleNetworkContract::submit_commit(env.clone(), node.clone(), commit_hash, unapproved_model_hash);
    }

    #[test]
    fn test_frivolous_dispute_penalty() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let node = Address::generate(&env);
        let disputer = Address::generate(&env);
        let model_hash = BytesN::from_array(&[1u8; 32]);
        let commit_hash = BytesN::from_array(&[2u8; 32]);
        let salt = BytesN::from_array(&[3u8; 32]);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::approve_model_version(
            env.clone(),
            governance.clone(),
            model_hash,
            soroban_sdk::String::from_str(&env, "Test model"),
        );
        OracleNetworkContract::register_node(env.clone(), node.clone(), 1_000_000);
        OracleNetworkContract::register_node(env.clone(), disputer.clone(), 1_000_000);
        
        OracleNetworkContract::submit_commit(env.clone(), node.clone(), commit_hash, model_hash);
        OracleNetworkContract::submit_reveal(env.clone(), node.clone(), 100, salt);

        env.ledger().set_timestamp(env.ledger().timestamp() + 10_000);
        OracleNetworkContract::finalize_aggregation(env.clone());

        // File a frivolous dispute
        let initial_reputation = OracleNetworkContract::get_node(env.clone(), disputer.clone()).reputation;
        OracleNetworkContract::file_dispute(
            env.clone(),
            disputer.clone(),
            env.ledger().sequence(),
            soroban_sdk::String::from_str(&env, "Frivolous dispute"),
        );

        // Resolve as rejected (frivolous)
        OracleNetworkContract::resolve_dispute(
            env.clone(),
            governance.clone(),
            env.ledger().sequence(),
            true, // rejected
        );

        // Check that disputer's reputation decreased
        let final_reputation = OracleNetworkContract::get_node(env.clone(), disputer.clone()).reputation;
        assert!(final_reputation < initial_reputation);
    }

    #[test]
    fn test_commit_hash_mismatch() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let node = Address::generate(&env);
        let model_hash = BytesN::from_array(&[1u8; 32]);
        let commit_hash = BytesN::from_array(&[2u8; 32]);
        let wrong_salt = BytesN::from_array(&[99u8; 32]);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::approve_model_version(
            env.clone(),
            governance.clone(),
            model_hash,
            soroban_sdk::String::from_str(&env, "Test model"),
        );
        OracleNetworkContract::register_node(env.clone(), node.clone(), 1_000_000);
        
        OracleNetworkContract::submit_commit(env.clone(), node.clone(), commit_hash, model_hash);
        
        // Try to reveal with wrong salt (commit hash won't match)
        let result = std::panic::catch_unwind(|| {
            OracleNetworkContract::submit_reveal(env.clone(), node.clone(), 100, wrong_salt);
        });
        
        assert!(result.is_err());
    }

    #[test]
    fn test_reputation_recovery_after_slashing() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let node = Address::generate(&env);
        let model_hash = BytesN::from_array(&[1u8; 32]);

        OracleNetworkContract::initialize(env.clone(), admin.clone(), governance.clone());
        OracleNetworkContract::approve_model_version(
            env.clone(),
            governance.clone(),
            model_hash,
            soroban_sdk::String::from_str(&env, "Test model"),
        );
        OracleNetworkContract::register_node(env.clone(), node.clone(), 1_000_000);

        let initial_reputation = OracleNetworkContract::get_node(env.clone(), node.clone()).reputation;
        
        // Slash the node
        OracleNetworkContract::slash_node(
            env.clone(),
            governance.clone(),
            node.clone(),
            soroban_sdk::String::from_str(&env, "no_reveal"),
        );

        let slashed_reputation = OracleNetworkContract::get_node(env.clone(), node.clone()).reputation;
        assert!(slashed_reputation < initial_reputation);

        // Node submits successful results to recover reputation
        let commit_hash = BytesN::from_array(&[2u8; 32]);
        let salt = BytesN::from_array(&[3u8; 32]);
        
        OracleNetworkContract::submit_commit(env.clone(), node.clone(), commit_hash, model_hash);
        OracleNetworkContract::submit_reveal(env.clone(), node.clone(), 100, salt);

        env.ledger().set_timestamp(env.ledger().timestamp() + 10_000);
        OracleNetworkContract::finalize_aggregation(env.clone());

        let recovered_reputation = OracleNetworkContract::get_node(env.clone(), node.clone()).reputation;
        assert!(recovered_reputation > slashed_reputation);
    }
}
