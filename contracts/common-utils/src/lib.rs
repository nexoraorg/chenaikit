#![no_std]
//! common-utils — shared library for Chenai contract error categories.
//!
//! This crate is intentionally a pure `rlib` (no `cdylib`, no `#[contract]`).
//! Contracts import `ErrorCategory` and return it directly as their error type.
//! Clients must branch on the stable u32 codes, never on `Debug` strings.

use soroban_sdk::{contracterror, contracttype, Address, Env};

/// Graded risk level matching ModelResult verdict shape and on-chain fraud tiers.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RiskLevel {
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4,
}

/// Storage key for authorized writers.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WriterDataKey {
    Writer(Address),
}

/// Shared writer registry pattern for role-based contract writes.
pub struct WriterRegistry;

impl WriterRegistry {
    /// Returns true if the address is registered as an authorized writer.
    pub fn is_writer(env: &Env, writer: &Address) -> bool {
        env.storage()
            .instance()
            .has(&WriterDataKey::Writer(writer.clone()))
    }

    /// Sets or clears writer authorization in instance storage.
    pub fn set_writer(env: &Env, writer: &Address, authorized: bool) {
        let key = WriterDataKey::Writer(writer.clone());
        if authorized {
            env.storage().instance().set(&key, &true);
        } else {
            env.storage().instance().remove(&key);
        }
    }
}

/// Shared, externally-observable error categories for all contracts.
///
/// Codes 1–5 are frozen. New categories may append at 6+.
///
/// # Client contract
///
/// ```
/// use common_utils::ErrorCategory;
///
/// // Clients decode the u32 code and branch on it.
/// let category = ErrorCategory::Validation;
/// let code = category as u32; // 2
/// // The Debug representation is NOT stable and must not be parsed.
/// let _ = format!("{:?}", category); // diagnostic only
/// ```
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ErrorCategory {
    /// 1 — caller lacks authorization (authn/authz failure).
    Authorization = 1,
    /// 2 — invalid input; range/format check failed.
    Validation = 2,
    /// 3 — external or cross-contract dependency failed.
    Dependency = 3,
    /// 4 — internal invariant violated (a bug).
    Internal = 4,
    /// 5 — required resource or entity not found.
    NotFound = 5,
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::contract;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Error;

    #[contract]
    pub struct DummyContract;

    #[test]
    fn test_serialization_codes() {
        assert_eq!(ErrorCategory::Authorization as u32, 1);
        assert_eq!(ErrorCategory::Validation as u32, 2);
        assert_eq!(ErrorCategory::Dependency as u32, 3);
        assert_eq!(ErrorCategory::Internal as u32, 4);
        assert_eq!(ErrorCategory::NotFound as u32, 5);
    }

    #[test]
    fn test_round_trip_decode() {
        let categories = [
            ErrorCategory::Authorization,
            ErrorCategory::Validation,
            ErrorCategory::Dependency,
            ErrorCategory::Internal,
            ErrorCategory::NotFound,
        ];
        for original in categories {
            let error: Error = original.into();
            let decoded = ErrorCategory::try_from(error).unwrap();
            assert_eq!(decoded, original);
        }
    }

    #[test]
    fn test_category_distinctness() {
        let mut codes = [
            ErrorCategory::Authorization as u32,
            ErrorCategory::Validation as u32,
            ErrorCategory::Dependency as u32,
            ErrorCategory::Internal as u32,
            ErrorCategory::NotFound as u32,
        ];
        codes.sort_unstable();
        let deduped = codes.as_slice();
        // Count unique adjacent runs in the sorted slice.
        let unique_count = deduped
            .iter()
            .fold((0u32, None), |(count, last), &code| {
                if last == Some(code) {
                    (count, last)
                } else {
                    (count + 1, Some(code))
                }
            })
            .0;
        assert_eq!(unique_count, 5);
    }

    #[test]
    fn test_risk_level_variants() {
        assert_eq!(RiskLevel::Low as u32, 1);
        assert_eq!(RiskLevel::Medium as u32, 2);
        assert_eq!(RiskLevel::High as u32, 3);
        assert_eq!(RiskLevel::Critical as u32, 4);
    }

    #[test]
    fn test_writer_registry_operations() {
        let env = Env::default();
        let contract_id = env.register(DummyContract, ());
        let writer = Address::generate(&env);

        env.as_contract(&contract_id, || {
            assert!(!WriterRegistry::is_writer(&env, &writer));

            WriterRegistry::set_writer(&env, &writer, true);
            assert!(WriterRegistry::is_writer(&env, &writer));

            WriterRegistry::set_writer(&env, &writer, false);
            assert!(!WriterRegistry::is_writer(&env, &writer));
        });
    }
}
