#![no_std]
//! credit-score — stores subject credit scores behind explicit authorization.
//!
//! Privileged writes require admin or authorized writer roles.
//! Maintains historical score entries in a bounded ring buffer and enforces freshness expiry windows.

use common_utils::{ErrorCategory, RiskLevel, RoleRegistry};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env,
    String, Symbol, Vec,
};

/// Key definitions for persistent and instance storage.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Score(Address),
    ScoreHistory(Address),
    ExpiryWindow,
    FraudContract,
}

/// Credit score rating bands mapping to creditworthiness ranges.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ScoreBand {
    /// Score 0..=579: subprime credit profile.
    Poor = 1,
    /// Score 580..=669: fair credit profile.
    Fair = 2,
    /// Score 670..=799: good credit profile.
    Good = 3,
    /// Score 800..=1000: exceptional credit profile.
    Excellent = 4,
}

pub type Band = ScoreBand;

impl ScoreBand {
    /// Categorizes a numeric credit score into its corresponding rating band.
    pub fn from_score(score: u32) -> Self {
        if score < 580 {
            ScoreBand::Poor
        } else if score < 670 {
            ScoreBand::Fair
        } else if score < 800 {
            ScoreBand::Good
        } else {
            ScoreBand::Excellent
        }
    }
}

/// Authoritative credit score record for a subject account.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScoreRecord {
    /// The subject account whose credit score was evaluated.
    pub subject: Address,
    /// Numeric score scaled between 0 and 1000 inclusive.
    pub score: u32,
    /// Rating band category derived from the numeric score.
    pub band: ScoreBand,
    /// Version identifier of the AI/ML model generating this score.
    pub model_version: String,
    /// 32-byte hash of the inference evidence, inputs, or attestation.
    pub evidence_hash: BytesN<32>,
    /// Ledger sequence at which the score was computed and recorded.
    pub computed_at: u64,
    /// Ledger sequence at which the score is considered expired and stale.
    pub expires_at: u64,
}

/// Contract error codes.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// 1 — Contract has not been initialized.
    NotInitialized = 1,
    /// 2 — Contract is already initialized.
    AlreadyInitialized = 2,
    /// 3 — Caller lacks authorization for privileged action.
    Unauthorized = 3,
    /// 4 — Provided score is outside the valid range of 0..=1000.
    InvalidScore = 4,
    /// 5 — Subject account was not found in storage.
    SubjectNotFound = 5,
    /// 6 — Writer is already authorized.
    WriterAlreadyAuthorized = 6,
    /// 7 — Writer is not authorized.
    WriterNotAuthorized = 7,
    /// 8 — Provided model version string is empty or invalid.
    InvalidModelVersion = 8,
    /// 9 — Provided expiry window is invalid (must be greater than zero).
    InvalidExpiryWindow = 9,
    /// 10 — Requested score record is expired.
    ScoreExpired = 10,
    /// 11 — Subject flagged with critical fraud risk; scoring blocked.
    FraudDetected = 11,
}

/// Number of ledgers in 24 hours assuming 5-second ledger closes.
pub const DAY_IN_LEDGERS: u32 = 17_280;
/// Minimum threshold before extending persistent TTL (30 days).
pub const SCORE_LIFETIME_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
/// TTL extension duration (90 days).
pub const SCORE_BUMP_AMOUNT: u32 = 90 * DAY_IN_LEDGERS;
/// Maximum number of historical score entries maintained in ring buffer.
pub const MAX_HISTORY_CAPACITY: u32 = 50;
/// Default freshness window in ledgers (~5.8 days).
pub const DEFAULT_EXPIRY_WINDOW: u64 = 100_000;
/// Maximum allowable score inclusive.
pub const MAX_SCORE: u32 = 1000;

#[contract]
pub struct Contract;

pub type CreditScoreContract = Contract;

