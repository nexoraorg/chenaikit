use soroban_sdk::{Address, Env};

pub trait CrossContractTrait {
    fn adjust_score_with_oracle(&self, env: Env, user: Address, oracle_contract: Address);
}