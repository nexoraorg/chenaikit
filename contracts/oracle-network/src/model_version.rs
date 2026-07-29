use soroban_sdk::{BytesN, Env, String, Vec};
use crate::storage;
use crate::events::emit_model_approved;
use crate::events::emit_model_revoked;

/// Model metadata structure
#[derive(Clone)]
pub struct ModelMetadata {
    pub hash: BytesN<32>,
    pub approved_at: u64,
    pub metadata: String,
    pub is_active: bool,
}

/// Approve a model version
pub fn approve_model_version(env: &Env, model_hash: BytesN<32>, metadata: String) {
    let mut models = storage::get_models_set(env);
    
    if models.contains(&model_hash) {
        panic!("model version already approved");
    }
    
    models.add(model_hash);
    storage::set_models_set(env, &models);
    
    // Store metadata
    let metadata_key = soroban_sdk::Symbol::short("model_meta");
    let mut metadata_map: soroban_sdk::Map<BytesN<32>, ModelMetadata> = env
        .storage()
        .instance()
        .get(&metadata_key)
        .unwrap_or_else(|| soroban_sdk::Map::new(env));
    
    let model_metadata = ModelMetadata {
        hash: model_hash,
        approved_at: env.ledger().timestamp(),
        metadata,
        is_active: true,
    };
    
    metadata_map.set(model_hash, model_metadata);
    env.storage().instance().set(&metadata_key, &metadata_map);
    
    emit_model_approved(env, &model_hash);
}

/// Revoke a model version
pub fn revoke_model_version(env: &Env, model_hash: BytesN<32>) {
    let mut models = storage::get_models_set(env);
    
    if !models.contains(&model_hash) {
        panic!("model version not approved");
    }
    
    models.remove(&model_hash);
    storage::set_models_set(env, &models);
    
    // Update metadata
    let metadata_key = soroban_sdk::Symbol::short("model_meta");
    let mut metadata_map: soroban_sdk::Map<BytesN<32>, ModelMetadata> = env
        .storage()
        .instance()
        .get(&metadata_key)
        .expect("metadata map not found");
    
    if let Some(mut model_metadata) = metadata_map.get(model_hash) {
        model_metadata.is_active = false;
        metadata_map.set(model_hash, model_metadata);
    }
    
    env.storage().instance().set(&metadata_key, &metadata_map);
    
    emit_model_revoked(env, &model_hash);
}

/// Check if a model version is approved
pub fn is_model_approved(env: &Env, model_hash: BytesN<32>) -> bool {
    let models = storage::get_models_set(env);
    models.contains(&model_hash)
}

/// Get all approved model versions
pub fn get_approved_models(env: &Env) -> Vec<BytesN<32>> {
    let models = storage::get_models_set(env);
    let mut result = Vec::new(env);
    
    for model_hash in models {
        result.push_back(model_hash);
    }
    
    result
}

/// Get model metadata
pub fn get_model_metadata(env: &Env, model_hash: BytesN<32>) -> ModelMetadata {
    let metadata_key = soroban_sdk::Symbol::short("model_meta");
    let metadata_map: soroban_sdk::Map<BytesN<32>, ModelMetadata> = env
        .storage()
        .instance()
        .get(&metadata_key)
        .expect("metadata map not found");
    
    metadata_map.get(model_hash)
        .expect("model metadata not found")
}
