#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, IntoVal, String,
    Symbol, Val, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorizeModelArgs {
    pub contract: Address,
    pub model_id: Symbol,
    pub version: String,
    pub weights_hash: BytesN<32>,
    pub metadata_uri: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OracleWriterArgs {
    pub contract: Address,
    pub writer: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SlashNodeArgs {
    pub contract: Address,
    pub node: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChangeConfigArgs {
    pub contract: Address,
    pub parameter: Symbol,
    pub value: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomCallArgs {
    pub contract: Address,
    pub function: Symbol,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalAction {
    AuthorizeModel(AuthorizeModelArgs),
    AddOracleWriter(OracleWriterArgs),
    RemoveOracleWriter(OracleWriterArgs),
    SlashNode(SlashNodeArgs),
    ChangeConfig(ChangeConfigArgs),
    Custom(CustomCallArgs),
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProposalStatus {
    Active = 1,
    Defeated = 2,
    Succeeded = 3,
    Queued = 4,
    Executed = 5,
    Cancelled = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GovernanceConfig {
    pub voting_period_ledgers: u32,
    pub timelock_delay_ledgers: u32,
    pub quorum_votes: i128,
    pub proposal_threshold: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub action: ProposalAction,
    pub description: String,
    pub start_ledger: u32,
    pub end_ledger: u32,
    pub execution_ledger: u32,
    pub yes_votes: i128,
    pub no_votes: i128,
    pub executed: bool,
    pub cancelled: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Config,
    ProposalCount,
    Proposal(u64),
    Voted(u64, Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    NotFound = 4,
    AlreadyVoted = 5,
    VotingClosed = 6,
    VotingNotClosed = 7,
    QuorumNotMet = 8,
    ProposalDefeated = 9,
    TimelockNotElapsed = 10,
    AlreadyExecuted = 11,
    AlreadyCancelled = 12,
    InvalidProposal = 13,
    InvalidWeight = 14,
}

impl From<Error> for common_utils::ErrorCategory {
    fn from(err: Error) -> Self {
        match err {
            Error::Unauthorized => common_utils::ErrorCategory::Authorization,
            Error::NotFound => common_utils::ErrorCategory::NotFound,
            Error::AlreadyVoted
            | Error::VotingClosed
            | Error::VotingNotClosed
            | Error::QuorumNotMet
            | Error::ProposalDefeated
            | Error::TimelockNotElapsed
            | Error::AlreadyExecuted
            | Error::AlreadyCancelled
            | Error::InvalidProposal
            | Error::InvalidWeight
            | Error::AlreadyInitialized
            | Error::NotInitialized => common_utils::ErrorCategory::Validation,
        }
    }
}

#[contract]
pub struct GovernanceContract;

#[contractimpl]
impl GovernanceContract {
    /// Initialize the governance contract with explicit configuration parameters.
    pub fn initialize(
        env: Env,
        admin: Address,
        voting_period_ledgers: u32,
        timelock_delay_ledgers: u32,
        quorum_votes: i128,
        proposal_threshold: i128,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        let config = GovernanceConfig {
            voting_period_ledgers,
            timelock_delay_ledgers,
            quorum_votes,
            proposal_threshold,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);
        Ok(())
    }

    /// Convenience initialization helper with canonical default governance parameters.
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        Self::initialize(env, admin, 100, 20, 1_000, 1)
    }

    /// Update governance configuration. Admin only.
    pub fn set_config(env: Env, caller: Address, config: GovernanceConfig) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        if caller != admin {
            return Err(Error::Unauthorized);
        }
        caller.require_auth();
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    /// Retrieve active governance configuration.
    pub fn get_config(env: Env) -> Option<GovernanceConfig> {
        env.storage().instance().get(&DataKey::Config)
    }

    /// Retrieve admin address.
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    /// Retrieve total count of submitted proposals.
    pub fn get_proposal_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0)
    }

    /// Retrieve proposal details by proposal ID.
    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
    }

    /// Calculate and return the live status of a proposal.
    pub fn get_proposal_status(env: Env, proposal_id: u64) -> Result<ProposalStatus, Error> {
        let proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::NotFound)?;

        if proposal.cancelled {
            return Ok(ProposalStatus::Cancelled);
        }
        if proposal.executed {
            return Ok(ProposalStatus::Executed);
        }

        let config: GovernanceConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)?;

        let current_ledger = env.ledger().sequence();
        if current_ledger <= proposal.end_ledger {
            return Ok(ProposalStatus::Active);
        }

        let total_votes = proposal.yes_votes.saturating_add(proposal.no_votes);
        if total_votes < config.quorum_votes || proposal.yes_votes <= proposal.no_votes {
            return Ok(ProposalStatus::Defeated);
        }

        if current_ledger < proposal.execution_ledger {
            return Ok(ProposalStatus::Succeeded);
        }

        Ok(ProposalStatus::Queued)
    }

    /// Submit a new proposal with associated action and description.
    pub fn create_proposal(
        env: Env,
        proposer: Address,
        action: ProposalAction,
        description: String,
    ) -> Result<u64, Error> {
        proposer.require_auth();
        if description.is_empty() {
            return Err(Error::InvalidProposal);
        }
        let config: GovernanceConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)?;

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0);
        count = count.saturating_add(1);
        env.storage()
            .instance()
            .set(&DataKey::ProposalCount, &count);

        let start_ledger = env.ledger().sequence();
        let end_ledger = start_ledger.saturating_add(config.voting_period_ledgers);
        let execution_ledger = end_ledger.saturating_add(config.timelock_delay_ledgers);

        let proposal = Proposal {
            id: count,
            proposer: proposer.clone(),
            action,
            description,
            start_ledger,
            end_ledger,
            execution_ledger,
            yes_votes: 0,
            no_votes: 0,
            executed: false,
            cancelled: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(count), &proposal);
        env.events()
            .publish((soroban_sdk::symbol_short!("prop_new"), count), proposer);
        Ok(count)
    }

    /// Cast a vote on a proposal using support choice and voting weight.
    pub fn vote(
        env: Env,
        voter: Address,
        proposal_id: u64,
        support: bool,
        weight: i128,
    ) -> Result<(), Error> {
        voter.require_auth();
        if weight <= 0 {
            return Err(Error::InvalidWeight);
        }

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::NotFound)?;

        if proposal.cancelled {
            return Err(Error::AlreadyCancelled);
        }
        if proposal.executed {
            return Err(Error::AlreadyExecuted);
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger > proposal.end_ledger {
            return Err(Error::VotingClosed);
        }

        let vote_key = DataKey::Voted(proposal_id, voter.clone());
        if env.storage().persistent().has(&vote_key) {
            return Err(Error::AlreadyVoted);
        }
        env.storage().persistent().set(&vote_key, &true);

        if support {
            proposal.yes_votes = proposal.yes_votes.saturating_add(weight);
        } else {
            proposal.no_votes = proposal.no_votes.saturating_add(weight);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.events().publish(
            (soroban_sdk::symbol_short!("vote"), proposal_id, voter),
            (support, weight),
        );
        Ok(())
    }

    /// Execute a proposal after quorum, majority, and timelock requirements are met.
    pub fn execute(env: Env, caller: Address, proposal_id: u64) -> Result<(), Error> {
        caller.require_auth();

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::NotFound)?;

        if proposal.cancelled {
            return Err(Error::AlreadyCancelled);
        }
        if proposal.executed {
            return Err(Error::AlreadyExecuted);
        }

        let config: GovernanceConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)?;

        let current_ledger = env.ledger().sequence();
        if current_ledger <= proposal.end_ledger {
            return Err(Error::VotingNotClosed);
        }

        let total_votes = proposal.yes_votes.saturating_add(proposal.no_votes);
        if total_votes < config.quorum_votes {
            return Err(Error::QuorumNotMet);
        }
        if proposal.yes_votes <= proposal.no_votes {
            return Err(Error::ProposalDefeated);
        }

        if current_ledger < proposal.execution_ledger {
            return Err(Error::TimelockNotElapsed);
        }

        proposal.executed = true;
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        dispatch_action(&env, &proposal.action);

        env.events()
            .publish((soroban_sdk::symbol_short!("execute"), proposal_id), caller);
        Ok(())
    }

    /// Cancel a pending proposal. Proposer or admin only.
    pub fn cancel(env: Env, caller: Address, proposal_id: u64) -> Result<(), Error> {
        caller.require_auth();

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::NotFound)?;

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;

        if caller != proposal.proposer && caller != admin {
            return Err(Error::Unauthorized);
        }

        if proposal.executed {
            return Err(Error::AlreadyExecuted);
        }
        if proposal.cancelled {
            return Err(Error::AlreadyCancelled);
        }

        proposal.cancelled = true;
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.events()
            .publish((soroban_sdk::symbol_short!("cancel"), proposal_id), caller);
        Ok(())
    }
}

