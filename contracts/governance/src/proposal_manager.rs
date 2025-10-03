#![allow(unused)]
use crate::governance_token::GovernanceTokenClient;
use crate::timelock::TimelockClient;
use crate::types::{GovernanceConfig, GovernanceError, Proposal, ProposalState};
use crate::voting_system::VotingSystemClient;
use soroban_sdk::{contract, contractimpl, panic_with_error, symbol_short, Address, Bytes, Env, String, Vec};

/// Proposal Manager Contract - manages the full proposal lifecycle
/// @notice Follows Compound governance patterns with timelock integration
#[contract]
pub struct ProposalManager;

#[contractimpl]
impl ProposalManager {
    /// Initialize the governance system
    /// @param token_contract: Address of the governance token
    /// @param timelock_contract: Address of the timelock contract
    /// @param voting_contract: Address of the voting system contract
    /// @param config: Governance configuration parameters
    pub fn initialize(
        env: Env,
        admin: Address,
        token_contract: Address,
        timelock_contract: Address,
        voting_contract: Address,
        config: GovernanceConfig,
    ) {
        admin.require_auth();

        env.storage().instance().set(&symbol_short!("ADMIN"), &admin);
        env.storage().instance().set(&symbol_short!("TOKEN"), &token_contract);
        env.storage().instance().set(&symbol_short!("TIMELOCK"), &timelock_contract);
        env.storage().instance().set(&symbol_short!("VOTING"), &voting_contract);
        env.storage().instance().set(&symbol_short!("CONFIG"), &config);
        env.storage().instance().set(&symbol_short!("PROPCT"), &0u64);
    }

    /// Create a new proposal
    /// @notice Only accounts with sufficient tokens can create proposals
    /// @param proposer: Address creating the proposal
    /// @param targets: Addresses of contracts to call
    /// @param values: Amounts to send with each call (usually 0)
    /// @param calldatas: Calldata for each target
    /// @param description: Human-readable description
    /// @return proposal_id: Unique ID for the created proposal
    pub fn propose(
        env: Env,
        proposer: Address,
        targets: Vec<Address>,
        values: Vec<u128>,
        calldatas: Vec<Bytes>,
        description: String,
    ) -> u64 {
        proposer.require_auth();

        // Validate arrays have same length
        if targets.len() != values.len() || targets.len() != calldatas.len() {
            panic_with_error!(&env, GovernanceError::ArrayLengthMismatch);
        }

        // Validate not empty
        if targets.len() == 0 {
            panic_with_error!(&env, GovernanceError::InvalidProposal);
        }

        let config = Self::_config(&env);
        let token = Self::_token(&env);
        let token_client = GovernanceTokenClient::new(&env, &token);

        // Check proposal threshold
        let current_block = env.ledger().sequence() as u64;
        let proposer_votes = token_client.get_prior_votes(&proposer, &(current_block - 1));
        
        if proposer_votes < config.proposal_threshold {
            panic_with_error!(&env, GovernanceError::BelowProposalThreshold);
        }

        // Create proposal
        let proposal_id = Self::_next_proposal_id(&env);
        let start_block = current_block + config.voting_delay as u64;
        let end_block = start_block + config.voting_period as u64;

        let proposal = Proposal {
            id: proposal_id,
            proposer: proposer.clone(),
            targets,
            values,
            calldatas,
            description: description.clone(),
            start_block,
            end_block,
            for_votes: 0,
            against_votes: 0,
            abstain_votes: 0,
            canceled: false,
            executed: false,
            eta: 0,
        };

        env.storage().persistent().set(&(symbol_short!("PROP"), proposal_id), &proposal);

        // Emit ProposalCreated event
        env.events().publish(
            (symbol_short!("PropCrtd"), proposal_id),
            (proposer, start_block, end_block, description)
        );

        proposal_id
    }

