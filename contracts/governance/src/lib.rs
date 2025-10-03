#![no_std]

pub mod types;

// Build one contract at a time using features
#[cfg(any(test, feature = "token"))]
pub mod governance_token;
#[cfg(any(test, feature = "token"))]
pub use governance_token::GovernanceToken;

#[cfg(any(test, feature = "voting"))]
pub mod voting_system;
#[cfg(any(test, feature = "voting"))]
pub use voting_system::VotingSystem;

#[cfg(any(test, feature = "proposals"))]
pub mod proposal_manager;
#[cfg(any(test, feature = "proposals"))]
pub use proposal_manager::ProposalManager;

#[cfg(any(test, feature = "timelock"))]
pub mod timelock;
#[cfg(any(test, feature = "timelock"))]
pub use timelock::Timelock;

#[cfg(test)]
mod integration_tests;

