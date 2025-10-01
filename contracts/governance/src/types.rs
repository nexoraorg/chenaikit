#![allow(unused)]
use soroban_sdk::{contracttype, Address, Bytes, Env, String, Vec};

/// Proposal states
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProposalState {
    Pending = 0,
    Active = 1,
    Canceled = 2,
    Defeated = 3,
    Succeeded = 4,
    Queued = 5,
    Expired = 6,
    Executed = 7,
}

/// Vote support types (Compound-style)
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VoteSupport {
    Against = 0,
    For = 1,
    Abstain = 2,
}

/// Checkpoint for tracking historical voting power
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Checkpoint {
    pub from_block: u64,
    pub votes: u128,
}

/// Proposal structure
#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub targets: Vec<Address>,
    pub values: Vec<u128>,
    pub calldatas: Vec<Bytes>,
    pub description: String,
    pub start_block: u64,
    pub end_block: u64,
    pub for_votes: u128,
    pub against_votes: u128,
    pub abstain_votes: u128,
    pub canceled: bool,
    pub executed: bool,
    pub eta: u64, // execution time after timelock
}

/// Vote record for a proposal
#[contracttype]
#[derive(Clone, Debug)]
pub struct VoteRecord {
    pub has_voted: bool,
    pub support: VoteSupport,
    pub votes: u128,
}

/// Governance configuration parameters
#[contracttype]
#[derive(Clone, Debug)]
pub struct GovernanceConfig {
    pub voting_delay: u64,      // blocks to wait before voting starts
    pub voting_period: u64,     // blocks for voting duration
    pub proposal_threshold: u128, // minimum tokens to create proposal
    pub quorum_numerator: u64,  // numerator for quorum calculation (denominator is 100)
    pub timelock_delay: u64,    // seconds to wait before execution
}

/// Error types for governance contracts
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum GovernanceError {
    Unauthorized = 1,
    InsufficientBalance = 2,
    InvalidProposal = 3,
    ProposalNotActive = 4,
    AlreadyVoted = 5,
    BelowProposalThreshold = 6,
    ProposalNotSucceeded = 7,
    TimelockNotExpired = 8,
    ProposalAlreadyExecuted = 9,
    ExecutionFailed = 10,
    InvalidState = 11,
    QuorumNotReached = 12,
    InvalidCheckpoint = 13,
    ArrayLengthMismatch = 14,
}

impl From<GovernanceError> for soroban_sdk::Error {
    fn from(error: GovernanceError) -> Self {
        soroban_sdk::Error::from_contract_error(error as u32)
    }
}

/// Storage keys
pub enum StorageKey {
    // Governance Token
    TokenName,
    TokenSymbol,
    TokenDecimals,
    TotalSupply,
    Balance(Address),
    Allowance(Address, Address),
    Delegates(Address),
    Checkpoints(Address),
    NumCheckpoints(Address),
    
    // Governance Config
    Config,
    Admin,
    
    // Proposals
    ProposalCount,
    Proposal(u64),
    VoteReceipt(u64, Address),
    
    // Timelock
    QueuedTransactions(Bytes),
}

