#![no_std]

//! Common Utilities Library for Soroban Smart Contracts
//!
//! This library provides reusable utilities for building robust Soroban contracts:
//! - Math: Safe arithmetic operations and financial calculations
//! - Time: Date/time helper functions
//! - Access: Access control patterns (Ownable, Pausable)
//! - Storage: Storage key management helpers
//! - Events: Event emission utilities
//! - Errors: Common error types and handling

pub mod access;
pub mod errors;
pub mod events;
pub mod math;
pub mod storage;
pub mod time;

// Re-export commonly used items
pub use access::{AccessControl, Ownable, Pausable};
pub use errors::CommonError;
pub use events::EventHelpers;
pub use math::{FixedPoint, Percentage, SafeMath};
pub use storage::{StorageHelpers, StorageType};
pub use time::{TimeHelpers, SECONDS_PER_DAY, SECONDS_PER_HOUR};

#[cfg(test)]
mod test;

#[cfg(test)]
mod lib_contract;
