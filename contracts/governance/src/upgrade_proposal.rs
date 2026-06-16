#![allow(unused)]
use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, symbol_short, Address, BytesN, Env,
    String, Vec,
};

use crate::types::GovernanceError;

/// Upgrade proposal types
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum UpgradeType {
    ContractUpgrade = 0,  // Standard WASM upgrade
    StorageMigration = 1, // Data migration only
    Emergency = 2,        // Fast-track upgrade
}

/// Upgrade proposal structure
#[contracttype]
#[derive(Clone, Debug)]
pub struct UpgradeProposal {
    pub id: u64,
    pub upgrade_type: UpgradeType,
    pub target_contract: Address,
    pub new_wasm_hash: BytesN<32>,
    pub migration_data: Vec<String>, // Migration instructions
    pub proposer: Address,
    pub approvals: Vec<Address>,
    pub required_approvals: u32,
    pub executed: bool,
    pub created_at: u64,
    pub expires_at: u64,
    pub description: String,
}

/// Upgrade execution result
#[contracttype]
#[derive(Clone, Debug)]
pub struct UpgradeResult {
    pub success: bool,
    pub old_version: u32,
    pub new_version: u32,
    pub executed_at: u64,
    pub executor: Address,
}

/// Contract Upgrade Manager
/// @notice Manages contract upgrades with multi-sig approval and governance
#[contract]
pub struct UpgradeManager;

#[contractimpl]
impl UpgradeManager {
    /// Initialize the upgrade manager
    /// @param admin: Admin address
    /// @param required_approvals: Number of approvals needed for upgrade
    /// @param approval_timeout: Seconds before proposal expires
    pub fn initialize(
        env: Env,
        admin: Address,
        required_approvals: u32,
        approval_timeout: u64,
    ) {
        admin.require_auth();

        env.storage()
            .instance()
            .set(&symbol_short!("ADMIN"), &admin);
        env.storage()
            .instance()
            .set(&symbol_short!("REQ_APP"), &required_approvals);
        env.storage()
            .instance()
            .set(&symbol_short!("TIMEOUT"), &approval_timeout);
        env.storage()
            .instance()
            .set(&symbol_short!("UPG_CNT"), &0u64);
    }

    /// Create an upgrade proposal
    /// @param proposer: Address creating the proposal
    /// @param upgrade_type: Type of upgrade
    /// @param target_contract: Contract to upgrade
    /// @param new_wasm_hash: New WASM hash
    /// @param migration_data: Migration instructions
    /// @param description: Human-readable description
    /// @return proposal_id: Unique ID for the upgrade proposal
    pub fn propose_upgrade(
        env: Env,
        proposer: Address,
        upgrade_type: UpgradeType,
        target_contract: Address,
        new_wasm_hash: BytesN<32>,
        migration_data: Vec<String>,
        description: String,
    ) -> u64 {
        proposer.require_auth();

        // Only admin or authorized addresses can propose
        Self::_require_authorized(&env, &proposer);

        let proposal_id = Self::_next_upgrade_id(&env);
        let required_approvals: u32 = env
            .storage()
            .instance()
            .get(&symbol_short!("REQ_APP"))
            .unwrap();
        let timeout: u64 = env
            .storage()
            .instance()
            .get(&symbol_short!("TIMEOUT"))
            .unwrap();

        let current_time = env.ledger().timestamp();
        let expires_at = current_time + timeout;

        let proposal = UpgradeProposal {
            id: proposal_id,
            upgrade_type: upgrade_type.clone(),
            target_contract: target_contract.clone(),
            new_wasm_hash: new_wasm_hash.clone(),
            migration_data: migration_data.clone(),
            proposer: proposer.clone(),
            approvals: Vec::new(&env),
            required_approvals,
            executed: false,
            created_at: current_time,
            expires_at,
            description: description.clone(),
        };

        env.storage()
            .persistent()
            .set(&(symbol_short!("UPG"), proposal_id), &proposal);

        // Emit UpgradeProposed event
        env.events().publish(
            (symbol_short!("UpgProp"), proposal_id),
            (
                proposer,
                target_contract,
                new_wasm_hash,
                upgrade_type,
                description,
            ),
        );

        proposal_id
    }

    /// Approve an upgrade proposal
    /// @param proposal_id: The upgrade proposal ID
    /// @param approver: Address approving the upgrade
    pub fn approve_upgrade(env: Env, proposal_id: u64, approver: Address) {
        approver.require_auth();

        // Only authorized addresses can approve
        Self::_require_authorized(&env, &approver);

        let mut proposal = Self::_get_upgrade_proposal(&env, proposal_id);

        // Check not expired
        if env.ledger().timestamp() > proposal.expires_at {
            panic_with_error!(&env, GovernanceError::InvalidState);
        }

        // Check not already executed
        if proposal.executed {
            panic_with_error!(&env, GovernanceError::ProposalAlreadyExecuted);
        }

        // Check not already approved by this address
        for i in 0..proposal.approvals.len() {
            if proposal.approvals.get(i).unwrap() == approver {
                panic_with_error!(&env, GovernanceError::AlreadyVoted);
            }
        }

        // Add approval
        proposal.approvals.push_back(approver.clone());

        env.storage()
            .persistent()
            .set(&(symbol_short!("UPG"), proposal_id), &proposal);

        // Emit UpgradeApproved event
        env.events().publish(
            (symbol_short!("UpgAppr"), proposal_id),
            (approver, proposal.approvals.len()),
        );
    }

