use crate::errors::CommonError;
use soroban_sdk::{Env, Symbol, Vec};

/// Storage type enumeration
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum StorageType {
    /// Temporary storage (cheaper, shorter TTL)
    Temporary,
    /// Persistent storage (more expensive, longer TTL)
    Persistent,
    /// Instance storage (contract-level data)
    Instance,
}

/// Storage helper utilities
pub struct StorageHelpers;

impl StorageHelpers {
    /// Create a composite storage key from two symbols
    ///
    /// # Example
    /// ```
    /// let key = StorageHelpers::make_key_2(symbol_short!("user"), symbol_short!("balance"));
    /// ```
    pub fn make_key_2(prefix: Symbol, suffix: &Symbol) -> Vec<Symbol> {
        let mut key = Vec::new(&Env::default());
        key.push_back(prefix);
        key.push_back(suffix.clone());
        key
    }

    /// Create a composite storage key from symbol and address
    pub fn make_key_addr(
        _env: &Env,
        prefix: Symbol,
        addr: &soroban_sdk::Address,
    ) -> (Symbol, soroban_sdk::Address) {
        (prefix, addr.clone())
    }

    /// Extend TTL for persistent storage
    ///
    /// # Arguments
    /// * `key` - Storage key
    /// * `threshold` - Extend if TTL is below this
    /// * `extend_to` - Extend TTL to this value
    pub fn extend_persistent<K>(env: &Env, key: &K, threshold: u32, extend_to: u32)
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        env.storage()
            .persistent()
            .extend_ttl(key, threshold, extend_to);
    }

    /// Extend TTL for temporary storage
    pub fn extend_temporary<K>(env: &Env, key: &K, threshold: u32, extend_to: u32)
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        env.storage()
            .temporary()
            .extend_ttl(key, threshold, extend_to);
    }

    /// Extend TTL for instance storage
    pub fn extend_instance(env: &Env, threshold: u32, extend_to: u32) {
        env.storage().instance().extend_ttl(threshold, extend_to);
    }

    /// Check if key exists in persistent storage
    pub fn has_persistent<K>(env: &Env, key: &K) -> bool
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        env.storage().persistent().has(key)
    }

    /// Check if key exists in temporary storage
    pub fn has_temporary<K>(env: &Env, key: &K) -> bool
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        env.storage().temporary().has(key)
    }

    /// Check if key exists in instance storage
    pub fn has_instance<K>(env: &Env, key: &K) -> bool
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        env.storage().instance().has(key)
    }

    /// Get value from storage with default
    pub fn get_or_default<K, V>(env: &Env, key: &K, default: V, storage_type: StorageType) -> V
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
        V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>,
    {
        match storage_type {
            StorageType::Persistent => env.storage().persistent().get(key).unwrap_or(default),
            StorageType::Temporary => env.storage().temporary().get(key).unwrap_or(default),
            StorageType::Instance => env.storage().instance().get(key).unwrap_or(default),
        }
    }

    /// Safely get value from storage
    pub fn get<K, V>(
        env: &Env,
        key: &K,
        storage_type: StorageType,
    ) -> core::result::Result<V, CommonError>
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
        V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>,
    {
        let value = match storage_type {
            StorageType::Persistent => env.storage().persistent().get(key),
            StorageType::Temporary => env.storage().temporary().get(key),
            StorageType::Instance => env.storage().instance().get(key),
        };
        value.ok_or(CommonError::NotFound)
    }

    /// Set value in storage
    pub fn set<K, V>(env: &Env, key: &K, value: &V, storage_type: StorageType)
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
        V: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        match storage_type {
            StorageType::Persistent => env.storage().persistent().set(key, value),
            StorageType::Temporary => env.storage().temporary().set(key, value),
            StorageType::Instance => env.storage().instance().set(key, value),
        }
    }

    /// Remove value from storage
    pub fn remove<K>(env: &Env, key: &K, storage_type: StorageType)
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        match storage_type {
            StorageType::Persistent => env.storage().persistent().remove(key),
            StorageType::Temporary => env.storage().temporary().remove(key),
            StorageType::Instance => env.storage().instance().remove(key),
        }
    }

    /// Increment counter in storage
    pub fn increment<K>(
        env: &Env,
        key: &K,
        storage_type: StorageType,
    ) -> core::result::Result<i128, CommonError>
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        let current: i128 = Self::get_or_default(env, key, 0i128, storage_type);
        let new_value = current.checked_add(1).ok_or(CommonError::Overflow)?;
        Self::set(env, key, &new_value, storage_type);
        Ok(new_value)
    }

    /// Decrement counter in storage
    pub fn decrement<K>(
        env: &Env,
        key: &K,
        storage_type: StorageType,
    ) -> core::result::Result<i128, CommonError>
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        let current: i128 = Self::get_or_default(env, key, 0i128, storage_type);
        let new_value = current.checked_sub(1).ok_or(CommonError::Underflow)?;
        Self::set(env, key, &new_value, storage_type);
        Ok(new_value)
    }
}

/// Counter utility for managing incrementing IDs
pub struct Counter {
    key: Symbol,
}

impl Counter {
    /// Create a new counter with a specific key
    pub fn new(key: Symbol) -> Self {
        Self { key }
    }

    /// Get current counter value
    pub fn get(&self, env: &Env) -> i128 {
        env.storage().instance().get(&self.key).unwrap_or(0i128)
    }

    /// Increment and return new value
    pub fn increment(&self, env: &Env) -> core::result::Result<i128, CommonError> {
        let current = self.get(env);
        let new_value = current.checked_add(1).ok_or(CommonError::Overflow)?;
        env.storage().instance().set(&self.key, &new_value);
        Ok(new_value)
    }

    /// Set counter to specific value
    pub fn set(&self, env: &Env, value: i128) {
        env.storage().instance().set(&self.key, &value);
    }

    /// Reset counter to zero
    pub fn reset(&self, env: &Env) {
        self.set(env, 0);
    }
}

/// Mapping utility for key-value storage
#[allow(dead_code)]
pub struct Mapping<K, V> {
    prefix: Symbol,
    _phantom: core::marker::PhantomData<(K, V)>,
}

#[allow(dead_code)]
impl<K, V> Mapping<K, V> {
    /// Create a new mapping with a prefix
    pub fn new(prefix: Symbol) -> Self {
        Self {
            prefix,
            _phantom: core::marker::PhantomData,
        }
    }
}
