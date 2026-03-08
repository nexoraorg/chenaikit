use soroban_sdk::contracterror;

/// Common error types for Soroban contracts
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CommonError {
    /// Unauthorized access attempt
    Unauthorized = 1,
    /// Contract is paused
    Paused = 2,
    /// Invalid input parameter
    InvalidInput = 3,
    /// Arithmetic overflow
    Overflow = 4,
    /// Arithmetic underflow
    Underflow = 5,
    /// Division by zero
    DivisionByZero = 6,
    /// Resource not found
    NotFound = 7,
    /// Resource already exists
    AlreadyExists = 8,
    /// Invalid address
    InvalidAddress = 9,
    /// Invalid timestamp
    InvalidTimestamp = 10,
    /// Operation not allowed
    NotAllowed = 11,
}