    /// Get proposal state
    /// @notice Follows Compound's state machine: Pending -> Active -> Succeeded/Defeated -> Queued -> Executed
    pub fn state(env: Env, proposal_id: u64) -> ProposalState {
        let proposal = Self::_get_proposal(&env, proposal_id);
        
        if proposal.canceled {
            return ProposalState::Canceled;
        }

        if proposal.executed {
            return ProposalState::Executed;
        }

        let current_block = env.ledger().sequence() as u64;

        if current_block < proposal.start_block {
            return ProposalState::Pending;
        }

        if current_block <= proposal.end_block {
            return ProposalState::Active;
        }

        // Voting period ended - check if succeeded
        let config = Self::_config(&env);
        let token = Self::_token(&env);
        let voting = Self::_voting(&env);
        
        let voting_client = VotingSystemClient::new(&env, &voting);
        let succeeded = voting_client.proposal_succeeded(
            &token,
            &proposal.for_votes,
            &proposal.against_votes,
            &proposal.abstain_votes,
            &config.quorum_numerator
        );

        if !succeeded {
            return ProposalState::Defeated;
        }

        if proposal.eta == 0 {
            return ProposalState::Succeeded;
        }

        // Check if expired (grace period)
        let grace_period = 14 * 24 * 60 * 60u64; // 14 days
        if env.ledger().timestamp() > proposal.eta + grace_period {
            return ProposalState::Expired;
        }

        ProposalState::Queued
    }

    /// Queue a successful proposal for execution (after timelock)
    /// @notice Only succeeded proposals can be queued
    pub fn queue(env: Env, proposal_id: u64) -> u64 {
        let state = Self::state(env.clone(), proposal_id);
        if state != ProposalState::Succeeded {
            panic_with_error!(&env, GovernanceError::ProposalNotSucceeded);
        }

        let config = Self::_config(&env);
        let timelock = Self::_timelock(&env);
        let timelock_client = TimelockClient::new(&env, &timelock);

        let eta = env.ledger().timestamp() + config.timelock_delay;
        
        // Queue all transactions in the proposal
        let mut proposal = Self::_get_proposal(&env, proposal_id);
        
        for i in 0..proposal.targets.len() {
            let target = proposal.targets.get(i).unwrap();
            let value = proposal.values.get(i).unwrap();
            let data = proposal.calldatas.get(i).unwrap();
            
            timelock_client.queue_transaction(&target, &value, &data, &eta);
        }

        proposal.eta = eta;
        env.storage().persistent().set(&(symbol_short!("PROP"), proposal_id), &proposal);

        // Emit ProposalQueued event
        env.events().publish((symbol_short!("PropQd"), proposal_id), eta);

        eta
    }

    /// Execute a queued proposal
    /// @notice Only queued proposals past their ETA can be executed
    pub fn execute(env: Env, proposal_id: u64) {
        let state = Self::state(env.clone(), proposal_id);
        if state != ProposalState::Queued {
            panic_with_error!(&env, GovernanceError::InvalidState);
        }

        let mut proposal = Self::_get_proposal(&env, proposal_id);
        
        // Check timelock has passed
        if env.ledger().timestamp() < proposal.eta {
            panic_with_error!(&env, GovernanceError::TimelockNotExpired);
        }

        let timelock = Self::_timelock(&env);
        let timelock_client = TimelockClient::new(&env, &timelock);

        // Execute all transactions
        for i in 0..proposal.targets.len() {
            let target = proposal.targets.get(i).unwrap();
            let value = proposal.values.get(i).unwrap();
            let data = proposal.calldatas.get(i).unwrap();
            
            // Execute through timelock
            timelock_client.execute_transaction(&target, &value, &data, &proposal.eta);
        }

        proposal.executed = true;
        env.storage().persistent().set(&(symbol_short!("PROP"), proposal_id), &proposal);

        // Emit ProposalExecuted event
        env.events().publish((symbol_short!("PropExec"), proposal_id), env.ledger().timestamp());
    }

    /// Cancel a proposal
    /// @notice Only proposer or admin can cancel, and only before execution
    pub fn cancel(env: Env, proposal_id: u64, canceller: Address) {
        canceller.require_auth();

        let mut proposal = Self::_get_proposal(&env, proposal_id);
        let admin = Self::_admin(&env);

        // Only proposer or admin can cancel
        if canceller != proposal.proposer && canceller != admin {
            panic_with_error!(&env, GovernanceError::Unauthorized);
        }

        // Cannot cancel if already executed
        if proposal.executed {
            panic_with_error!(&env, GovernanceError::ProposalAlreadyExecuted);
        }

        proposal.canceled = true;
        env.storage().persistent().set(&(symbol_short!("PROP"), proposal_id), &proposal);

        // If queued, cancel in timelock too
        if proposal.eta > 0 {
            let timelock = Self::_timelock(&env);
            let timelock_client = TimelockClient::new(&env, &timelock);
            
            for i in 0..proposal.targets.len() {
                let target = proposal.targets.get(i).unwrap();
                let value = proposal.values.get(i).unwrap();
                let data = proposal.calldatas.get(i).unwrap();
                
                timelock_client.cancel_transaction(&target, &value, &data, &proposal.eta);
            }
        }

        // Emit ProposalCanceled event
        env.events().publish((symbol_short!("PropCncl"), proposal_id), canceller);
    }