    /// Execute an approved upgrade
    /// @param proposal_id: The upgrade proposal ID
    /// @param executor: Address executing the upgrade
    /// @return UpgradeResult: Result of the upgrade execution
    pub fn execute_upgrade(env: Env, proposal_id: u64, executor: Address) -> UpgradeResult {
        executor.require_auth();

        let mut proposal = Self::_get_upgrade_proposal(&env, proposal_id);

        // Check has enough approvals
        if proposal.approvals.len() < proposal.required_approvals {
            panic_with_error!(&env, GovernanceError::QuorumNotReached);
        }

        // Check not expired
        if env.ledger().timestamp() > proposal.expires_at {
            panic_with_error!(&env, GovernanceError::InvalidState);
        }

        // Check not already executed
        if proposal.executed {
            panic_with_error!(&env, GovernanceError::ProposalAlreadyExecuted);
        }

        // Get current version (if stored)
        let old_version: u32 = env
            .storage()
            .persistent()
            .get(&(symbol_short!("VER"), proposal.target_contract.clone()))
            .unwrap_or(0);

        // Execute the upgrade based on type
        match proposal.upgrade_type {
            UpgradeType::ContractUpgrade => {
                Self::_execute_contract_upgrade(&env, &proposal);
            }
            UpgradeType::StorageMigration => {
                Self::_execute_storage_migration(&env, &proposal);
            }
            UpgradeType::Emergency => {
                Self::_execute_emergency_upgrade(&env, &proposal);
            }
        }

        // Mark as executed
        proposal.executed = true;
        env.storage()
            .persistent()
            .set(&(symbol_short!("UPG"), proposal_id), &proposal);

        let new_version = old_version + 1;
        env.storage().persistent().set(
            &(symbol_short!("VER"), proposal.target_contract.clone()),
            &new_version,
        );

        let result = UpgradeResult {
            success: true,
            old_version,
            new_version,
            executed_at: env.ledger().timestamp(),
            executor: executor.clone(),
        };

        // Store upgrade history
        env.storage().persistent().set(
            &(symbol_short!("UPGRES"), proposal_id),
            &result,
        );

        // Emit UpgradeExecuted event
        env.events().publish(
            (symbol_short!("UpgExec"), proposal_id),
            (executor, old_version, new_version),
        );

        result
    }

    /// Cancel an upgrade proposal
    /// @param proposal_id: The upgrade proposal ID
    /// @param canceller: Address cancelling (must be proposer or admin)
    pub fn cancel_upgrade(env: Env, proposal_id: u64, canceller: Address) {
        canceller.require_auth();

        let mut proposal = Self::_get_upgrade_proposal(&env, proposal_id);
        let admin = Self::_admin(&env);

        // Only proposer or admin can cancel
        if canceller != proposal.proposer && canceller != admin {
            panic_with_error!(&env, GovernanceError::Unauthorized);
        }

        // Cannot cancel if already executed
        if proposal.executed {
            panic_with_error!(&env, GovernanceError::ProposalAlreadyExecuted);
        }

        // Mark as expired (soft delete)
        proposal.expires_at = 0;

        env.storage()
            .persistent()
            .set(&(symbol_short!("UPG"), proposal_id), &proposal);

        // Emit UpgradeCancelled event
        env.events()
            .publish((symbol_short!("UpgCncl"), proposal_id), canceller);
    }

    /// Get upgrade proposal details
    pub fn get_upgrade_proposal(env: Env, proposal_id: u64) -> UpgradeProposal {
        Self::_get_upgrade_proposal(&env, proposal_id)
    }

    /// Get upgrade result
    pub fn get_upgrade_result(env: Env, proposal_id: u64) -> UpgradeResult {
        env.storage()
            .persistent()
            .get(&(symbol_short!("UPGRES"), proposal_id))
            .unwrap_or_else(|| {
                panic_with_error!(&env, GovernanceError::InvalidProposal)
            })
    }

