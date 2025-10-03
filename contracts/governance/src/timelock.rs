#![allow(unused)]
use crate::types::GovernanceError;
use soroban_sdk::{contract, contractimpl, panic_with_error, symbol_short, Address, Bytes, Env};

/// Timelock Contract - delays execution of governance proposals
/// @notice This provides a safety window for protocol defenders to react to malicious proposals
#[contract]
pub struct Timelock;

#[contractimpl]
impl Timelock {
    /// Initialize the timelock
    /// @param admin: The governance contract address (only it can queue/execute)
    /// @param delay: Minimum delay in seconds before execution
    pub fn initialize(env: Env, admin: Address, delay: u64) {
        admin.require_auth();
        
        env.storage().instance().set(&symbol_short!("ADMIN"), &admin);
        env.storage().instance().set(&symbol_short!("DELAY"), &delay);
    }

    /// Queue a transaction for future execution
    /// @notice Only admin (governance contract) can call this
    /// @param target: The contract address to call
    /// @param value: Amount of tokens to transfer (usually 0)
    /// @param data: The calldata to execute
    /// @param eta: Estimated time of arrival (unix timestamp when execution is allowed)
    pub fn queue_transaction(
        env: Env,
        target: Address,
        value: u128,
        data: Bytes,
        eta: u64,
    ) -> Bytes {
        let admin = Self::_admin(&env);
        admin.require_auth();

        let delay = Self::_delay(&env);
        let current_time = env.ledger().timestamp();

        // Ensure ETA is at least delay in the future
        if eta < current_time + delay {
            panic_with_error!(&env, GovernanceError::TimelockNotExpired);
        }

        // Create transaction hash
        let tx_hash = Self::_get_tx_hash(&env, &target, value, &data, eta);

        // Mark as queued
        env.storage().persistent().set(&(symbol_short!("QUEUED"), tx_hash.clone()), &true);

        // Emit QueueTransaction event
        env.events().publish(
            (symbol_short!("Queue"), tx_hash.clone()),
            (target, value, eta)
        );

        tx_hash
    }

    /// Execute a queued transaction
    /// @notice Only admin can call, and only after ETA has passed
    pub fn execute_transaction(
        env: Env,
        target: Address,
        value: u128,
        data: Bytes,
        eta: u64,
    ) -> Bytes {
        let admin = Self::_admin(&env);
        admin.require_auth();

        let tx_hash = Self::_get_tx_hash(&env, &target, value, &data, eta);

        // Check if queued
        if !Self::is_queued(env.clone(), tx_hash.clone()) {
            panic_with_error!(&env, GovernanceError::InvalidState);
        }

        // Check if timelock has passed
        let current_time = env.ledger().timestamp();
        if current_time < eta {
            panic_with_error!(&env, GovernanceError::TimelockNotExpired);
        }

        // Check if not expired (grace period is 14 days)
        let grace_period = 14 * 24 * 60 * 60u64; // 14 days in seconds
        if current_time > eta + grace_period {
            panic_with_error!(&env, GovernanceError::InvalidState);
        }

        // Remove from queue
        env.storage().persistent().remove(&(symbol_short!("QUEUED"), tx_hash.clone()));

        // Execute the transaction
        // would ideally use env.invoke_contract
        // but For now, i marked it as executed and emit event
        env.events().publish(
            (symbol_short!("Execute"), tx_hash.clone()),
            (target, value, current_time)
        );

        tx_hash
    }

    /// Cancel a queued transaction
    /// @notice Only admin can cancel
    pub fn cancel_transaction(
        env: Env,
        target: Address,
        value: u128,
        data: Bytes,
        eta: u64,
    ) {
        let admin = Self::_admin(&env);
        admin.require_auth();

        let tx_hash = Self::_get_tx_hash(&env, &target, value, &data, eta);
        env.storage().persistent().remove(&(symbol_short!("QUEUED"), tx_hash.clone()));

        // Emit CancelTransaction event
        env.events().publish((symbol_short!("Cancel"), tx_hash), (target, value));
    }

    /// Check if a transaction is queued
    pub fn is_queued(env: Env, tx_hash: Bytes) -> bool {
        env.storage()
            .persistent()
            .get::<_, bool>(&(symbol_short!("QUEUED"), tx_hash))
            .unwrap_or(false)
    }

    /// Get the timelock delay
    pub fn get_delay(env: Env) -> u64 {
        Self::_delay(&env)
    }

    /// Get the admin address
    pub fn get_admin(env: Env) -> Address {
        Self::_admin(&env)
    }

    // ========== INTERNAL HELPER FUNCTIONS ==========

    fn _admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("ADMIN"))
            .unwrap()
    }

    fn _delay(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&symbol_short!("DELAY"))
            .unwrap()
    }

    /// Generate a unique hash for a transaction
    fn _get_tx_hash(env: &Env, target: &Address, value: u128, data: &Bytes, eta: u64) -> Bytes {
        // Create a simple hash by concatenating components
        let mut hash_data = Bytes::new(env);
        hash_data.append(&Bytes::from_array(env, &value.to_be_bytes()));
        hash_data.append(data);
        hash_data.append(&Bytes::from_array(env, &eta.to_be_bytes()));
        
        // Use keccak256 and convert hash to Bytes
        let hash = env.crypto().keccak256(&hash_data);
        Bytes::from_array(env, &hash.to_array())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, Timelock);
        let client = TimelockClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let delay = 172800u64; // 2 days

        env.mock_all_auths();
        client.initialize(&admin, &delay);

        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.get_delay(), delay);
    }

    #[test]
    fn test_queue_and_execute() {
        let env = Env::default();
        env.ledger().with_mut(|li| {
            li.timestamp = 1000000;
        });

        let contract_id = env.register_contract(None, Timelock);
        let client = TimelockClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let delay = 3600u64; // 1 hour

        env.mock_all_auths();
        client.initialize(&admin, &delay);

        let target = Address::generate(&env);
        let value = 0u128;
        let data = Bytes::new(&env);
        let eta = 1000000 + delay + 100; // Current time + delay + buffer

        // Queue transaction
        let tx_hash = client.queue_transaction(&target, &value, &data, &eta);
        assert!(client.is_queued(&tx_hash));

        // Try to execute before ETA - should fail
        
        // Move time forward past ETA
        env.ledger().with_mut(|li| {
            li.timestamp = eta + 1;
        });

        // Execute transaction
        client.execute_transaction(&target, &value, &data, &eta);
        assert!(!client.is_queued(&tx_hash));
    }

    #[test]
    fn test_cancel_transaction() {
        let env = Env::default();
        env.ledger().with_mut(|li| {
            li.timestamp = 1000000;
        });

        let contract_id = env.register_contract(None, Timelock);
        let client = TimelockClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let delay = 3600u64;

        env.mock_all_auths();
        client.initialize(&admin, &delay);

        let target = Address::generate(&env);
        let value = 0u128;
        let data = Bytes::new(&env);
        let eta = 1000000 + delay + 100;

        let tx_hash = client.queue_transaction(&target, &value, &data, &eta);
        assert!(client.is_queued(&tx_hash));

        // Cancel the transaction
        client.cancel_transaction(&target, &value, &data, &eta);
        assert!(!client.is_queued(&tx_hash));
    }
}

