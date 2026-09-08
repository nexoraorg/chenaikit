#![no_std]
//! common-utils — shared library for Chenai contract error categories, role registry, and storage helpers.
//!
//! This crate is intentionally a pure `rlib` (no `cdylib`, no `#[contract]`).
//! Contracts import `ErrorCategory`, role primitives, and storage helpers directly.

pub mod ring_buffer;
pub mod roles;

pub use ring_buffer::{BoundedBuffer, RingBuffer};
pub use roles::{RiskLevel, Role, RoleKey, RoleRegistry};
use soroban_sdk::contracterror;

/// Shared, externally-observable error categories for all contracts.
///
/// Codes 1–5 are frozen. New categories may append at 6+.
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
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{contract, contractimpl, Address, Env, Error, Vec};

    #[contract]
    struct DummyContract;

    #[contractimpl]
    impl DummyContract {
        pub fn set_admin(env: Env, admin: Address) {
            RoleRegistry::set_admin(&env, &admin);
        }
        pub fn get_admin(env: Env) -> Option<Address> {
            RoleRegistry::get_admin(&env)
        }
        pub fn is_admin(env: Env, caller: Address) -> bool {
            RoleRegistry::is_admin(&env, &caller)
        }
        pub fn require_admin(env: Env, caller: Address) -> Result<(), ErrorCategory> {
            RoleRegistry::require_admin(&env, &caller)
        }
        pub fn set_writer(env: Env, writer: Address, authorized: bool) {
            RoleRegistry::set_writer(&env, &writer, authorized);
        }
        pub fn is_writer(env: Env, caller: Address) -> bool {
            RoleRegistry::is_writer(&env, &caller)
        }
        pub fn require_writer(env: Env, caller: Address) -> Result<(), ErrorCategory> {
            RoleRegistry::require_writer(&env, &caller)
        }
        pub fn set_role(env: Env, account: Address, role: Role, authorized: bool) {
            RoleRegistry::set_role(&env, &account, role, authorized);
        }
        pub fn has_role(env: Env, account: Address, role: Role) -> bool {
            RoleRegistry::has_role(&env, &account, role)
        }
        pub fn require_role(env: Env, caller: Address, role: Role) -> Result<(), ErrorCategory> {
            RoleRegistry::require_role(&env, &caller, role)
        }
    }

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
    fn test_role_registry_admin_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(DummyContract, ());
        let client = DummyContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        assert_eq!(client.get_admin(), None);
        assert!(!client.is_admin(&admin));
        assert_eq!(
            client.try_require_admin(&admin),
            Err(Ok(ErrorCategory::Authorization))
        );

        client.set_admin(&admin);
        assert_eq!(client.get_admin(), Some(admin.clone()));
        assert!(client.is_admin(&admin));
        assert!(!client.is_admin(&user));
        client.require_admin(&admin);
        assert_eq!(
            client.try_require_admin(&user),
            Err(Ok(ErrorCategory::Authorization))
        );
    }

    #[test]
    fn test_role_registry_writer_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(DummyContract, ());
        let client = DummyContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let writer = Address::generate(&env);
        let stranger = Address::generate(&env);

        client.set_admin(&admin);
        assert!(!client.is_writer(&writer));
        assert_eq!(
            client.try_require_writer(&writer),
            Err(Ok(ErrorCategory::Authorization))
        );

        client.set_writer(&writer, &true);
        assert!(client.is_writer(&writer));
        client.require_writer(&writer);
        client.require_writer(&admin);
        assert_eq!(
            client.try_require_writer(&stranger),
            Err(Ok(ErrorCategory::Authorization))
        );

        client.set_writer(&writer, &false);
        assert!(!client.is_writer(&writer));
        assert_eq!(
            client.try_require_writer(&writer),
            Err(Ok(ErrorCategory::Authorization))
        );
    }

    #[test]
    fn test_role_registry_named_roles() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(DummyContract, ());
        let client = DummyContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.set_admin(&admin);
        assert!(!client.has_role(&user, &Role::Scorer));
        assert!(!client.has_role(&user, &Role::Reviewer));
        assert_eq!(
            client.try_require_role(&user, &Role::Scorer),
            Err(Ok(ErrorCategory::Authorization))
        );

        client.set_role(&user, &Role::Scorer, &true);
        assert!(client.has_role(&user, &Role::Scorer));
        assert!(!client.has_role(&user, &Role::Reviewer));
        client.require_role(&user, &Role::Scorer);
        client.require_role(&admin, &Role::Scorer);

        client.set_role(&user, &Role::Reviewer, &true);
        assert!(client.has_role(&user, &Role::Reviewer));

        client.set_role(&user, &Role::Scorer, &false);
        assert!(!client.has_role(&user, &Role::Scorer));
        assert!(client.has_role(&user, &Role::Reviewer));
    }

    #[test]
    fn test_ring_buffer_push_and_overflow() {
        let env = Env::default();
        let mut buffer: Vec<u32> = Vec::new(&env);
        let capacity = 3u32;

        RingBuffer::push(&env, &mut buffer, 10, capacity);
        RingBuffer::push(&env, &mut buffer, 20, capacity);
        assert_eq!(buffer.len(), 2);
        assert_eq!(buffer.get(0), Some(10));
        assert_eq!(buffer.get(1), Some(20));

        RingBuffer::push(&env, &mut buffer, 30, capacity);
        assert_eq!(buffer.len(), 3);
        assert_eq!(buffer.get(0), Some(10));
        assert_eq!(buffer.get(1), Some(20));
        assert_eq!(buffer.get(2), Some(30));

        RingBuffer::push(&env, &mut buffer, 40, capacity);
        assert_eq!(buffer.len(), 3);
        assert_eq!(buffer.get(0), Some(20));
        assert_eq!(buffer.get(1), Some(30));
        assert_eq!(buffer.get(2), Some(40));

        RingBuffer::push(&env, &mut buffer, 50, capacity);
        assert_eq!(buffer.len(), 3);
        assert_eq!(buffer.get(0), Some(30));
        assert_eq!(buffer.get(1), Some(40));
        assert_eq!(buffer.get(2), Some(50));
    }

    #[test]
    fn test_ring_buffer_latest() {
        let env = Env::default();
        let mut buffer: Vec<u32> = Vec::new(&env);
        for i in 1..=5 {
            buffer.push_back(i * 10);
        }

        let latest_2 = RingBuffer::latest(&env, &buffer, 2);
        assert_eq!(latest_2.len(), 2);
        assert_eq!(latest_2.get(0), Some(40));
        assert_eq!(latest_2.get(1), Some(50));

        let latest_all = RingBuffer::latest(&env, &buffer, 10);
        assert_eq!(latest_all.len(), 5);
        assert_eq!(latest_all.get(0), Some(10));
        assert_eq!(latest_all.get(4), Some(50));
    }

    #[test]
    fn test_bounded_buffer_struct() {
        let env = Env::default();
        let mut bounded = BoundedBuffer::new(&env, 2);
        assert!(bounded.is_empty());
        assert_eq!(bounded.len(), 0);
        assert_eq!(bounded.capacity(), 2);

        bounded.push(&env, 100u64);
        assert_eq!(bounded.len(), 1);
        assert_eq!(bounded.get(0), Some(100));

        bounded.push(&env, 200u64);
        assert_eq!(bounded.len(), 2);
        assert_eq!(bounded.get(0), Some(100));
        assert_eq!(bounded.get(1), Some(200));

        bounded.push(&env, 300u64);
        assert_eq!(bounded.len(), 2);
        assert_eq!(bounded.get(0), Some(200));
        assert_eq!(bounded.get(1), Some(300));

        let recent = bounded.latest(&env, 1);
        assert_eq!(recent.len(), 1);
        assert_eq!(recent.get(0), Some(300));
    }
}
