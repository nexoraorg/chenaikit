use crate::errors::CommonError;
use crate::storage::StorageHelpers;
use soroban_sdk::{symbol_short, Address, Env, Symbol};

/// Ownable pattern - single owner access control
pub struct Ownable;

impl Ownable {
    const OWNER_KEY: Symbol = symbol_short!("owner");

    /// Initialize owner (call once during contract initialization)
    ///
    /// # Example
    /// ```
    /// pub fn initialize(env: Env, owner: Address) {
    ///     owner.require_auth();
    ///     Ownable::init(&env, &owner);
    /// }
    /// ```
    pub fn init(env: &Env, owner: &Address) {
        env.storage().instance().set(&Self::OWNER_KEY, owner);
    }

    /// Get current owner
    pub fn get_owner(env: &Env) -> core::result::Result<Address, CommonError> {
        env.storage()
            .instance()
            .get(&Self::OWNER_KEY)
            .ok_or(CommonError::NotFound)
    }

    /// Check if address is owner
    pub fn is_owner(env: &Env, address: &Address) -> bool {
        if let Ok(owner) = Self::get_owner(env) {
            owner == *address
        } else {
            false
        }
    }

    /// Require caller is owner
    pub fn require_owner(env: &Env, address: &Address) -> core::result::Result<(), CommonError> {
        if !Self::is_owner(env, address) {
            return Err(CommonError::Unauthorized);
        }
        Ok(())
    }

    /// Transfer ownership to new owner
    pub fn transfer_ownership(
        env: &Env,
        current_owner: &Address,
        new_owner: &Address,
    ) -> core::result::Result<(), CommonError> {
        Self::require_owner(env, current_owner)?;
        env.storage().instance().set(&Self::OWNER_KEY, new_owner);
        Ok(())
    }

    /// Renounce ownership (set to zero address equivalent - dangerous!)
    pub fn renounce_ownership(env: &Env, owner: &Address) -> core::result::Result<(), CommonError> {
        Self::require_owner(env, owner)?;
        env.storage().instance().remove(&Self::OWNER_KEY);
        Ok(())
    }
}

/// Pausable pattern - emergency stop mechanism
pub struct Pausable;

impl Pausable {
    const PAUSED_KEY: Symbol = symbol_short!("paused");

    /// Initialize as unpaused
    pub fn init(env: &Env) {
        env.storage().instance().set(&Self::PAUSED_KEY, &false);
    }

    /// Check if contract is paused
    pub fn is_paused(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&Self::PAUSED_KEY)
            .unwrap_or(false)
    }

    /// Require contract is not paused
    pub fn require_not_paused(env: &Env) -> core::result::Result<(), CommonError> {
        if Self::is_paused(env) {
            Err(CommonError::Paused)
        } else {
            Ok(())
        }
    }

    /// Require contract is paused
    pub fn require_paused(env: &Env) -> core::result::Result<(), CommonError> {
        if !Self::is_paused(env) {
            Err(CommonError::NotAllowed)
        } else {
            Ok(())
        }
    }

    /// Pause the contract (owner only)
    pub fn pause(env: &Env, caller: &Address) -> core::result::Result<(), CommonError> {
        Ownable::require_owner(env, caller)?;
        Self::require_not_paused(env)?;
        env.storage().instance().set(&Self::PAUSED_KEY, &true);
        Ok(())
    }

    /// Unpause the contract (owner only)
    pub fn unpause(env: &Env, caller: &Address) -> core::result::Result<(), CommonError> {
        Ownable::require_owner(env, caller)?;
        Self::require_paused(env)?;
        env.storage().instance().set(&Self::PAUSED_KEY, &false);
        Ok(())
    }
}

/// Role-based access control
pub struct AccessControl;

impl AccessControl {
    /// Check if address has a specific role
    ///
    /// # Example
    /// ```
    /// let has_admin = AccessControl::has_role(&env, &address, &symbol_short!("admin"));
    /// ```
    pub fn has_role(env: &Env, address: &Address, role: &Symbol) -> bool {
        let key = (symbol_short!("role"), role.clone(), address.clone());
        env.storage()
            .persistent()
            .get::<_, bool>(&key)
            .unwrap_or(false)
    }

    /// Grant role to address
    pub fn grant_role(
        env: &Env,
        admin: &Address,
        address: &Address,
        role: &Symbol,
    ) -> core::result::Result<(), CommonError> {
        Ownable::require_owner(env, admin)?;
        let key = (symbol_short!("role"), role.clone(), address.clone());
        env.storage().persistent().set(&key, &true);
        StorageHelpers::extend_persistent(env, &key, 5184000, 5184000); // ~60 days
        Ok(())
    }

    /// Revoke role from address
    pub fn revoke_role(
        env: &Env,
        admin: &Address,
        address: &Address,
        role: &Symbol,
    ) -> core::result::Result<(), CommonError> {
        Ownable::require_owner(env, admin)?;
        let key = (symbol_short!("role"), role.clone(), address.clone());
        env.storage().persistent().remove(&key);
        Ok(())
    }

    /// Require address has role
    pub fn require_role(
        env: &Env,
        address: &Address,
        role: &Symbol,
    ) -> core::result::Result<(), CommonError> {
        if !Self::has_role(env, address, role) {
            return Err(CommonError::Unauthorized);
        }
        Ok(())
    }

    /// Check if address has any of the specified roles
    pub fn has_any_role(env: &Env, address: &Address, roles: &[Symbol]) -> bool {
        roles.iter().any(|role| Self::has_role(env, address, role))
    }

    /// Require address has any of the specified roles
    pub fn require_any_role(
        env: &Env,
        address: &Address,
        roles: &[Symbol],
    ) -> core::result::Result<(), CommonError> {
        if !Self::has_any_role(env, address, roles) {
            return Err(CommonError::Unauthorized);
        }
        Ok(())
    }
}

/// Whitelist management
pub struct Whitelist;

impl Whitelist {
    /// Add address to whitelist
    pub fn add(
        env: &Env,
        admin: &Address,
        address: &Address,
    ) -> core::result::Result<(), CommonError> {
        Ownable::require_owner(env, admin)?;
        let key = (symbol_short!("wlist"), address.clone());
        env.storage().persistent().set(&key, &true);
        StorageHelpers::extend_persistent(env, &key, 5184000, 5184000);
        Ok(())
    }

    /// Remove address from whitelist
    pub fn remove(
        env: &Env,
        admin: &Address,
        address: &Address,
    ) -> core::result::Result<(), CommonError> {
        Ownable::require_owner(env, admin)?;
        let key = (symbol_short!("wlist"), address.clone());
        env.storage().persistent().remove(&key);
        Ok(())
    }

    /// Check if address is whitelisted
    pub fn is_whitelisted(env: &Env, address: &Address) -> bool {
        let key = (symbol_short!("wlist"), address.clone());
        env.storage()
            .persistent()
            .get::<_, bool>(&key)
            .unwrap_or(false)
    }

    /// Require address is whitelisted
    pub fn require_whitelisted(
        env: &Env,
        address: &Address,
    ) -> core::result::Result<(), CommonError> {
        if !Self::is_whitelisted(env, address) {
            return Err(CommonError::Unauthorized);
        }
        Ok(())
    }
}
