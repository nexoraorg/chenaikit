//! Role-based access control and writer registry primitives for Soroban contracts.

use soroban_sdk::{contracttype, Address, Env};

/// Standard role identifiers across Chenaikit smart contracts.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Role {
    Admin = 1,
    Writer = 2,
    Scorer = 3,
    Reviewer = 4,
}

/// Standard risk levels shared across risk and fraud contracts.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RiskLevel {
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4,
}

/// Storage keys for role assignments and administrator tracking.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RoleKey {
    Admin,
    Role(Address, Role),
    Writer(Address),
}

/// Reusable role registry management functions.
pub struct RoleRegistry;

impl RoleRegistry {
    /// Stores the administrator address in instance storage.
    pub fn set_admin(env: &Env, admin: &Address) {
        env.storage().instance().set(&RoleKey::Admin, admin);
    }

    /// Retrieves the administrator address if established.
    pub fn get_admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&RoleKey::Admin)
    }

    /// Checks if a given address matches the current administrator.
    pub fn is_admin(env: &Env, caller: &Address) -> bool {
        if let Some(admin) = Self::get_admin(env) {
            &admin == caller
        } else {
            false
        }
    }

    /// Verifies authentication and ensures caller is administrator.
    pub fn require_admin(env: &Env, caller: &Address) -> Result<(), crate::ErrorCategory> {
        caller.require_auth();
        if Self::is_admin(env, caller) {
            Ok(())
        } else {
            Err(crate::ErrorCategory::Authorization)
        }
    }

    /// Grants or revokes a generic role for an account.
    pub fn set_role(env: &Env, account: &Address, role: Role, authorized: bool) {
        let key = RoleKey::Role(account.clone(), role);
        if authorized {
            env.storage().instance().set(&key, &true);
        } else {
            env.storage().instance().remove(&key);
        }
    }

    /// Checks whether an account holds the specified role.
    pub fn has_role(env: &Env, account: &Address, role: Role) -> bool {
        let key = RoleKey::Role(account.clone(), role);
        env.storage().instance().get(&key).unwrap_or(false)
    }

    /// Sets writer authorization status for an address.
    pub fn set_writer(env: &Env, writer: &Address, authorized: bool) {
        let key = RoleKey::Writer(writer.clone());
        if authorized {
            env.storage().instance().set(&key, &true);
        } else {
            env.storage().instance().remove(&key);
        }
    }

    /// Checks whether an address is an authorized writer.
    pub fn is_writer(env: &Env, caller: &Address) -> bool {
        let key = RoleKey::Writer(caller.clone());
        env.storage().instance().get(&key).unwrap_or(false)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{contract, contractimpl};

    #[contract]
    struct DummyContract;

    #[contractimpl]
    impl DummyContract {}

    #[test]
    fn test_role_registry_admin_flow() {
        let env = Env::default();
        let contract_id = env.register(DummyContract, ());
        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        env.as_contract(&contract_id, || {
            assert_eq!(RoleRegistry::get_admin(&env), None);
            assert!(!RoleRegistry::is_admin(&env, &admin));

            RoleRegistry::set_admin(&env, &admin);
            assert_eq!(RoleRegistry::get_admin(&env), Some(admin.clone()));
            assert!(RoleRegistry::is_admin(&env, &admin));
            assert!(!RoleRegistry::is_admin(&env, &user));
        });
    }

    #[test]
    fn test_role_registry_writer_flow() {
        let env = Env::default();
        let contract_id = env.register(DummyContract, ());
        let writer = Address::generate(&env);

        env.as_contract(&contract_id, || {
            assert!(!RoleRegistry::is_writer(&env, &writer));

            RoleRegistry::set_writer(&env, &writer, true);
            assert!(RoleRegistry::is_writer(&env, &writer));

            RoleRegistry::set_writer(&env, &writer, false);
            assert!(!RoleRegistry::is_writer(&env, &writer));
        });
    }

    #[test]
    fn test_role_registry_generic_roles() {
        let env = Env::default();
        let contract_id = env.register(DummyContract, ());
        let user = Address::generate(&env);

        env.as_contract(&contract_id, || {
            assert!(!RoleRegistry::has_role(&env, &user, Role::Scorer));

            RoleRegistry::set_role(&env, &user, Role::Scorer, true);
            assert!(RoleRegistry::has_role(&env, &user, Role::Scorer));

            RoleRegistry::set_role(&env, &user, Role::Scorer, false);
            assert!(!RoleRegistry::has_role(&env, &user, Role::Scorer));
        });
    }
}