    /// Get proposal details
    pub fn get_proposal(env: Env, proposal_id: u64) -> Proposal {
        Self::_get_proposal(&env, proposal_id)
    }

    /// Get total number of proposals
    pub fn proposal_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&symbol_short!("PROPCT"))
            .unwrap_or(0u64)
    }

    /// Get governance configuration
    pub fn get_config(env: Env) -> GovernanceConfig {
        Self::_config(&env)
    }

    /// Record a vote for a proposal (called by voting system or externally)
    /// @param proposal_id: The proposal ID
    /// @param support: Vote type
    /// @param votes: Number of votes
    pub fn record_vote(env: Env, proposal_id: u64, support: crate::types::VoteSupport, votes: u128) {
        let mut proposal = Self::_get_proposal(&env, proposal_id);

        match support {
            crate::types::VoteSupport::For => {
                proposal.for_votes = proposal.for_votes.checked_add(votes)
                    .expect("Overflow in for_votes");
            }
            crate::types::VoteSupport::Against => {
                proposal.against_votes = proposal.against_votes.checked_add(votes)
                    .expect("Overflow in against_votes");
            }
            crate::types::VoteSupport::Abstain => {
                proposal.abstain_votes = proposal.abstain_votes.checked_add(votes)
                    .expect("Overflow in abstain_votes");
            }
        }

        env.storage().persistent().set(&(symbol_short!("PROP"), proposal_id), &proposal);
    }

    /// Update governance configuration
    /// @notice Only admin can update 
    pub fn update_config(env: Env, admin: Address, new_config: GovernanceConfig) {
        admin.require_auth();
        
        let stored_admin = Self::_admin(&env);
        if admin != stored_admin {
            panic_with_error!(&env, GovernanceError::Unauthorized);
        }

        env.storage().instance().set(&symbol_short!("CONFIG"), &new_config);
        
        env.events().publish((symbol_short!("CfgUpdt"),), new_config);
    }

    // ========== INTERNAL HELPER FUNCTIONS ==========

    fn _admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("ADMIN"))
            .unwrap()
    }

    fn _token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("TOKEN"))
            .unwrap()
    }

    fn _timelock(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("TIMELOCK"))
            .unwrap()
    }

    fn _voting(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("VOTING"))
            .unwrap()
    }

    fn _config(env: &Env) -> GovernanceConfig {
        env.storage()
            .instance()
            .get(&symbol_short!("CONFIG"))
            .unwrap()
    }

    fn _get_proposal(env: &Env, proposal_id: u64) -> Proposal {
        env.storage()
            .persistent()
            .get(&(symbol_short!("PROP"), proposal_id))
            .unwrap_or_else(|| panic_with_error!(env, GovernanceError::InvalidProposal))
    }

    fn _next_proposal_id(env: &Env) -> u64 {
        let count: u64 = env.storage()
            .instance()
            .get(&symbol_short!("PROPCT"))
            .unwrap_or(0);
        let next_id = count + 1;
        env.storage().instance().set(&symbol_short!("PROPCT"), &next_id);
        next_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::governance_token::{GovernanceToken, GovernanceTokenClient};
    use crate::timelock::{Timelock, TimelockClient};
    use crate::voting_system::{VotingSystem, VotingSystemClient};
    use crate::types::VoteSupport;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_full_proposal_lifecycle() {
        let env = Env::default();
        env.ledger().with_mut(|li| {
            li.sequence_number = 1000;
            li.timestamp = 1000000;
        });

        // Deploy all contracts
        let token_id = env.register_contract(None, GovernanceToken);
        let token_client = GovernanceTokenClient::new(&env, &token_id);

        let timelock_id = env.register_contract(None, Timelock);
        let timelock_client = TimelockClient::new(&env, &timelock_id);

        let voting_id = env.register_contract(None, VotingSystem);
        let voting_client = VotingSystemClient::new(&env, &voting_id);

        let proposal_id = env.register_contract(None, ProposalManager);
        let proposal_client = ProposalManagerClient::new(&env, &proposal_id);

        // Setup
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);

        env.mock_all_auths();

        // Initialize token with supply
        token_client.initialize(
            &admin,
            &String::from_str(&env, "Governance Token"),
            &String::from_str(&env, "GOV"),
            &18,
            &1_000_000u128
        );

        // Distribute tokens
        token_client.transfer(&admin, &proposer, &200_000u128);
        token_client.transfer(&admin, &voter1, &300_000u128);
        token_client.transfer(&admin, &voter2, &300_000u128);

        // Advance block so checkpoints are in the past
        env.ledger().with_mut(|li| li.sequence_number = 1005);

        // Initialize timelock (2 day delay)
        timelock_client.initialize(&proposal_id, &172800u64);

        // Initialize proposal manager
        let config = GovernanceConfig {
            voting_delay: 10,      // 10 blocks delay
            voting_period: 100,    // 100 blocks voting
            proposal_threshold: 100_000, // Need 100k tokens to propose
            quorum_numerator: 40,  // 40% quorum
            timelock_delay: 172800, // 2 days
        };
        proposal_client.initialize(&admin, &token_id, &timelock_id, &voting_id, &config);

        // Create proposal
        let targets = Vec::from_array(&env, [Address::generate(&env)]);
        let values = Vec::from_array(&env, [0u128]);
        let calldatas = Vec::from_array(&env, [Bytes::new(&env)]);
        let description = String::from_str(&env, "Test Proposal");

        let prop_id = proposal_client.propose(&proposer, &targets, &values, &calldatas, &description);
        assert_eq!(prop_id, 1);

        // Check state is Pending
        assert_eq!(proposal_client.state(&prop_id), ProposalState::Pending);

        // Move to active voting period (created at 1005, voting_delay is 10, active at 1015)
        env.ledger().with_mut(|li| li.sequence_number = 1016);
        assert_eq!(proposal_client.state(&prop_id), ProposalState::Active);

        // Get proposal to know snapshot block
        let proposal = proposal_client.get_proposal(&prop_id);
        let snapshot_block = proposal.start_block;

        // Cast votes and record them
        let vote1 = voting_client.cast_vote(&token_id, &prop_id, &snapshot_block, &voter1, &VoteSupport::For);
        proposal_client.record_vote(&prop_id, &VoteSupport::For, &vote1.votes);
        
        let vote2 = voting_client.cast_vote(&token_id, &prop_id, &snapshot_block, &voter2, &VoteSupport::For);
        proposal_client.record_vote(&prop_id, &VoteSupport::For, &vote2.votes);

        // Move past voting period
        env.ledger().with_mut(|li| li.sequence_number = 1120);
        assert_eq!(proposal_client.state(&prop_id), ProposalState::Succeeded);

        // Queue the proposal
        let eta = proposal_client.queue(&prop_id);
        assert_eq!(proposal_client.state(&prop_id), ProposalState::Queued);

        // Move past timelock
        env.ledger().with_mut(|li| li.timestamp = eta + 1);

        // Execute
        proposal_client.execute(&prop_id);
        assert_eq!(proposal_client.state(&prop_id), ProposalState::Executed);
    }

    #[test]
    #[should_panic]
    fn test_insufficient_tokens_to_propose() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 1000);

        let token_id = env.register_contract(None, GovernanceToken);
        let token_client = GovernanceTokenClient::new(&env, &token_id);

        let timelock_id = env.register_contract(None, Timelock);
        let voting_id = env.register_contract(None, VotingSystem);
        let proposal_id = env.register_contract(None, ProposalManager);
        let proposal_client = ProposalManagerClient::new(&env, &proposal_id);

        let admin = Address::generate(&env);
        let poor_proposer = Address::generate(&env);

        env.mock_all_auths();

        token_client.initialize(
            &admin,
            &String::from_str(&env, "Gov"),
            &String::from_str(&env, "GOV"),
            &18,
            &1_000_000u128
        );

        // Give proposer insufficient tokens
        token_client.transfer(&admin, &poor_proposer, &50_000u128);

        let config = GovernanceConfig {
            voting_delay: 10,
            voting_period: 100,
            proposal_threshold: 100_000, // Need 100k
            quorum_numerator: 40,
            timelock_delay: 172800,
        };
        proposal_client.initialize(&admin, &token_id, &timelock_id, &voting_id, &config);

        let targets = Vec::from_array(&env, [Address::generate(&env)]);
        let values = Vec::from_array(&env, [0u128]);
        let calldatas = Vec::from_array(&env, [Bytes::new(&env)]);

        // This should panic
        proposal_client.propose(&poor_proposer, &targets, &values, &calldatas, &String::from_str(&env, "Test"));
    }
}

