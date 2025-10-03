#![allow(unused)]
use crate::types::{GovernanceError, Proposal, VoteRecord, VoteSupport};
use crate::governance_token::GovernanceTokenClient;
use soroban_sdk::{contract, contractimpl, panic_with_error, symbol_short, Address, Env};

/// Voting System Contract - handles vote casting and tallying
#[contract]
pub struct VotingSystem;

#[contractimpl]
impl VotingSystem {
    /// Cast a vote on a proposal
    /// @notice Uses snapshot voting power to prevent manipulation
    /// @param env: Contract environment
    /// @param token_contract: Address of the governance token contract
    /// @param proposal_id: The proposal ID
    /// @param snapshot_block: The block number for snapshot voting power
    /// @param voter: The address casting the vote
    /// @param support: Vote choice (0=Against, 1=For, 2=Abstain)
    pub fn cast_vote(
        env: Env,
        token_contract: Address,
        proposal_id: u64,
        snapshot_block: u64,
        voter: Address,
        support: VoteSupport,
    ) -> VoteRecord {
        voter.require_auth();

        // Check if already voted
        if Self::has_voted(env.clone(), proposal_id, voter.clone()) {
            panic_with_error!(&env, GovernanceError::AlreadyVoted);
        }

        // Get voting power at snapshot block (proposal start block)
        // This prevents flash loan attacks and vote manipulation
        let token_client = GovernanceTokenClient::new(&env, &token_contract);
        let votes = token_client.get_prior_votes(&voter, &snapshot_block);

        if votes == 0 {
            panic_with_error!(&env, GovernanceError::InsufficientBalance);
        }

        // Record the vote
        let vote_record = VoteRecord {
            has_voted: true,
            support: support.clone(),
            votes,
        };

        env.storage().persistent().set(
            &(symbol_short!("VOTE"), proposal_id, voter.clone()),
            &vote_record
        );

        // Emit VoteCast event
        env.events().publish(
            (symbol_short!("VoteCast"), voter.clone()),
            (proposal_id, support as u32, votes)
        );

        vote_record
    }

    /// Cast vote with reason (for transparency)
    pub fn cast_vote_with_reason(
        env: Env,
        token_contract: Address,
        proposal_id: u64,
        snapshot_block: u64,
        voter: Address,
        support: VoteSupport,
        reason: soroban_sdk::String,
    ) -> VoteRecord {
        let vote_record = Self::cast_vote(env.clone(), token_contract, proposal_id, snapshot_block, voter.clone(), support);
        
        // Emit VoteCastWithReason event
        env.events().publish(
            (symbol_short!("VoteReas"), voter),
            (proposal_id, reason)
        );

        vote_record
    }

    /// Check if an address has voted on a proposal
    pub fn has_voted(env: Env, proposal_id: u64, voter: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, VoteRecord>(&(symbol_short!("VOTE"), proposal_id, voter))
            .map(|record| record.has_voted)
            .unwrap_or(false)
    }

    /// Get vote counts for a proposal by tallying all vote receipts
    /// Note: In production, this would be expensive. Better to maintain tallies in ProposalManager.
    /// For demonstration.
    pub fn get_votes(env: Env, proposal_id: u64) -> (u128, u128, u128) {
        // Return (0, 0, 0) as placeholder - in production, ProposalManager maintains tallies
        (0u128, 0u128, 0u128)
    }

    /// Get a specific vote receipt
    pub fn get_receipt(env: Env, proposal_id: u64, voter: Address) -> Option<VoteRecord> {
        env.storage()
            .persistent()
            .get(&(symbol_short!("VOTE"), proposal_id, voter))
    }

    /// Check if quorum has been reached for a proposal
    /// @notice Quorum = (For + Abstain + Against) >= (Total Supply * quorum_numerator / 100)
    /// @param for_votes: Current for votes (from ProposalManager)
    /// @param against_votes: Current against votes
    /// @param abstain_votes: Current abstain votes
    pub fn quorum_reached(
        env: Env,
        token_contract: Address,
        for_votes: u128,
        against_votes: u128,
        abstain_votes: u128,
        quorum_numerator: u64,
    ) -> bool {
        let token_client = GovernanceTokenClient::new(&env, &token_contract);
        let total_supply = token_client.total_supply();

        let total_votes = for_votes + against_votes + abstain_votes;
        let quorum = (total_supply * quorum_numerator as u128) / 100;

        total_votes >= quorum
    }

    /// Check if proposal has succeeded (passed threshold)
    /// @notice Proposal succeeds if: quorum reached AND for_votes > against_votes
    pub fn proposal_succeeded(
        env: Env,
        token_contract: Address,
        for_votes: u128,
        against_votes: u128,
        abstain_votes: u128,
        quorum_numerator: u64,
    ) -> bool {
        if !Self::quorum_reached(env.clone(), token_contract.clone(), for_votes, against_votes, abstain_votes, quorum_numerator) {
            return false;
        }

        for_votes > against_votes
    }

    /// Get turnout percentage (total votes / total supply * 100)
    pub fn get_turnout(
        env: Env,
        token_contract: Address,
        for_votes: u128,
        against_votes: u128,
        abstain_votes: u128,
    ) -> u64 {
        let token_client = GovernanceTokenClient::new(&env, &token_contract);
        let total_supply = token_client.total_supply();

        if total_supply == 0 {
            return 0;
        }

        let total_votes = for_votes + against_votes + abstain_votes;
        ((total_votes * 100) / total_supply) as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::governance_token::{GovernanceToken, GovernanceTokenClient};
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{Bytes, String, Vec};

    fn create_test_proposal(env: &Env, contract_id: &Address, proposal_id: u64, start_block: u64, end_block: u64) {
        let proposer = Address::generate(env);
        let proposal = Proposal {
            id: proposal_id,
            proposer,
            targets: Vec::new(env),
            values: Vec::new(env),
            calldatas: Vec::new(env),
            description: String::from_str(env, "Test proposal"),
            start_block,
            end_block,
            for_votes: 0,
            against_votes: 0,
            abstain_votes: 0,
            canceled: false,
            executed: false,
            eta: 0,
        };
        // Store proposal in the contract's context
        env.as_contract(contract_id, || {
            env.storage().persistent().set(&(symbol_short!("PROP"), proposal_id), &proposal);
        });
    }

    #[test]
    fn test_cast_vote() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 100);

