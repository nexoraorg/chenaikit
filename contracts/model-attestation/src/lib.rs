#![no_std]

use soroban_sdk::{contractimpl, symbol_short, Address, Env, Symbol, Vec};
use common_utils::{Ownable, StorageHelpers, StorageType, CommonError};

pub struct ModelAttestationContract;

#[contractimpl]
impl ModelAttestationContract {
    /// Initialize the contract owner
    pub fn initialize(env: Env, owner: Address) {
        owner.require_auth();
        Ownable::init(&env, &owner);
    }

    /// Register a model artifact hash (owner only)
    pub fn register_model(
        env: Env,
        admin: Address,
        model_id: Symbol,
        artifact_hash: Vec<u8>,
    ) -> Result<(), CommonError> {
        admin.require_auth();
        Ownable::require_owner(&env, &admin)?;
        let key = (symbol_short!("model"), model_id.clone());
        StorageHelpers::set(&env, &key, &artifact_hash, StorageType::Persistent);
        Ok(())
    }

    /// Revoke a registered model (owner only)
    pub fn revoke_model(env: Env, admin: Address, model_id: Symbol) -> Result<(), CommonError> {
        admin.require_auth();
        Ownable::require_owner(&env, &admin)?;
        let key = (symbol_short!("model"), model_id.clone());
        StorageHelpers::remove(&env, &key, StorageType::Persistent);
        Ok(())
    }

    /// Register an attestation signer public key (owner only)
    pub fn register_signer(
        env: Env,
        admin: Address,
        key_id: Symbol,
        public_key: Vec<u8>,
    ) -> Result<(), CommonError> {
        admin.require_auth();
        Ownable::require_owner(&env, &admin)?;
        let key = (symbol_short!("signer"), key_id.clone());
        StorageHelpers::set(&env, &key, &public_key, StorageType::Persistent);
        Ok(())
    }

    /// Revoke a signer
    pub fn revoke_signer(env: Env, admin: Address, key_id: Symbol) -> Result<(), CommonError> {
        admin.require_auth();
        Ownable::require_owner(&env, &admin)?;
        let key = (symbol_short!("signer"), key_id.clone());
        StorageHelpers::remove(&env, &key, StorageType::Persistent);
        Ok(())
    }

    /// Anchor a batch root on-chain (owner only)
    pub fn anchor_batch(
        env: Env,
        admin: Address,
        batch_id: Symbol,
        root: Vec<u8>,
        count: u32,
    ) -> Result<(), CommonError> {
        admin.require_auth();
        Ownable::require_owner(&env, &admin)?;
        let key = (symbol_short!("batch"), batch_id.clone());
        let value = (root, count);
        StorageHelpers::set(&env, &key, &value, StorageType::Persistent);
        Ok(())
    }

    /// Query registered model artifact hash
    pub fn get_model(env: Env, model_id: Symbol) -> Option<Vec<u8>> {
        let key = (symbol_short!("model"), model_id.clone());
        env.storage().persistent().get(&key)
    }

    /// Query signer public key
    pub fn get_signer(env: Env, key_id: Symbol) -> Option<Vec<u8>> {
        let key = (symbol_short!("signer"), key_id.clone());
        env.storage().persistent().get(&key)
    }

    /// Query anchored batch
    pub fn get_batch(env: Env, batch_id: Symbol) -> Option<(Vec<u8>, u32)> {
        let key = (symbol_short!("batch"), batch_id.clone());
        env.storage().persistent().get(&key)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, Vec as SDKVec};

    fn setup(env: &Env) -> (Address, ModelAttestationContractClient<'_>) {
        let contract_id = env.register_contract(None, ModelAttestationContract);
        let client = ModelAttestationContractClient::new(env, &contract_id);
        let owner = Address::generate(env);
        env.mock_all_auths();
        client.initialize(&owner);
        (owner, client)
    }

    #[test]
    fn test_register_and_get_model() {
        let env = Env::default();
        let (owner, client) = setup(&env);

        // Artifact hash bytes
        let bytes: [u8; 4] = [1, 2, 3, 4];
        let artifact = SDKVec::from_slice(&env, &bytes);

        // Register model
        let model_sym = symbol_short!("mdl");
        client.register_model(&owner, &model_sym, &artifact).unwrap();

        // Retrieve
        let got: Option<SDKVec<u8>> = client.get_model(&model_sym);
        assert!(got.is_some());
    }
}
