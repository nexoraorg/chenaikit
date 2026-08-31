//! Fraud detection contract errors and rejection status codes.

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// Contract is already initialized.
    AlreadyInitialized = 1,
    /// Contract has not been initialized.
    NotInitialized = 2,
    /// Caller is not authorized as contract administrator.
    NotAuthorized = 3,
    /// Provided amount is invalid (zero, negative, or exceeds maximum allowable bound).
    InvalidAmount = 4,
    /// Velocity threshold or anomaly threshold is invalid or out of bounds.
    InvalidThreshold = 5,
    /// Velocity window is invalid (below minimum window or exceeding max window).
    InvalidWindow = 6,
    /// Score value is out of bounds (must be 0..=100).
    InvalidScore = 7,
    /// String argument is empty when non-empty string is required.
    EmptyString = 8,
    /// String argument exceeds maximum allowable byte length.
    StringTooLong = 9,
    /// Input structure is malformed or violates invariant constraints.
    MalformedInput = 10,
    /// Timestamp is zero or drifts too far into the future beyond acceptable skew.
    InvalidTimestamp = 11,
    /// Contract state is inconsistent or uninitialized for requested operation.
    InvalidState = 12,
    /// Arithmetic operation encountered an overflow.
    ArithmeticOverflow = 13,
    /// Arithmetic operation encountered an underflow.
    ArithmeticUnderflow = 14,
    /// Arithmetic operation encountered division by zero.
    DivisionByZero = 15,
    /// Provided WASM hash for upgrade is invalid or blank.
    InvalidModelHash = 16,
    /// Rollback requested but no previous WASM hash was recorded.
    RollbackNotAvailable = 17,
    /// Version number is invalid or downgrade attempted.
    InvalidVersion = 18,
    /// From and to addresses are identical where distinct parties are required.
    SameAddress = 19,
    /// Storage maximum capacity exceeded for bounded collection.
    MaxCapacityExceeded = 20,
    /// Target entry already exists (e.g. duplicate blacklist entry).
    AlreadyExists = 21,
    /// Target entry was not found in storage.
    NotFound = 22,
}
