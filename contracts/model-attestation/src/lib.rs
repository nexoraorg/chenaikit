#![no_std]
//! model-attestation — on-chain attestation surface for model artifacts.
//!
//! Scaffolded fresh per issue #286; port real logic in from the old contracts/ tree.
//!
//! # Compatible provenance fields
//!
//! Off-chain, a model artifact carries a `ProvenanceMetadata` record produced by
//! the `@chenaikit/chenai-mlflow` package (`packages/chenai-mlflow/src/index.ts`)
//! and documented in `ml/README.md`. This contract documents which fields of
//! that record an attestation can carry, so producers know what an on-chain
//! attestation will and will not commit to.
//!
//! Provenance **format version 1** — the version this contract is written
//! against — requires all six fields below. They are exposed on-chain by
//! [`Contract::provenance_fields`], in the same canonical order used by the
//! TypeScript `REQUIRED_PROVENANCE_FIELDS` constant and by the serialized JSON
//! payload:
//!
//! | Field              | Off-chain type      | Meaning                                                            |
//! |--------------------|---------------------|--------------------------------------------------------------------|
//! | `formatVersion`    | integer             | Provenance format version; `1` is the version documented here.       |
//! | `sourceRevision`   | string              | Git commit SHA the artifact was built from.                          |
//! | `sourceRepository` | string              | URL of the repository holding that revision.                         |
//! | `dependencies`     | ordered `{name, version}` list | Resolved build dependencies; order is significant.        |
//! | `configurationId`  | string              | Identifier/hash of the training or build configuration.              |
//! | `createdAt`        | ISO 8601 string     | Artifact creation timestamp, with an explicit UTC offset.            |
//!
//! Attestation payloads should commit to `dependencies` by hash rather than
//! storing the list verbatim: the list is unbounded, while the other five
//! fields are fixed-size. Producers must not attest to an artifact whose
//! provenance is incomplete — `@chenaikit/chenai-mlflow` refuses to serialize
//! such a record, and the same rule applies here.
//!
//! When [`PROVENANCE_FORMAT_VERSION`] and the TypeScript
//! `PROVENANCE_FORMAT_VERSION` diverge, the two sides are no longer describing
//! the same record and must be reconciled before attestations are trusted.

use soroban_sdk::{contract, contractimpl, Env, Symbol, Vec};

/// Provenance format version this contract documents and is compatible with.
///
/// Mirrors `PROVENANCE_FORMAT_VERSION` in `packages/chenai-mlflow/src/index.ts`.
pub const PROVENANCE_FORMAT_VERSION: u32 = 1;

/// Required provenance fields of format version 1, in canonical order.
///
/// Kept in sync with `REQUIRED_PROVENANCE_FIELDS` in
/// `packages/chenai-mlflow/src/index.ts`; the names are the JSON keys of the
/// serialized provenance payload.
pub const PROVENANCE_FIELDS: [&str; 6] = [
    "formatVersion",
    "sourceRevision",
    "sourceRepository",
    "dependencies",
    "configurationId",
    "createdAt",
];

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn ping(_env: Env) -> bool {
        true
    }

    /// Provenance format version this contract is compatible with.
    ///
    /// Callers should compare this against the `formatVersion` of the artifact
    /// provenance they hold and refuse to attest on a mismatch.
    pub fn provenance_format_version(_env: Env) -> u32 {
        PROVENANCE_FORMAT_VERSION
    }

    /// Provenance fields an attestation for this contract can carry, in the
    /// canonical order documented at the module level and used by
    /// `@chenaikit/chenai-mlflow`.
    pub fn provenance_fields(env: Env) -> Vec<Symbol> {
        let mut fields = Vec::new(&env);
        for name in PROVENANCE_FIELDS {
            fields.push_back(Symbol::new(&env, name));
        }
        fields
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{vec, Env};

    #[test]
    fn test_ping() {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(&env, &contract_id);
        assert!(client.ping());
    }

    #[test]
    fn test_provenance_format_version() {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(&env, &contract_id);
        assert_eq!(client.provenance_format_version(), 1);
        assert_eq!(
            client.provenance_format_version(),
            PROVENANCE_FORMAT_VERSION
        );
    }

    #[test]
    fn test_provenance_fields_match_documented_format() {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(&env, &contract_id);

        let expected = vec![
            &env,
            Symbol::new(&env, "formatVersion"),
            Symbol::new(&env, "sourceRevision"),
            Symbol::new(&env, "sourceRepository"),
            Symbol::new(&env, "dependencies"),
            Symbol::new(&env, "configurationId"),
            Symbol::new(&env, "createdAt"),
        ];

        assert_eq!(client.provenance_fields(), expected);
    }

    #[test]
    fn test_provenance_fields_constant_is_the_source_of_truth() {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        let client = ContractClient::new(&env, &contract_id);

        let fields = client.provenance_fields();
        assert_eq!(fields.len() as usize, PROVENANCE_FIELDS.len());
        for (index, name) in PROVENANCE_FIELDS.iter().enumerate() {
            assert_eq!(fields.get_unchecked(index as u32), Symbol::new(&env, name));
        }
    }
}
