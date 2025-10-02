use soroban_sdk::{contracterror, contracttype, Address, BytesN, Env, symbol_short, panic_with_error};

#[contracttype]
#[derive(Clone)]
enum UpgradeKey {
    Admin,
    Version,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAdmin = 1,
    AlreadyUpgraded = 2,
}

const CURRENT_VERSION: u32 = 1u32;
const YEAR_LEDGERS: u32 = 6_307_200;  // ~1 year

pub fn init_admin(env: &Env, admin: &Address) {
    if env.storage().instance().has(&UpgradeKey::Admin) {
        return;  // Idempotent
    }
    env.storage().instance().set(&UpgradeKey::Admin, admin);
    env.storage().instance().set(&UpgradeKey::Version, &CURRENT_VERSION);
}

pub fn upgrade(env: &Env, admin: Address, new_wasm_hash: BytesN<32>) {
    admin.require_auth();

    let admin_stored: Address = env.storage().instance().get(&UpgradeKey::Admin).unwrap();
    if admin != admin_stored {
        panic_with_error!(env, Error::NotAdmin);
    }

    let version: u32 = env.storage().instance().get(&UpgradeKey::Version).unwrap_or(0);
    if version >= CURRENT_VERSION {
        panic_with_error!(env, Error::AlreadyUpgraded);
    }

    // Basic migration: Extend TTL all persistent keys
    bump_all_scores(env);

    // Perform upgrade
    env.deployer().update_current_contract_wasm(new_wasm_hash);

    // Update version
    let new_version = version + 1;
    env.storage().instance().set(&UpgradeKey::Version, &new_version);

    // Emit event
    crate::events::emit_upgraded(env, &new_version);
}

fn bump_all_scores(env: &Env) {
    let score_key = symbol_short!("score");
    if env.storage().persistent().has(&score_key) {
        env.storage().persistent().extend_ttl(&score_key, YEAR_LEDGERS, YEAR_LEDGERS);
    }
}