        // Setup token
        let token_id = env.register_contract(None, GovernanceToken);
        let token_client = GovernanceTokenClient::new(&env, &token_id);

        let voter = Address::generate(&env);
        env.mock_all_auths();
        token_client.initialize(
            &voter,
            &String::from_str(&env, "Gov"),
            &String::from_str(&env, "GOV"),
            &18,
            &1_000_000u128
        );

        // Setup voting system
        let voting_id = env.register_contract(None, VotingSystem);
        let voting_client = VotingSystemClient::new(&env, &voting_id);

        // Create proposal starting at block 100
        let proposal_id = 1u64;
        create_test_proposal(&env, &voting_id, proposal_id, 100, 200);

        // Move to voting period
        env.ledger().with_mut(|li| li.sequence_number = 150);

        // Cast vote (snapshot at block 100)
        let vote_record = voting_client.cast_vote(
            &token_id,
            &proposal_id,
            &100u64,
            &voter,
            &VoteSupport::For
        );

        assert!(vote_record.has_voted);
        assert_eq!(vote_record.support, VoteSupport::For);
        assert_eq!(vote_record.votes, 1_000_000u128);

        // Verify vote was recorded
        assert!(voting_client.has_voted(&proposal_id, &voter));
    }

    #[test]
    #[should_panic]
    fn test_double_vote_prevented() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 100);

        let token_id = env.register_contract(None, GovernanceToken);
        let token_client = GovernanceTokenClient::new(&env, &token_id);

        let voter = Address::generate(&env);
        env.mock_all_auths();
        token_client.initialize(
            &voter,
            &String::from_str(&env, "Gov"),
            &String::from_str(&env, "GOV"),
            &18,
            &1_000_000u128
        );

        let voting_id = env.register_contract(None, VotingSystem);
        let voting_client = VotingSystemClient::new(&env, &voting_id);

        let proposal_id = 1u64;
        create_test_proposal(&env, &voting_id, proposal_id, 100, 200);

        env.ledger().with_mut(|li| li.sequence_number = 150);

        voting_client.cast_vote(&token_id, &proposal_id, &100u64, &voter, &VoteSupport::For);
        
        // Attempt to vote again - should panic
        voting_client.cast_vote(&token_id, &proposal_id, &100u64, &voter, &VoteSupport::Against);
    }

    #[test]
    fn test_quorum_calculation() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 100);

        let token_id = env.register_contract(None, GovernanceToken);
        let token_client = GovernanceTokenClient::new(&env, &token_id);

        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);
        
        env.mock_all_auths();
        token_client.initialize(
            &voter1,
            &String::from_str(&env, "Gov"),
            &String::from_str(&env, "GOV"),
            &18,
            &1_000_000u128
        );
        token_client.transfer(&voter1, &voter2, &400_000u128);

        let voting_id = env.register_contract(None, VotingSystem);
        let voting_client = VotingSystemClient::new(&env, &voting_id);

        let proposal_id = 1u64;
        create_test_proposal(&env, &voting_id, proposal_id, 100, 200);

        env.ledger().with_mut(|li| li.sequence_number = 150);

        // Quorum is 50% = 500,000 tokens
        let quorum_numerator = 50u64;

        // Before any votes, quorum not reached
        assert!(!voting_client.quorum_reached(&token_id, &0u128, &0u128, &0u128, &quorum_numerator));

        // voter1 votes with 600,000 tokens -> quorum reached
        let vote_record = voting_client.cast_vote(&token_id, &proposal_id, &100u64, &voter1, &VoteSupport::For);
        assert!(voting_client.quorum_reached(&token_id, &vote_record.votes, &0u128, &0u128, &quorum_numerator));
    }

    #[test]
    fn test_proposal_succeeded() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 100);

        let token_id = env.register_contract(None, GovernanceToken);
        let token_client = GovernanceTokenClient::new(&env, &token_id);

        let voter_for = Address::generate(&env);
        let voter_against = Address::generate(&env);
        
        env.mock_all_auths();
        token_client.initialize(
            &voter_for,
            &String::from_str(&env, "Gov"),
            &String::from_str(&env, "GOV"),
            &18,
            &1_000_000u128
        );
        token_client.transfer(&voter_for, &voter_against, &300_000u128);

        let voting_id = env.register_contract(None, VotingSystem);
        let voting_client = VotingSystemClient::new(&env, &voting_id);

        let proposal_id = 1u64;
        create_test_proposal(&env, &voting_id, proposal_id, 100, 200);

        env.ledger().with_mut(|li| li.sequence_number = 150);

        let quorum_numerator = 50u64; // 50% quorum

        // Both vote - quorum reached, For wins
        let vote_for = voting_client.cast_vote(&token_id, &proposal_id, &100u64, &voter_for, &VoteSupport::For);
        let vote_against = voting_client.cast_vote(&token_id, &proposal_id, &100u64, &voter_against, &VoteSupport::Against);

        assert!(voting_client.proposal_succeeded(&token_id, &vote_for.votes, &vote_against.votes, &0u128, &quorum_numerator));
    }
}