#[contractimpl]
impl Contract {
    /// Initializes contract state and sets the primary administrator.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if RoleRegistry::get_admin(&env).is_some() {
            return Err(Error::AlreadyInitialized);
        }
        RoleRegistry::set_admin(&env, &admin);
        env.storage()
            .instance()
            .set(&DataKey::ExpiryWindow, &DEFAULT_EXPIRY_WINDOW);
        env.storage()
            .instance()
            .extend_ttl(SCORE_LIFETIME_THRESHOLD, SCORE_BUMP_AMOUNT);

        env.events().publish(
            (symbol_short!("init"), admin.clone()),
            admin,
        );
        Ok(())
    }

    /// Admin-only: rotates contract administrator to a new address.
    pub fn set_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), Error> {
        RoleRegistry::require_admin(&env, &admin).map_err(|_| Error::Unauthorized)?;
        RoleRegistry::set_admin(&env, &new_admin);
        env.storage()
            .instance()
            .extend_ttl(SCORE_LIFETIME_THRESHOLD, SCORE_BUMP_AMOUNT);

        env.events().publish(
            (symbol_short!("admin_rot"), admin),
            new_admin,
        );
        Ok(())
    }

    /// Retrieves current contract administrator address if initialized.
    pub fn get_admin(env: Env) -> Option<Address> {
        RoleRegistry::get_admin(&env)
    }

    /// Admin-only: authorizes or revokes score writer privileges for an account.
    pub fn set_writer(
        env: Env,
        admin: Address,
        writer: Address,
        authorized: bool,
    ) -> Result<(), Error> {
        RoleRegistry::require_admin(&env, &admin).map_err(|_| Error::Unauthorized)?;

        if authorized {
            if RoleRegistry::is_writer(&env, &writer) {
                return Err(Error::WriterAlreadyAuthorized);
            }
            RoleRegistry::set_writer(&env, &writer, true);
        } else {
            RoleRegistry::set_writer(&env, &writer, false);
        }

        env.storage()
            .instance()
            .extend_ttl(SCORE_LIFETIME_THRESHOLD, SCORE_BUMP_AMOUNT);

        env.events().publish(
            (symbol_short!("writer_st"), writer.clone()),
            (admin, writer, authorized),
        );
        Ok(())
    }

    /// Checks if a given address is an authorized score writer or contract admin.
    pub fn is_writer(env: Env, writer: Address) -> bool {
        RoleRegistry::is_writer(&env, &writer) || RoleRegistry::is_admin(&env, &writer)
    }

    /// Admin-only: updates the score freshness expiry window measured in ledgers.
    pub fn set_expiry_window(
        env: Env,
        admin: Address,
        ledger_count: u64,
    ) -> Result<(), Error> {
        RoleRegistry::require_admin(&env, &admin).map_err(|_| Error::Unauthorized)?;

        if ledger_count == 0 {
            return Err(Error::InvalidExpiryWindow);
        }

        env.storage()
            .instance()
            .set(&DataKey::ExpiryWindow, &ledger_count);
        env.storage()
            .instance()
            .extend_ttl(SCORE_LIFETIME_THRESHOLD, SCORE_BUMP_AMOUNT);

        env.events().publish(
            (symbol_short!("exp_win"), admin),
            ledger_count,
        );
        Ok(())
    }

    /// Retrieves the current score freshness expiry window in ledgers.
    pub fn get_expiry_window(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::ExpiryWindow)
            .unwrap_or(DEFAULT_EXPIRY_WINDOW)
    }

    /// Admin-only: configures optional fraud detection contract address for cross-contract checks.
    pub fn set_fraud_contract(
        env: Env,
        admin: Address,
        fraud_contract: Address,
    ) -> Result<(), Error> {
        RoleRegistry::require_admin(&env, &admin).map_err(|_| Error::Unauthorized)?;

        env.storage()
            .instance()
            .set(&DataKey::FraudContract, &fraud_contract);
        env.storage()
            .instance()
            .extend_ttl(SCORE_LIFETIME_THRESHOLD, SCORE_BUMP_AMOUNT);
        Ok(())
    }

    /// Retrieves the configured fraud detection contract address if set.
    pub fn get_fraud_contract(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::FraudContract)
    }

    /// Submits a credit evaluation score for a subject account.
    pub fn submit_score(
        env: Env,
        caller: Address,
        subject: Address,
        score: u32,
        model_version: String,
        evidence_hash: BytesN<32>,
    ) -> Result<ScoreRecord, Error> {
        caller.require_auth();

        if RoleRegistry::get_admin(&env).is_none() {
            return Err(Error::NotInitialized);
        }

        if !Self::is_writer(env.clone(), caller.clone()) {
            return Err(Error::Unauthorized);
        }

        if score > MAX_SCORE {
            return Err(Error::InvalidScore);
        }

        if model_version.is_empty() {
            return Err(Error::InvalidModelVersion);
        }

        if let Some(fraud_addr) = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::FraudContract)
        {
            let risk = env.invoke_contract::<RiskLevel>(
                &fraud_addr,
                &Symbol::new(&env, "get_current_risk"),
                vec![&env, subject.to_val()],
            );
            if risk == RiskLevel::Critical {
                return Err(Error::FraudDetected);
            }
        }

        let computed_at = env.ledger().sequence() as u64;
        let expiry_window = Self::get_expiry_window(env.clone());
        let expires_at = computed_at.saturating_add(expiry_window);
        let band = ScoreBand::from_score(score);

        let record = ScoreRecord {
            subject: subject.clone(),
            score,
            band,
            model_version: model_version.clone(),
            evidence_hash: evidence_hash.clone(),
            computed_at,
            expires_at,
        };

        let score_key = DataKey::Score(subject.clone());
        env.storage().persistent().set(&score_key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&score_key, SCORE_LIFETIME_THRESHOLD, SCORE_BUMP_AMOUNT);

        let history_key = DataKey::ScoreHistory(subject.clone());
        let mut history: Vec<ScoreRecord> = env
            .storage()
            .persistent()
            .get(&history_key)
            .unwrap_or_else(|| Vec::new(&env));

        if history.len() >= MAX_HISTORY_CAPACITY {
            history.remove(0);
        }
        history.push_back(record.clone());

        env.storage().persistent().set(&history_key, &history);
        env.storage().persistent().extend_ttl(
            &history_key,
            SCORE_LIFETIME_THRESHOLD,
            SCORE_BUMP_AMOUNT,
        );

        env.events().publish(
            (Symbol::new(&env, "score_submitted"), subject.clone()),
            (subject, score, model_version),
        );

        Ok(record)
    }

    /// Retrieves the current score record for a subject account.
    pub fn get_score(env: Env, subject: Address) -> Option<ScoreRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Score(subject))
    }

    /// Retrieves up to `limit` historical score records for a subject, returning most recent entries.
    pub fn get_score_history(env: Env, subject: Address, limit: u32) -> Vec<ScoreRecord> {
        let history: Vec<ScoreRecord> = env
            .storage()
            .persistent()
            .get(&DataKey::ScoreHistory(subject))
            .unwrap_or_else(|| Vec::new(&env));

        if limit == 0 {
            return Vec::new(&env);
        }

        if history.len() <= limit {
            return history;
        }

        let mut sliced = Vec::new(&env);
        let start_idx = history.len() - limit;
        for i in start_idx..history.len() {
            if let Some(item) = history.get(i) {
                sliced.push_back(item);
            }
        }
        sliced
    }

    /// Checks if a subject has a non-expired credit score record based on current ledger sequence.
    pub fn is_score_valid(env: Env, subject: Address) -> bool {
        if let Some(record) = Self::get_score(env.clone(), subject) {
            (env.ledger().sequence() as u64) <= record.expires_at
        } else {
            false
        }
    }

    /// Validates numeric credit score range.
    pub fn validate_score(_env: &Env, score: u32) -> Result<(), ErrorCategory> {
        if score <= MAX_SCORE {
            Ok(())
        } else {
            Err(ErrorCategory::Validation)
        }
    }
}

#[cfg(test)]
mod test;
