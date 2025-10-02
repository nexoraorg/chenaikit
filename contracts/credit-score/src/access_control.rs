use soroban_sdk::{Address, Env, Symbol, symbol_short, Map};

const ADMIN_KEY: Symbol = symbol_short!("admin");
const ROLES_KEY: Symbol = symbol_short!("roles");

/// Initialize the admin (should be called once during contract initialization)
pub fn initialize_admin(env: &Env, admin: Address) {
    // Check if admin is already set
    if env.storage().instance().has(&ADMIN_KEY) {
        panic!("Admin already initialized");
    }
    
    admin.require_auth();
    env.storage().instance().set(&ADMIN_KEY, &admin);
}

/// Get the admin address (returns None if not set)
pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&ADMIN_KEY)
}

/// Check if caller is admin
pub fn is_admin(env: &Env, caller: &Address) -> bool {
    match get_admin(env) {
        Some(admin) => *caller == admin,
        None => false, // No admin set, so no one is admin
    }
}

/// Require that the caller is admin
pub fn require_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    
    if !is_admin(env, caller) {
        panic!("Unauthorized: Admin only");
    }
}

/// Require that the caller is the owner
pub fn require_owner(env: &Env, caller: &Address, owner: &Address) {
    caller.require_auth();
    
    if caller != owner {
        panic!("Unauthorized: Owner only");
    }
}

/// Grant a role to a user (admin only)
pub fn grant_role(env: &Env, caller: Address, role: Symbol, user: Address) {
    caller.require_auth();
    require_admin(env, &caller);
    
    let mut roles: Map<Symbol, Address> = env
        .storage()
        .persistent()
        .get(&ROLES_KEY)
        .unwrap_or_else(|| Map::new(env));
    
    roles.set(role, user);
    env.storage().persistent().set(&ROLES_KEY, &roles);
}

/// Revoke a role from a user (admin only)
pub fn revoke_role(env: &Env, caller: Address, role: Symbol) {
    caller.require_auth();
    require_admin(env, &caller);
    
    let mut roles: Map<Symbol, Address> = env
        .storage()
        .persistent()
        .get(&ROLES_KEY)
        .unwrap_or_else(|| Map::new(env));
    
    roles.remove(role);
    env.storage().persistent().set(&ROLES_KEY, &roles);
}

/// Check if an address has a specific role
pub fn has_role(env: &Env, role: Symbol, user: &Address) -> bool {
    let roles: Map<Symbol, Address> = env
        .storage()
        .persistent()
        .get(&ROLES_KEY)
        .unwrap_or_else(|| Map::new(env));
    
    match roles.get(role) {
        Some(role_holder) => role_holder == *user,
        None => false,
    }
}

/// Require that the caller has a specific role
pub fn require_role(env: &Env, caller: &Address, role: Symbol) {
    caller.require_auth();
    
    if !has_role(env, role, caller) {
        panic!("Unauthorized: Required role not found");
    }
}

/// Transfer admin rights to a new admin (current admin only)
pub fn transfer_admin(env: &Env, caller: Address, new_admin: Address) {
    caller.require_auth();
    require_admin(env, &caller);
    new_admin.require_auth();
    
    env.storage().instance().set(&ADMIN_KEY, &new_admin);
}