    /// Get contract version
    pub fn get_contract_version(env: Env, contract: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&(symbol_short!("VER"), contract))
            .unwrap_or(0)
    }

    /// Get total upgrade proposals
    pub fn upgrade_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&symbol_short!("UPG_CNT"))
            .unwrap_or(0u64)
    }

    /// Add authorized upgrader
    pub fn add_authorized(env: Env, admin: Address, authorized: Address) {
        admin.require_auth();

        let stored_admin = Self::_admin(&env);
        if admin != stored_admin {
            panic_with_error!(&env, GovernanceError::Unauthorized);
        }

        let mut authorized_list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&symbol_short!("AUTH"))
            .unwrap_or(Vec::new(&env));

        authorized_list.push_back(authorized.clone());

        env.storage()
            .persistent()
            .set(&symbol_short!("AUTH"), &authorized_list);

        env.events()
            .publish((symbol_short!("AuthAdd"),), authorized);
    }

    /// Check if address is authorized
    pub fn is_authorized(env: Env, address: Address) -> bool {
        let admin = Self::_admin(&env);
        if address == admin {
            return true;
        }

        let authorized_list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&symbol_short!("AUTH"))
            .unwrap_or(Vec::new(&env));

        for i in 0..authorized_list.len() {
            if authorized_list.get(i).unwrap() == address {
                return true;
            }
        }

        false
    }

    // ========== INTERNAL HELPER FUNCTIONS ==========

    fn _admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("ADMIN"))
            .unwrap()
    }

    fn _require_authorized(env: &Env, address: &Address) {
        if !Self::is_authorized(env.clone(), address.clone()) {
            panic_with_error!(env, GovernanceError::Unauthorized);
        }
    }

    fn _get_upgrade_proposal(env: &Env, proposal_id: u64) -> UpgradeProposal {
        env.storage()
            .persistent()
            .get(&(symbol_short!("UPG"), proposal_id))
            .unwrap_or_else(|| {
                panic_with_error!(env, GovernanceError::InvalidProposal)
            })
    }

    fn _next_upgrade_id(env: &Env) -> u64 {
        let count: u64 = env
            .storage()
            .instance()
            .get(&symbol_short!("UPG_CNT"))
            .unwrap_or(0);
        let next_id = count + 1;
        env.storage()
            .instance()
            .set(&symbol_short!("UPG_CNT"), &next_id);
        next_id
    }

    fn _execute_contract_upgrade(env: &Env, proposal: &UpgradeProposal) {
        // Note: In production, this would call the target contract's upgrade function
        // For now, we emit an event indicating the upgrade should be performed
        env.events().publish(
            (symbol_short!("DoUpg"),),
            (
                proposal.target_contract.clone(),
                proposal.new_wasm_hash.clone(),
            ),
        );
    }

    fn _execute_storage_migration(env: &Env, proposal: &UpgradeProposal) {
        // Execute migration instructions
        env.events().publish(
            (symbol_short!("DoMigr"),),
            (
                proposal.target_contract.clone(),
                proposal.migration_data.clone(),
            ),
        );
    }

    fn _execute_emergency_upgrade(env: &Env, proposal: &UpgradeProposal) {
        // Emergency upgrade with minimal checks
        env.events().publish(
            (symbol_short!("DoEmerg"),),
            (
                proposal.target_contract.clone(),
                proposal.new_wasm_hash.clone(),
            ),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_upgrade_proposal_lifecycle() {
        let env = Env::default();
        env.ledger().with_mut(|li| {
            li.timestamp = 1000000;
        });

        let contract_id = env.register_contract(None, UpgradeManager);
        let client = UpgradeManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let approver1 = Address::generate(&env);
        let approver2 = Address::generate(&env);
        let target = Address::generate(&env);

        env.mock_all_auths();

        // Initialize with 2 required approvals, 7 day timeout
        client.initialize(&admin, &2, &604800);

        // Add authorized addresses
        client.add_authorized(&admin, &proposer);
        client.add_authorized(&admin, &approver1);
        client.add_authorized(&admin, &approver2);

        // Create upgrade proposal
        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let migration_data = Vec::new(&env);
        let description = String::from_str(&env, "Upgrade to v2");

        let proposal_id = client.propose_upgrade(
            &proposer,
            &UpgradeType::ContractUpgrade,
            &target,
            &wasm_hash,
            &migration_data,
            &description,
        );

        assert_eq!(proposal_id, 1);

        // Approve from two addresses
        client.approve_upgrade(&proposal_id, &approver1);
        client.approve_upgrade(&proposal_id, &approver2);

        // Execute upgrade
        let result = client.execute_upgrade(&proposal_id, &admin);

        assert!(result.success);
        assert_eq!(result.old_version, 0);
        assert_eq!(result.new_version, 1);

        // Check version updated
        assert_eq!(client.get_contract_version(&target), 1);
    }

    #[test]
    #[should_panic]
    fn test_cannot_execute_without_approvals() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeManager);
        let client = UpgradeManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let target = Address::generate(&env);

        env.mock_all_auths();

        client.initialize(&admin, &2, &604800);
        client.add_authorized(&admin, &proposer);

        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let proposal_id = client.propose_upgrade(
            &proposer,
            &UpgradeType::ContractUpgrade,
            &target,
            &wasm_hash,
            &Vec::new(&env),
            &String::from_str(&env, "Test"),
        );

        // Try to execute without approvals - should panic
        client.execute_upgrade(&proposal_id, &admin);
    }
}
