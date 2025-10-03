#![allow(unused)]
use crate::types::{Checkpoint, GovernanceError};
use soroban_sdk::{contract, contractimpl, panic_with_error, symbol_short, Address, Env, String, Vec};

/// Governance Token Contract with Compound-style checkpoints and delegation
#[contract]
pub struct GovernanceToken;

#[contractimpl]
impl GovernanceToken {
    /// Initialize the governance token
    /// @param env: The contract environment
    /// @param admin: The initial admin address
    /// @param name: Token name
    /// @param symbol: Token symbol
    /// @param decimals: Token decimals
    /// @param initial_supply: Initial token supply
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
        initial_supply: u128,
    ) {
        admin.require_auth();
        
        // Store token metadata
        env.storage().instance().set(&symbol_short!("NAME"), &name);
        env.storage().instance().set(&symbol_short!("SYMBOL"), &symbol);
        env.storage().instance().set(&symbol_short!("DECIMALS"), &decimals);
        env.storage().instance().set(&symbol_short!("ADMIN"), &admin);
        env.storage().instance().set(&symbol_short!("TOTAL"), &initial_supply);
        
        // Mint initial supply to admin
        env.storage().persistent().set(&(symbol_short!("BALANCE"), admin.clone()), &initial_supply);
        
        // Initialize admin's checkpoints with initial supply
        Self::_write_checkpoint(&env, &admin, initial_supply);
        
        // Emit Mint event (Transfer from zero address)
        env.events()
            .publish((symbol_short!("Mint"),), (admin.clone(), initial_supply));
    }

    /// Get token balance of an account
    pub fn balance_of(env: Env, account: Address) -> u128 {
        Self::_get_balance(&env, &account)
    }

    /// Transfer tokens from sender to recipient
    /// @notice This checks authorization and prevents overflow
    pub fn transfer(env: Env, from: Address, to: Address, amount: u128) {
        from.require_auth();
        
        if amount == 0 {
            return;
        }

        let from_balance = Self::_get_balance(&env, &from);
        if from_balance < amount {
            panic_with_error!(&env, GovernanceError::InsufficientBalance);
        }

        // Update balances
        env.storage().persistent().set(&(symbol_short!("BALANCE"), from.clone()), &(from_balance - amount));
        
        let to_balance = Self::_get_balance(&env, &to);
        let new_to_balance = to_balance.checked_add(amount)
            .expect("Overflow in balance");
        env.storage().persistent().set(&(symbol_short!("BALANCE"), to.clone()), &new_to_balance);

        // Move delegates if necessary
        let from_delegate = Self::_delegates(&env, &from);
        Self::_move_delegates(&env, &from_delegate, &Self::_delegates(&env, &to), amount);

        // Emit Transfer event
        env.events().publish((symbol_short!("Transfer"), from.clone()), (to, amount));
    }

    /// Approve spender to spend tokens on behalf of owner
    pub fn approve(env: Env, owner: Address, spender: Address, amount: u128) {
        owner.require_auth();
        
        env.storage().persistent().set(&(symbol_short!("ALLOW"), owner.clone(), spender.clone()), &amount);
        
        // Emit Approval event
        env.events().publish((symbol_short!("Approval"), owner), (spender, amount));
    }

    /// Get allowance amount
    pub fn allowance(env: Env, owner: Address, spender: Address) -> u128 {
        env.storage()
            .persistent()
            .get(&(symbol_short!("ALLOW"), owner, spender))
            .unwrap_or(0)
    }

    /// Transfer tokens using allowance mechanism
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: u128) {
        spender.require_auth();

        if amount == 0 {
            return;
        }

        // Check and update allowance
        let allowance = Self::allowance(env.clone(), from.clone(), spender.clone());
        if allowance < amount {
            panic_with_error!(&env, GovernanceError::InsufficientBalance);
        }
        env.storage().persistent().set(
            &(symbol_short!("ALLOW"), from.clone(), spender.clone()),
            &(allowance - amount)
        );

        // Perform transfer
        let from_balance = Self::_get_balance(&env, &from);
        if from_balance < amount {
            panic_with_error!(&env, GovernanceError::InsufficientBalance);
        }

        env.storage().persistent().set(&(symbol_short!("BALANCE"), from.clone()), &(from_balance - amount));
        
        let to_balance = Self::_get_balance(&env, &to);
        env.storage().persistent().set(&(symbol_short!("BALANCE"), to.clone()), &(to_balance + amount));

        // Move delegates
        let from_delegate = Self::_delegates(&env, &from);
        Self::_move_delegates(&env, &from_delegate, &Self::_delegates(&env, &to), amount);

        // Emit Transfer event
        env.events().publish((symbol_short!("Transfer"), from), (to, amount));
    }

    /// Delegate voting power to another account
    /// @notice Delegation does not transfer tokens, only voting power
    pub fn delegate(env: Env, delegator: Address, delegatee: Address) {
        delegator.require_auth();
        
        let current_delegate = Self::_delegates(&env, &delegator);
        let delegator_balance = Self::_get_balance(&env, &delegator);
        
        // Update delegate mapping
        env.storage().persistent().set(&(symbol_short!("DELEGAT"), delegator.clone()), &delegatee);
        
        // Emit DelegateChanged event
        env.events().publish(
            (symbol_short!("DelChg"), delegator.clone()),
            (current_delegate.clone(), delegatee.clone())
        );
        
        // Move voting power
        Self::_move_delegates(&env, &current_delegate, &delegatee, delegator_balance);
    }

    /// Get the current delegate for an account
    pub fn delegates(env: Env, account: Address) -> Address {
        Self::_delegates(&env, &account)
    }

    /// Get current votes (voting power) for an account
    pub fn get_current_votes(env: Env, account: Address) -> u128 {
        let num_checkpoints = Self::_num_checkpoints(&env, &account);
        if num_checkpoints > 0 {
            Self::_get_checkpoint(&env, &account, num_checkpoints - 1).votes
        } else {
            0
        }
    }

    /// Get prior votes (historical voting power) at a specific block
    /// @notice This is critical for snapshot-based voting to prevent manipulation
    /// @param account: The account to query
    /// @param block_number: The block number to query at
    pub fn get_prior_votes(env: Env, account: Address, block_number: u64) -> u128 {
        let current_block = env.ledger().sequence() as u64;
        if block_number >= current_block {
            panic_with_error!(&env, GovernanceError::InvalidCheckpoint);
        }

        let num_checkpoints = Self::_num_checkpoints(&env, &account);
        if num_checkpoints == 0 {
            return 0;
        }

        // Binary search through checkpoints
        // First check most recent checkpoint
        let most_recent = Self::_get_checkpoint(&env, &account, num_checkpoints - 1);
        if most_recent.from_block <= block_number {
            return most_recent.votes;
        }

        // Check if before first checkpoint
        let first = Self::_get_checkpoint(&env, &account, 0);
        if first.from_block > block_number {
            return 0;
        }

        // Binary search
        let mut lower = 0u32;
        let mut upper = num_checkpoints - 1;
        while upper > lower {
            let center = upper - (upper - lower) / 2;
            let checkpoint = Self::_get_checkpoint(&env, &account, center);
            if checkpoint.from_block == block_number {
                return checkpoint.votes;
            } else if checkpoint.from_block < block_number {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        
        Self::_get_checkpoint(&env, &account, lower).votes
    }

    /// Get total token supply
    pub fn total_supply(env: Env) -> u128 {
        env.storage()
            .instance()
            .get(&symbol_short!("TOTAL"))
            .unwrap_or(0)
    }

    /// Get token name
    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&symbol_short!("NAME"))
            .unwrap_or(String::from_str(&env, "Governance Token"))
    }

    /// Get token symbol
    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&symbol_short!("SYMBOL"))
            .unwrap_or(String::from_str(&env, "GOV"))
    }

    /// Get token decimals
    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&symbol_short!("DECIMALS"))
            .unwrap_or(18)
    }

    // ========== INTERNAL HELPER FUNCTIONS ==========

    fn _get_balance(env: &Env, account: &Address) -> u128 {
        env.storage()
            .persistent()
            .get(&(symbol_short!("BALANCE"), account.clone()))
            .unwrap_or(0)
    }

    fn _delegates(env: &Env, account: &Address) -> Address {
        env.storage()
            .persistent()
            .get(&(symbol_short!("DELEGAT"), account.clone()))
            .unwrap_or(account.clone())
    }

    fn _num_checkpoints(env: &Env, account: &Address) -> u32 {
        env.storage()
            .persistent()
            .get(&(symbol_short!("NUMCHK"), account.clone()))
            .unwrap_or(0)
    }

    fn _get_checkpoint(env: &Env, account: &Address, index: u32) -> Checkpoint {
        env.storage()
            .persistent()
            .get(&(symbol_short!("CHKPT"), account.clone(), index))
            .unwrap()
    }

    /// Write a new checkpoint for an account
    /// @notice This uses Compound's checkpoint pattern for gas efficiency
    fn _write_checkpoint(env: &Env, account: &Address, new_votes: u128) {
        let current_block = env.ledger().sequence() as u64;
        let num_checkpoints = Self::_num_checkpoints(env, account);

        if num_checkpoints > 0 {
            let last_checkpoint = Self::_get_checkpoint(env, account, num_checkpoints - 1);
            
            // If the block is the same, just update the last checkpoint
            if last_checkpoint.from_block == current_block {
                env.storage().persistent().set(
                    &(symbol_short!("CHKPT"), account.clone(), num_checkpoints - 1),
                    &Checkpoint {
                        from_block: current_block,
                        votes: new_votes,
                    }
                );
                return;
            }
        }

        // Create new checkpoint
        env.storage().persistent().set(
            &(symbol_short!("CHKPT"), account.clone(), num_checkpoints),
            &Checkpoint {
                from_block: current_block,
                votes: new_votes,
            }
        );
        env.storage().persistent().set(&(symbol_short!("NUMCHK"), account.clone()), &(num_checkpoints + 1));
    }

    /// Move delegated votes between accounts
    /// @notice This is called on transfer and delegation changes
    fn _move_delegates(env: &Env, from: &Address, to: &Address, amount: u128) {
        if from != to && amount > 0 {
            // Decrease votes for source delegate
            let from_votes = Self::get_current_votes(env.clone(), from.clone());
            let new_from_votes = if from_votes >= amount { from_votes - amount } else { 0 };
            Self::_write_checkpoint(env, from, new_from_votes);
            
            // Emit DelegateVotesChanged event
            env.events().publish(
                (symbol_short!("DelVotes"), from.clone()),
                (from_votes, new_from_votes)
            );
            
            // Increase votes for destination delegate
            let to_votes = Self::get_current_votes(env.clone(), to.clone());
            let new_to_votes = to_votes.checked_add(amount).expect("Overflow in votes");
            Self::_write_checkpoint(env, to, new_to_votes);
            
            // Emit DelegateVotesChanged event
            env.events().publish(
                (symbol_short!("DelVotes"), to.clone()),
                (to_votes, new_to_votes)
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_initialize_and_balance() {
        let env = Env::default();
        let contract_id = env.register_contract(None, GovernanceToken);
        let client = GovernanceTokenClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let name = String::from_str(&env, "Governance Token");
        let symbol = String::from_str(&env, "GOV");
        let decimals = 18;
        let initial_supply = 1_000_000_000_000_000_000u128; // 1 billion with 18 decimals

        env.mock_all_auths();
        client.initialize(&admin, &name, &symbol, &decimals, &initial_supply);

        assert_eq!(client.balance_of(&admin), initial_supply);
        assert_eq!(client.total_supply(), initial_supply);
        assert_eq!(client.name(), name);
        assert_eq!(client.symbol(), symbol);
        assert_eq!(client.decimals(), decimals);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        let contract_id = env.register_contract(None, GovernanceToken);
        let client = GovernanceTokenClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let initial_supply = 1_000_000u128;

        env.mock_all_auths();
        client.initialize(
            &admin,
            &String::from_str(&env, "Gov"),
            &String::from_str(&env, "GOV"),
            &18,
            &initial_supply
        );

        let transfer_amount = 100_000u128;
        client.transfer(&admin, &user, &transfer_amount);

        assert_eq!(client.balance_of(&admin), initial_supply - transfer_amount);
        assert_eq!(client.balance_of(&user), transfer_amount);
    }

    #[test]
    fn test_delegation() {
        let env = Env::default();
        let contract_id = env.register_contract(None, GovernanceToken);
        let client = GovernanceTokenClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let delegatee = Address::generate(&env);
        let initial_supply = 1_000_000u128;

        env.mock_all_auths();
        client.initialize(
            &admin,
            &String::from_str(&env, "Gov"),
            &String::from_str(&env, "GOV"),
            &18,
            &initial_supply
        );

        // Initially, admin delegates to self
        assert_eq!(client.get_current_votes(&admin), initial_supply);
        assert_eq!(client.get_current_votes(&delegatee), 0);

        // Delegate to another address
        client.delegate(&admin, &delegatee);

        // Admin loses voting power, delegatee gains it
        assert_eq!(client.get_current_votes(&admin), 0);
        assert_eq!(client.get_current_votes(&delegatee), initial_supply);
    }

    #[test]
    fn test_checkpoints_and_prior_votes() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 100);
        
        let contract_id = env.register_contract(None, GovernanceToken);
        let client = GovernanceTokenClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let initial_supply = 1_000_000u128;

        env.mock_all_auths();
        client.initialize(
            &admin,
            &String::from_str(&env, "Gov"),
            &String::from_str(&env, "GOV"),
            &18,
            &initial_supply
        );

        let block_100_votes = client.get_current_votes(&admin);
        assert_eq!(block_100_votes, initial_supply);

        // Move to block 150
        env.ledger().with_mut(|li| li.sequence_number = 150);
        
        let user = Address::generate(&env);
        client.transfer(&admin, &user, &100_000u128);

        // Check historical voting power at block 100
        let prior_votes = client.get_prior_votes(&admin, &100);
        assert_eq!(prior_votes, initial_supply);

        // Current votes should be less
        let current_votes = client.get_current_votes(&admin);
        assert_eq!(current_votes, initial_supply - 100_000u128);
    }

    #[test]
    #[should_panic]
    fn test_transfer_insufficient_balance() {
        let env = Env::default();
        let contract_id = env.register_contract(None, GovernanceToken);
        let client = GovernanceTokenClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let initial_supply = 1_000u128;

        env.mock_all_auths();
        client.initialize(
            &admin,
            &String::from_str(&env, "Gov"),
            &String::from_str(&env, "GOV"),
            &18,
            &initial_supply
        );

        // Try to transfer more than balance
        client.transfer(&admin, &user, &2_000u128);
    }
}