fn dispatch_action(env: &Env, action: &ProposalAction) {
    match action {
        ProposalAction::AuthorizeModel(args) => {
            let mut call_args: Vec<Val> = Vec::new(env);
            call_args.push_back(env.current_contract_address().into_val(env));
            call_args.push_back(args.model_id.into_val(env));
            call_args.push_back(args.version.into_val(env));
            call_args.push_back(args.weights_hash.into_val(env));
            call_args.push_back(args.metadata_uri.into_val(env));
            env.invoke_contract::<Val>(
                &args.contract,
                &Symbol::new(env, "attest_model"),
                call_args,
            );
        }
        ProposalAction::AddOracleWriter(args) => {
            let mut call_args: Vec<Val> = Vec::new(env);
            call_args.push_back(env.current_contract_address().into_val(env));
            call_args.push_back(args.writer.into_val(env));
            env.invoke_contract::<Val>(
                &args.contract,
                &Symbol::new(env, "register_source"),
                call_args,
            );
        }
        ProposalAction::RemoveOracleWriter(args) => {
            let mut call_args: Vec<Val> = Vec::new(env);
            call_args.push_back(env.current_contract_address().into_val(env));
            call_args.push_back(args.writer.into_val(env));
            env.invoke_contract::<Val>(
                &args.contract,
                &Symbol::new(env, "deregister_source"),
                call_args,
            );
        }
        ProposalAction::SlashNode(args) => {
            let mut call_args: Vec<Val> = Vec::new(env);
            call_args.push_back(env.current_contract_address().into_val(env));
            call_args.push_back(args.node.into_val(env));
            call_args.push_back(args.amount.into_val(env));
            env.invoke_contract::<Val>(&args.contract, &Symbol::new(env, "slash_node"), call_args);
        }
        ProposalAction::ChangeConfig(args) => {
            let func_name = if args.parameter == Symbol::new(env, "expiry_window")
                || args.parameter == soroban_sdk::symbol_short!("expiry")
            {
                Symbol::new(env, "set_expiry_window")
            } else {
                args.parameter.clone()
            };
            let mut call_args: Vec<Val> = Vec::new(env);
            call_args.push_back(env.current_contract_address().into_val(env));
            call_args.push_back(args.value.into_val(env));
            env.invoke_contract::<Val>(&args.contract, &func_name, call_args);
        }
        ProposalAction::Custom(args) => {
            env.invoke_contract::<Val>(&args.contract, &args.function, Vec::new(env));
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use credit_score::Contract as CreditScoreContract;
    use credit_score::ContractClient as CreditScoreClient;
    use model_attestation::AttestationStatus;
    use model_attestation::Contract as ModelAttestationContract;
    use model_attestation::ContractClient as ModelAttestationClient;
    use oracle_network::Contract as OracleNetworkContract;
    use oracle_network::ContractClient as OracleNetworkClient;
    use soroban_sdk::testutils::{Address as _, Ledger};

    fn setup_governance(env: &Env) -> (Address, GovernanceContractClient<'_>, GovernanceConfig) {
        let admin = Address::generate(env);
        let contract_id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(env, &contract_id);
        env.mock_all_auths();
        let config = GovernanceConfig {
            voting_period_ledgers: 50,
            timelock_delay_ledgers: 10,
            quorum_votes: 1_000,
            proposal_threshold: 1,
        };
        client.initialize(
            &admin,
            &config.voting_period_ledgers,
            &config.timelock_delay_ledgers,
            &config.quorum_votes,
            &config.proposal_threshold,
        );
        (admin, client, config)
    }

    #[test]
    fn test_end_to_end_model_attestation_via_governance() {
        let env = Env::default();
        let (admin, gov_client, _) = setup_governance(&env);
        let proposer = Address::generate(&env);
        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);

        let model_contract_id = env.register(ModelAttestationContract, ());
        let model_client = ModelAttestationClient::new(&env, &model_contract_id);
        model_client.initialize(&admin);
        model_client.set_governance(&admin, &gov_client.address);

        let model_id = Symbol::new(&env, "credit_nn_v1");
        let version = String::from_str(&env, "1.0.0");
        let weights_hash = BytesN::from_array(&env, &[42u8; 32]);
        let metadata_uri = String::from_str(&env, "ipfs://qm-test-weights");

        let action = ProposalAction::AuthorizeModel(AuthorizeModelArgs {
            contract: model_contract_id.clone(),
            model_id: model_id.clone(),
            version: version.clone(),
            weights_hash: weights_hash.clone(),
            metadata_uri: metadata_uri.clone(),
        });

        env.ledger().with_mut(|li| {
            li.sequence_number = 100;
        });

        let proposal_id = gov_client.create_proposal(
            &proposer,
            &action,
            &String::from_str(&env, "Attest credit neural network v1"),
        );
        assert_eq!(proposal_id, 1);
        assert_eq!(
            gov_client.get_proposal_status(&proposal_id),
            ProposalStatus::Active
        );

        gov_client.vote(&voter1, &proposal_id, &true, &700);
        gov_client.vote(&voter2, &proposal_id, &true, &500);

        env.ledger().with_mut(|li| {
            li.sequence_number = 151;
        });

        assert_eq!(
            gov_client.get_proposal_status(&proposal_id),
            ProposalStatus::Succeeded
        );

        assert_eq!(
            gov_client.try_execute(&admin, &proposal_id),
            Err(Ok(Error::TimelockNotElapsed))
        );

        env.ledger().with_mut(|li| {
            li.sequence_number = 161;
        });

        assert_eq!(
            gov_client.get_proposal_status(&proposal_id),
            ProposalStatus::Queued
        );

        gov_client.execute(&admin, &proposal_id);
        assert_eq!(
            gov_client.get_proposal_status(&proposal_id),
            ProposalStatus::Executed
        );

        let active_model = model_client.get_active_model(&model_id).unwrap();
        assert_eq!(active_model.version, version);
        assert_eq!(active_model.weights_hash, weights_hash);
        assert_eq!(active_model.status, AttestationStatus::Active);
        assert_eq!(active_model.attested_by, gov_client.address);
    }

    #[test]
    fn test_reject_double_voting() {
        let env = Env::default();
        let (_, gov_client, _) = setup_governance(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);

        let action = ProposalAction::Custom(CustomCallArgs {
            contract: Address::generate(&env),
            function: Symbol::new(&env, "ping"),
        });

        env.ledger().with_mut(|li| li.sequence_number = 100);
        let pid = gov_client.create_proposal(&proposer, &action, &String::from_str(&env, "Test"));

        gov_client.vote(&voter, &pid, &true, &500);
        assert_eq!(
            gov_client.try_vote(&voter, &pid, &true, &500),
            Err(Ok(Error::AlreadyVoted))
        );
    }

    #[test]
    fn test_reject_execution_below_quorum() {
        let env = Env::default();
        let (admin, gov_client, _) = setup_governance(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);

        let action = ProposalAction::Custom(CustomCallArgs {
            contract: Address::generate(&env),
            function: Symbol::new(&env, "ping"),
        });

        env.ledger().with_mut(|li| li.sequence_number = 100);
        let pid = gov_client.create_proposal(&proposer, &action, &String::from_str(&env, "Test"));

        gov_client.vote(&voter, &pid, &true, &500);

        env.ledger().with_mut(|li| li.sequence_number = 200);

        assert_eq!(
            gov_client.get_proposal_status(&pid),
            ProposalStatus::Defeated
        );
        assert_eq!(
            gov_client.try_execute(&admin, &pid),
            Err(Ok(Error::QuorumNotMet))
        );
    }

    #[test]
    fn test_reject_execution_when_defeated_by_majority() {
        let env = Env::default();
        let (admin, gov_client, _) = setup_governance(&env);
        let proposer = Address::generate(&env);
        let v1 = Address::generate(&env);
        let v2 = Address::generate(&env);

        let action = ProposalAction::Custom(CustomCallArgs {
            contract: Address::generate(&env),
            function: Symbol::new(&env, "ping"),
        });

        env.ledger().with_mut(|li| li.sequence_number = 100);
        let pid = gov_client.create_proposal(&proposer, &action, &String::from_str(&env, "Test"));

        gov_client.vote(&v1, &pid, &true, &400);
        gov_client.vote(&v2, &pid, &false, &700);

        env.ledger().with_mut(|li| li.sequence_number = 200);

        assert_eq!(
            gov_client.get_proposal_status(&pid),
            ProposalStatus::Defeated
        );
        assert_eq!(
            gov_client.try_execute(&admin, &pid),
            Err(Ok(Error::ProposalDefeated))
        );
    }

    #[test]
    fn test_reject_execution_while_voting_is_active() {
        let env = Env::default();
        let (admin, gov_client, _) = setup_governance(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);

        let action = ProposalAction::Custom(CustomCallArgs {
            contract: Address::generate(&env),
            function: Symbol::new(&env, "ping"),
        });

        env.ledger().with_mut(|li| li.sequence_number = 100);
        let pid = gov_client.create_proposal(&proposer, &action, &String::from_str(&env, "Test"));
        gov_client.vote(&voter, &pid, &true, &1_500);

        assert_eq!(
            gov_client.try_execute(&admin, &pid),
            Err(Ok(Error::VotingNotClosed))
        );
    }

    #[test]
    fn test_reject_voting_after_period_closed() {
        let env = Env::default();
        let (_, gov_client, _) = setup_governance(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);

        let action = ProposalAction::Custom(CustomCallArgs {
            contract: Address::generate(&env),
            function: Symbol::new(&env, "ping"),
        });

        env.ledger().with_mut(|li| li.sequence_number = 100);
        let pid = gov_client.create_proposal(&proposer, &action, &String::from_str(&env, "Test"));

        env.ledger().with_mut(|li| li.sequence_number = 160);
        assert_eq!(
            gov_client.try_vote(&voter, &pid, &true, &1_000),
            Err(Ok(Error::VotingClosed))
        );
    }

    #[test]
    fn test_cancel_proposal_lifecycle() {
        let env = Env::default();
        let (admin, gov_client, _) = setup_governance(&env);
        let proposer = Address::generate(&env);
        let stranger = Address::generate(&env);

        let action = ProposalAction::Custom(CustomCallArgs {
            contract: Address::generate(&env),
            function: Symbol::new(&env, "ping"),
        });

        env.ledger().with_mut(|li| li.sequence_number = 100);
        let pid = gov_client.create_proposal(&proposer, &action, &String::from_str(&env, "Test"));

        assert_eq!(
            gov_client.try_cancel(&stranger, &pid),
            Err(Ok(Error::Unauthorized))
        );

        gov_client.cancel(&proposer, &pid);
        assert_eq!(
            gov_client.get_proposal_status(&pid),
            ProposalStatus::Cancelled
        );

        assert_eq!(
            gov_client.try_execute(&admin, &pid),
            Err(Ok(Error::AlreadyCancelled))
        );
    }

    #[test]
    fn test_oracle_writer_management_and_slashing_via_governance() {
        let env = Env::default();
        let (admin, gov_client, _) = setup_governance(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);
        let writer = Address::generate(&env);

        let oracle_id = env.register(OracleNetworkContract, ());
        let oracle_client = OracleNetworkClient::new(&env, &oracle_id);
        oracle_client.initialize(&admin);
        oracle_client.set_governance(&admin, &gov_client.address);

        let add_action = ProposalAction::AddOracleWriter(OracleWriterArgs {
            contract: oracle_id.clone(),
            writer: writer.clone(),
        });

        env.ledger().with_mut(|li| li.sequence_number = 100);
        let pid1 = gov_client.create_proposal(
            &proposer,
            &add_action,
            &String::from_str(&env, "Add oracle writer"),
        );
        gov_client.vote(&voter, &pid1, &true, &1_200);

        env.ledger().with_mut(|li| li.sequence_number = 170);
        gov_client.execute(&admin, &pid1);

        assert!(oracle_client.is_registered(&writer));

        let slash_action = ProposalAction::SlashNode(SlashNodeArgs {
            contract: oracle_id.clone(),
            node: writer.clone(),
            amount: 250_000,
        });

        let pid2 = gov_client.create_proposal(
            &proposer,
            &slash_action,
            &String::from_str(&env, "Slash oracle node"),
        );
        gov_client.vote(&voter, &pid2, &true, &1_200);

        env.ledger().with_mut(|li| li.sequence_number = 240);
        gov_client.execute(&admin, &pid2);

        let remove_action = ProposalAction::RemoveOracleWriter(OracleWriterArgs {
            contract: oracle_id.clone(),
            writer: writer.clone(),
        });

        let pid3 = gov_client.create_proposal(
            &proposer,
            &remove_action,
            &String::from_str(&env, "Remove oracle writer"),
        );
        gov_client.vote(&voter, &pid3, &true, &1_200);

        env.ledger().with_mut(|li| li.sequence_number = 310);
        gov_client.execute(&admin, &pid3);

        assert!(!oracle_client.is_registered(&writer));
    }

    #[test]
    fn test_credit_score_config_change_via_governance() {
        let env = Env::default();
        let (admin, gov_client, _) = setup_governance(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);

        let credit_id = env.register(CreditScoreContract, ());
        let credit_client = CreditScoreClient::new(&env, &credit_id);
        credit_client.initialize(&gov_client.address);

        assert_eq!(credit_client.get_expiry_window(), 2_592_000);

        let action = ProposalAction::ChangeConfig(ChangeConfigArgs {
            contract: credit_id,
            parameter: Symbol::new(&env, "expiry_window"),
            value: 172_800,
        });

        env.ledger().with_mut(|li| li.sequence_number = 100);
        let pid = gov_client.create_proposal(
            &proposer,
            &action,
            &String::from_str(&env, "Change credit score expiry to 2 days"),
        );
        gov_client.vote(&voter, &pid, &true, &1_500);

        env.ledger().with_mut(|li| li.sequence_number = 170);
        gov_client.execute(&admin, &pid);

        assert_eq!(credit_client.get_expiry_window(), 172_800);
    }
}
