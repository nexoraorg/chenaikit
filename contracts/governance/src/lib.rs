#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub description: String,
    pub start_time: u64,
    pub end_time: u64,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub finalized: bool,
}

#[contract]
pub struct GovernanceContract;

#[contracttype]
pub enum DataKey {
    Proposal(u64),
    ProposalCount,
    Vote(u64, Address),
    Voter(Address),
    Admin,
}

#[contractimpl]
impl GovernanceContract {
    pub fn init(env: Env, admin: Address) {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);
    }

    pub fn add_voter(env: Env, admin: Address, voter: Address) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("only admin can add voters");
        }
        env.storage()
            .persistent()
            .set(&DataKey::Voter(voter), &true);
    }

    pub fn create_proposal(env: Env, proposer: Address, description: String, end_time: u64) -> u64 {
        proposer.require_auth();

        if description.len() == 0 {
            panic!("invalid proposal: description cannot be empty");
        }

        let start_time = env.ledger().timestamp();
        if end_time <= start_time {
            panic!("invalid proposal: end_time must be in the future");
        }

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0);
        count += 1;
        env.storage()
            .instance()
            .set(&DataKey::ProposalCount, &count);

        let proposal = Proposal {
            id: count,
            proposer,
            description,
            start_time,
            end_time,
            yes_votes: 0,
            no_votes: 0,
            finalized: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(count), &proposal);
        count
    }

    pub fn vote(env: Env, voter: Address, proposal_id: u64, vote_yes: bool) {
        voter.require_auth();

        if !env
            .storage()
            .persistent()
            .has(&DataKey::Voter(voter.clone()))
        {
            panic!("unauthorized vote: voter not eligible");
        }

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .unwrap();

        let current_time = env.ledger().timestamp();
        if current_time >= proposal.end_time {
            panic!("voting is closed");
        }

        let vote_key = DataKey::Vote(proposal_id, voter.clone());
        if env.storage().persistent().has(&vote_key) {
            panic!("duplicate vote: already voted");
        }
        env.storage().persistent().set(&vote_key, &true);

        if vote_yes {
            proposal.yes_votes += 1;
        } else {
            proposal.no_votes += 1;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
    }

    pub fn finalize(env: Env, caller: Address, proposal_id: u64) {
        caller.require_auth();

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .unwrap();

        let current_time = env.ledger().timestamp();
        if current_time < proposal.end_time {
            panic!("cannot finalize before end_time");
        }

        if proposal.finalized {
            panic!("already finalized");
        }

        proposal.finalized = true;
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Env,
    };

    #[test]
    fn test_governance_flow() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);
        let proposer = Address::generate(&env);

        let contract_id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &contract_id);

        env.mock_all_auths();

        env.ledger().with_mut(|li| {
            li.timestamp = 1000;
        });

        client.init(&admin);
        client.add_voter(&admin, &voter1);
        client.add_voter(&admin, &voter2);

        let description = String::from_str(&env, "Prop 1");
        let proposal_id = client.create_proposal(&proposer, &description, &2000);
        assert_eq!(proposal_id, 1);

        client.vote(&voter1, &1, &true);
        client.vote(&voter2, &1, &false);

        env.ledger().with_mut(|li| {
            li.timestamp = 2001;
        });

        client.finalize(&admin, &1);
    }

    #[test]
    #[should_panic(expected = "invalid proposal: description cannot be empty")]
    fn test_invalid_proposal_empty_description() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let contract_id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &contract_id);
        env.mock_all_auths();
        client.init(&admin);
        env.ledger().with_mut(|li| li.timestamp = 1000);
        client.create_proposal(&proposer, &String::from_str(&env, ""), &2000);
    }

    #[test]
    #[should_panic(expected = "invalid proposal: end_time must be in the future")]
    fn test_invalid_proposal_past_end_time() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let contract_id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &contract_id);
        env.mock_all_auths();
        client.init(&admin);
        env.ledger().with_mut(|li| li.timestamp = 1000);
        client.create_proposal(&proposer, &String::from_str(&env, "Prop"), &999);
    }

    #[test]
    #[should_panic(expected = "unauthorized vote: voter not eligible")]
    fn test_unauthorized_vote() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);
        let contract_id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &contract_id);
        env.mock_all_auths();
        client.init(&admin);
        env.ledger().with_mut(|li| li.timestamp = 1000);
        let pid = client.create_proposal(&proposer, &String::from_str(&env, "Prop"), &2000);
        client.vote(&voter, &pid, &true);
    }

    #[test]
    #[should_panic(expected = "duplicate vote: already voted")]
    fn test_duplicate_vote() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);
        let contract_id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &contract_id);
        env.mock_all_auths();
        client.init(&admin);
        client.add_voter(&admin, &voter);
        env.ledger().with_mut(|li| li.timestamp = 1000);
        let pid = client.create_proposal(&proposer, &String::from_str(&env, "Prop"), &2000);
        client.vote(&voter, &pid, &true);
        client.vote(&voter, &pid, &false);
    }

    #[test]
    #[should_panic(expected = "cannot finalize before end_time")]
    fn test_finalize_before_window() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let contract_id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &contract_id);
        env.mock_all_auths();
        client.init(&admin);
        env.ledger().with_mut(|li| li.timestamp = 1000);
        let pid = client.create_proposal(&proposer, &String::from_str(&env, "Prop"), &2000);
        client.finalize(&admin, &pid);
    }
}
