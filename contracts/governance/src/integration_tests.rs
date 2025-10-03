#![cfg(test)]
//! Integration Tests for Governance System

use crate::governance_token::{GovernanceToken, GovernanceTokenClient};
use crate::proposal_manager::{ProposalManager, ProposalManagerClient};
use crate::timelock::{Timelock, TimelockClient};
use crate::types::{GovernanceConfig, ProposalState, VoteSupport};
use crate::voting_system::{VotingSystem, VotingSystemClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, Bytes, Env, String, Vec};

/// Helper to setup a complete governance system
fn setup_governance(env: &Env) -> (
    Address,
    GovernanceTokenClient,
    TimelockClient,
    VotingSystemClient,
    ProposalManagerClient,
) {
    let token_id = env.register_contract(None, GovernanceToken);
    let token_client = GovernanceTokenClient::new(env, &token_id);

    let timelock_id = env.register_contract(None, Timelock);
    let timelock_client = TimelockClient::new(env, &timelock_id);

    let voting_id = env.register_contract(None, VotingSystem);
    let voting_client = VotingSystemClient::new(env, &voting_id);

    let proposal_id = env.register_contract(None, ProposalManager);
    let proposal_client = ProposalManagerClient::new(env, &proposal_id);

    let admin = Address::generate(env);

    (
        admin,
        token_client,
        timelock_client,
        voting_client,
        proposal_client,
    )
}

#[test]
fn test_complete_governance_flow() {
    let env = Env::default();
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
        li.timestamp = 1_000_000;
    });

    let (admin, token, timelock, voting, proposals) = setup_governance(&env);

    env.mock_all_auths();

    // Initialize token
    token.initialize(
        &admin,
        &String::from_str(&env, "Governance"),
        &String::from_str(&env, "GOV"),
        &18,
        &10_000_000u128,
    );

    // Create voters
    let proposer = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);

    // Distribute tokens
    token.transfer(&admin, &proposer, &1_000_000u128);
    token.transfer(&admin, &voter1, &3_000_000u128);
    token.transfer(&admin, &voter2, &2_000_000u128);
    token.transfer(&admin, &voter3, &2_000_000u128);

    // Advance block so checkpoints are in the past
    env.ledger().with_mut(|li| li.sequence_number = 1005);

    // Initialize timelock (2 hour delay for testing)
    timelock.initialize(&proposals.address, &7200u64);

    // Initialize governance
    let config = GovernanceConfig {
        voting_delay: 10,
        voting_period: 100,
        proposal_threshold: 500_000,
        quorum_numerator: 30,
        timelock_delay: 7200,
    };
    proposals.initialize(&admin, &token.address, &timelock.address, &voting.address, &config);

    // Create proposal
    let targets = Vec::from_array(&env, [Address::generate(&env)]);
    let values = Vec::from_array(&env, [0u128]);
    let calldatas = Vec::from_array(&env, [Bytes::new(&env)]);
    let description = String::from_str(&env, "Upgrade protocol");

    let prop_id = proposals.propose(&proposer, &targets, &values, &calldatas, &description);
    assert_eq!(prop_id, 1);

    // Verify pending state
    assert_eq!(proposals.state(&prop_id), ProposalState::Pending);

    // Advance to active voting (proposal created at 1005, voting_delay is 10, so active at 1015)
    env.ledger().with_mut(|li| li.sequence_number = 1016);
    assert_eq!(proposals.state(&prop_id), ProposalState::Active);

    // Get proposal to know snapshot block
    let proposal = proposals.get_proposal(&prop_id);
    let snapshot_block = proposal.start_block;

    // Cast votes and record them in proposal
    let vote1 = voting.cast_vote(&token.address, &prop_id, &snapshot_block, &voter1, &VoteSupport::For);
    proposals.record_vote(&prop_id, &VoteSupport::For, &vote1.votes);
    
    let vote2 = voting.cast_vote(&token.address, &prop_id, &snapshot_block, &voter2, &VoteSupport::For);
    proposals.record_vote(&prop_id, &VoteSupport::For, &vote2.votes);
    
    let vote3 = voting.cast_vote(&token.address, &prop_id, &snapshot_block, &voter3, &VoteSupport::Against);
    proposals.record_vote(&prop_id, &VoteSupport::Against, &vote3.votes);

    // Verify votes recorded
    assert!(voting.has_voted(&prop_id, &voter1));
    assert!(voting.has_voted(&prop_id, &voter2));
    assert!(voting.has_voted(&prop_id, &voter3));

    // End voting period (voting_period is 100, so ends at 1115)
    env.ledger().with_mut(|li| li.sequence_number = 1120);
    assert_eq!(proposals.state(&prop_id), ProposalState::Succeeded);

    // Queue proposal
    let eta = proposals.queue(&prop_id);
    assert_eq!(proposals.state(&prop_id), ProposalState::Queued);

    // Try to execute before timelock - should fail

    // Advance past timelock
    env.ledger().with_mut(|li| li.timestamp = eta + 100);

    // Execute
    proposals.execute(&prop_id);
    assert_eq!(proposals.state(&prop_id), ProposalState::Executed);
}

