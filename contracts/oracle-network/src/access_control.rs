use soroban_sdk::{Address, Env, Symbol};

/// Storage keys for access control
const ADMIN_KEY: Symbol = Symbol::short("admin");
const GOVERNANCE_KEY: Symbol = Symbol::short("govern");

/// Initialize admin address
pub fn init_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&ADMIN_KEY, admin);
}

/// Get admin address
pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&ADMIN_KEY)
        .expect("admin not initialized")
}

/// Set governance address
pub fn set_governance(env: &Env, governance: &Address) {
    env.storage().instance().set(&GOVERNANCE_KEY, governance);
}

/// Get governance address
pub fn get_governance(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&GOVERNANCE_KEY)
        .expect("governance not initialized")
}

/// Require caller is admin
pub fn require_admin(env: &Env, caller: &Address) {
    let admin = get_admin(env);
    if admin != *caller {
        panic!("caller is not admin");
    }
}

/// Require caller is governance contract
pub fn require_governance(env: &Env, caller: &Address) {
    let governance = get_governance(env);
    if governance != *caller {
        panic!("caller is not governance");
    }
}
