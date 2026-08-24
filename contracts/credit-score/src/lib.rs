#![no_std]
//! credit-score — Soroban contract for credit scoring.
//!
//! First adopter of the shared `ErrorCategory` from `common-utils`.

use common_utils::ErrorCategory;
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn ping(_env: Env) -> bool {
        true
    }

    /// Validates that a credit score is within the accepted 0–100 range.
    ///
    /// Returns `Ok(())` for valid scores and `Err(ErrorCategory::Validation)`
    /// for scores outside the range.
    pub fn validate_score(_env: &Env, score: u32) -> Result<(), ErrorCategory> {
        if score > 100 {
            Err(ErrorCategory::Validation)
        } else {
            Ok(())
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_ping() {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(&env, &contract_id);
        assert!(client.ping());
    }

    #[test]
    fn test_validate_score_success() {
        let env = Env::default();
        assert_eq!(Contract::validate_score(&env, 50), Ok(()));
    }

    #[test]
    fn test_validate_score_validation_error() {
        let env = Env::default();
        assert_eq!(
            Contract::validate_score(&env, 101),
            Err(ErrorCategory::Validation)
        );
    }

    #[test]
    fn test_validate_score_zero_boundary() {
        let env = Env::default();
        assert_eq!(Contract::validate_score(&env, 0), Ok(()));
    }

    #[test]
    fn test_validate_score_max_boundary() {
        let env = Env::default();
        assert_eq!(Contract::validate_score(&env, 100), Ok(()));
    }
}