#[test]
fn test_flash_loan_attack_prevention() {
    // Test that snapshot mechanism prevents flash loan attacks
    let env = Env::default();
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
        li.timestamp = 1_000_000;
    });

    let (admin, token, timelock, voting, proposals) = setup_governance(&env);
    env.mock_all_auths();

    token.initialize(
        &admin,
        &String::from_str(&env, "Gov"),
        &String::from_str(&env, "GOV"),
        &18,
        &10_000_000u128,
    );

    let attacker = Address::generate(&env);
    let proposer = Address::generate(&env);

    // Give proposer tokens to create proposal
    token.transfer(&admin, &proposer, &1_000_000u128);

    // Advance block so checkpoints are in the past
    env.ledger().with_mut(|li| li.sequence_number = 1005);

    timelock.initialize(&proposals.address, &7200u64);

    let config = GovernanceConfig {
        voting_delay: 10,
        voting_period: 100,
        proposal_threshold: 500_000,
        quorum_numerator: 30,
        timelock_delay: 7200,
    };
    proposals.initialize(&admin, &token.address, &timelock.address, &voting.address, &config);

    // Create proposal at block 1000
    let targets = Vec::from_array(&env, [Address::generate(&env)]);
    let values = Vec::from_array(&env, [0u128]);
    let calldatas = Vec::from_array(&env, [Bytes::new(&env)]);
    
    let prop_id = proposals.propose(
        &proposer,
        &targets,
        &values,
        &calldatas,
        &String::from_str(&env, "Test"),
    );

    // Get proposal to know snapshot block
    let proposal = proposals.get_proposal(&prop_id);
    let snapshot_block = proposal.start_block;

    // Advance past snapshot block
    env.ledger().with_mut(|li| li.sequence_number = snapshot_block as u32 + 5);

    // Attacker gets tokens AFTER snapshot (flash loan simulation)
    token.transfer(&admin, &attacker, &5_000_000u128);

    // Attacker tries to vote - should have 0 voting power at snapshot
    let attacker_power = token.get_prior_votes(&attacker, &snapshot_block);
    assert_eq!(attacker_power, 0);

    // Vote should fail or have no effect due to 0 voting power
    // (In production, this would panic with InsufficientBalance)
}

#[test]
fn test_delegation_prevents_double_voting() {
    let env = Env::default();
    env.ledger().with_mut(|li| li.sequence_number = 1000);

    let token_id = env.register_contract(None, GovernanceToken);
    let token_client = GovernanceTokenClient::new(&env, &token_id);

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    env.mock_all_auths();

    token_client.initialize(
        &admin,
        &String::from_str(&env, "Gov"),
        &String::from_str(&env, "GOV"),
        &18,
        &1_000_000u128,
    );

    token_client.transfer(&admin, &user1, &400_000u128);
    token_client.transfer(&admin, &user2, &300_000u128);

    // User1 delegates to User2
    token_client.delegate(&user1, &user2);

    // Verify voting power transfer
    assert_eq!(token_client.get_current_votes(&user1), 0);
    assert_eq!(token_client.get_current_votes(&user2), 700_000);

    // User1 still has token balance
    assert_eq!(token_client.balance_of(&user1), 400_000);
}

#[test]
fn test_quorum_and_threshold_enforcement() {
    let env = Env::default();
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
        li.timestamp = 1_000_000;
    });

    let (admin, token, timelock, voting, proposals) = setup_governance(&env);
    env.mock_all_auths();

    token.initialize(
        &admin,
        &String::from_str(&env, "Gov"),
        &String::from_str(&env, "GOV"),
        &18,
        &10_000_000u128,
    );

    let proposer = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    token.transfer(&admin, &proposer, &1_000_000u128);
    token.transfer(&admin, &voter1, &2_000_000u128);
    token.transfer(&admin, &voter2, &1_500_000u128);

    // Advance block so checkpoints are in the past
    env.ledger().with_mut(|li| li.sequence_number = 1005);

    timelock.initialize(&proposals.address, &7200u64);

    // Set 50% quorum requirement
    let config = GovernanceConfig {
        voting_delay: 10,
        voting_period: 100,
        proposal_threshold: 500_000,
        quorum_numerator: 50,
        timelock_delay: 7200,
    };
    proposals.initialize(&admin, &token.address, &timelock.address, &voting.address, &config);

    let targets = Vec::from_array(&env, [Address::generate(&env)]);
    let values = Vec::from_array(&env, [0u128]);
    let calldatas = Vec::from_array(&env, [Bytes::new(&env)]);

    let prop_id = proposals.propose(
        &proposer,
        &targets,
        &values,
        &calldatas,
        &String::from_str(&env, "Test"),
    );

    env.ledger().with_mut(|li| li.sequence_number = 1020);

    // Get proposal to know snapshot block
    let proposal = proposals.get_proposal(&prop_id);
    let snapshot_block = proposal.start_block;

    // Vote with insufficient quorum (only 35% of supply)
    let vote1 = voting.cast_vote(&token.address, &prop_id, &snapshot_block, &voter1, &VoteSupport::For);
    proposals.record_vote(&prop_id, &VoteSupport::For, &vote1.votes);
    
    let vote2 = voting.cast_vote(&token.address, &prop_id, &snapshot_block, &voter2, &VoteSupport::For);
    proposals.record_vote(&prop_id, &VoteSupport::For, &vote2.votes);

    env.ledger().with_mut(|li| li.sequence_number = 1130);

    // Proposal should be defeated due to insufficient quorum
    let final_proposal = proposals.get_proposal(&prop_id);
    let quorum_reached = voting.quorum_reached(
        &token.address,
        &final_proposal.for_votes,
        &final_proposal.against_votes,
        &final_proposal.abstain_votes,
        &50
    );
    assert!(!quorum_reached);
    assert_eq!(proposals.state(&prop_id), ProposalState::Defeated);
}

#[test]
fn test_proposal_cancellation() {
    let env = Env::default();
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
        li.timestamp = 1_000_000;
    });

    let (admin, token, timelock, voting, proposals) = setup_governance(&env);
    env.mock_all_auths();

    token.initialize(
        &admin,
        &String::from_str(&env, "Gov"),
        &String::from_str(&env, "GOV"),
        &18,
        &10_000_000u128,
    );

    let proposer = Address::generate(&env);
    token.transfer(&admin, &proposer, &1_000_000u128);

    // Advance block so checkpoints are in the past
    env.ledger().with_mut(|li| li.sequence_number = 1005);

    timelock.initialize(&proposals.address, &7200u64);

    let config = GovernanceConfig {
        voting_delay: 10,
        voting_period: 100,
        proposal_threshold: 500_000,
        quorum_numerator: 30,
        timelock_delay: 7200,
    };
    proposals.initialize(&admin, &token.address, &timelock.address, &voting.address, &config);

    let targets = Vec::from_array(&env, [Address::generate(&env)]);
    let values = Vec::from_array(&env, [0u128]);
    let calldatas = Vec::from_array(&env, [Bytes::new(&env)]);

    let prop_id = proposals.propose(
        &proposer,
        &targets,
        &values,
        &calldatas,
        &String::from_str(&env, "Test"),
    );

    // Proposer cancels
    proposals.cancel(&prop_id, &proposer);
    assert_eq!(proposals.state(&prop_id), ProposalState::Canceled);
}

#[test]
fn test_checkpoint_binary_search() {
    // Test that checkpoint binary search works correctly
    let env = Env::default();
    env.ledger().with_mut(|li| li.sequence_number = 100);

    let token_id = env.register_contract(None, GovernanceToken);
    let token_client = GovernanceTokenClient::new(&env, &token_id);

    let admin = Address::generate(&env);
    env.mock_all_auths();

    token_client.initialize(
        &admin,
        &String::from_str(&env, "Gov"),
        &String::from_str(&env, "GOV"),
        &18,
        &1_000_000u128,
    );

    // Create multiple checkpoints by transferring tokens
    let user = Address::generate(&env);

    // Block 100: admin has 1M
    assert_eq!(token_client.get_current_votes(&admin), 1_000_000);

    env.ledger().with_mut(|li| li.sequence_number = 200);
    token_client.transfer(&admin, &user, &100_000u128);
    // Block 200: admin has 900k

    env.ledger().with_mut(|li| li.sequence_number = 300);
    token_client.transfer(&admin, &user, &100_000u128);
    // Block 300: admin has 800k

    env.ledger().with_mut(|li| li.sequence_number = 400);
    token_client.transfer(&admin, &user, &100_000u128);
    // Block 400: admin has 700k

    // Query historical voting power
    assert_eq!(token_client.get_prior_votes(&admin, &150), 1_000_000);
    assert_eq!(token_client.get_prior_votes(&admin, &250), 900_000);
    assert_eq!(token_client.get_prior_votes(&admin, &350), 800_000);
    assert_eq!(token_client.get_current_votes(&admin), 700_000);
}

#[test]
#[should_panic]
fn test_transfer_more_than_balance() {
    let env = Env::default();
    let token_id = env.register_contract(None, GovernanceToken);
    let token_client = GovernanceTokenClient::new(&env, &token_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();

    token_client.initialize(
        &admin,
        &String::from_str(&env, "Gov"),
        &String::from_str(&env, "GOV"),
        &18,
        &1_000u128,
    );

    token_client.transfer(&admin, &user, &2_000u128);
}

#[test]
fn test_zero_amount_transfers() {
    let env = Env::default();
    let token_id = env.register_contract(None, GovernanceToken);
    let token_client = GovernanceTokenClient::new(&env, &token_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();

    token_client.initialize(
        &admin,
        &String::from_str(&env, "Gov"),
        &String::from_str(&env, "GOV"),
        &18,
        &1_000u128,
    );

    // Zero transfer should be no-op
    token_client.transfer(&admin, &user, &0u128);
    assert_eq!(token_client.balance_of(&admin), 1_000);
    assert_eq!(token_client.balance_of(&user), 0);
}

