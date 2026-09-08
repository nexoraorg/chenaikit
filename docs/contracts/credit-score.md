# Credit Score Contract: Specification & Integration Guide

## 1. Overview

The `credit-score` Soroban smart contract (`contracts/credit-score`) provides on-chain storage, history tracking, and validity verification for ML-derived credit scores. Privileged writes require administrator or explicit writer role authorization. Historical evaluations are maintained per subject in a bounded ring buffer, and scores expire after an administrator-configured ledger window.

---

## 2. Data Structures & Types

### 2.1 ScoreBand

```rust
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ScoreBand {
    Poor = 1,
    Fair = 2,
    Good = 3,
    Excellent = 4,
}
```

Numeric scores in the range `0..=1000` map to credit rating bands:

| Band | Numeric Range | Risk Profile |
|---|---|---|
| `Poor` | `0..=579` | High default probability; subprime |
| `Fair` | `580..=669` | Moderate default probability |
| `Good` | `670..=799` | Low default probability; prime |
| `Excellent` | `800..=1000` | Minimal default probability; super-prime |

### 2.2 ScoreRecord

```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScoreRecord {
    pub subject: Address,
    pub score: u32,
    pub band: ScoreBand,
    pub model_version: String,
    pub evidence_hash: BytesN<32>,
    pub computed_at: u64,
    pub expires_at: u64,
}
```

| Field | Type | Description |
|---|---|---|
| `subject` | `Address` | Stellar account evaluated. |
| `score` | `u32` | Normalized credit score (`0..=1000`). |
| `band` | `ScoreBand` | Derived credit band classification. |
| `model_version` | `String` | Semantic version string of the generating ML pipeline. |
| `evidence_hash` | `BytesN<32>` | SHA-256 digest of feature vector and inference evidence. |
| `computed_at` | `u64` | Ledger sequence when the score was written. |
| `expires_at` | `u64` | Ledger sequence after which the score is expired. |

### 2.3 Storage Keys

```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Score(Address),
    ScoreHistory(Address),
    ExpiryWindow,
    FraudContract,
}
```

Role keys (`Admin`, `Writer(Address)`) are stored via `common_utils::RoleRegistry` in instance storage.

### 2.4 Error Codes

```rust
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidScore = 4,
    SubjectNotFound = 5,
    WriterAlreadyAuthorized = 6,
    WriterNotAuthorized = 7,
    InvalidModelVersion = 8,
    InvalidExpiryWindow = 9,
    ScoreExpired = 10,
    FraudDetected = 11,
}
```

---

## 3. Storage Design & TTL Strategy

Storage operations adhere to Soroban state tiering rules:

| Tier | Key Type | Lifetime Management |
|---|---|---|
| **Instance Storage** | `Admin`, `Writer(Address)`, `ExpiryWindow`, `FraudContract` | Auto-extended during administrative writes and updates (`SCORE_LIFETIME_THRESHOLD = 30 days`, `SCORE_BUMP_AMOUNT = 90 days`). |
| **Persistent Storage** | `Score(Address)`, `ScoreHistory(Address)` | Explicitly extended via `extend_ttl` on every `submit_score` invocation. Prevents archival while maintaining active credit profiles. |

### Ring Buffer Invariant

Subject score history is stored under `DataKey::ScoreHistory(subject)` as a vector capped at `MAX_HISTORY_CAPACITY = 50`. When the vector reaches capacity, the oldest entry (`index 0`) is evicted prior to appending the new score.

---

## 4. Function Reference

### 4.1 Administrative Operations

#### `initialize(env: Env, admin: Address) -> Result<(), Error>`
- **Auth**: None (contract initialization phase).
- **Behavior**: Sets administrator in instance storage, assigns default expiry window (`100,000` ledgers), and emits `init` event. Fails with `AlreadyInitialized` if previously called.

#### `set_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), Error>`
- **Auth**: `admin.require_auth()`.
- **Behavior**: Verifies `admin` matches stored admin, updates to `new_admin`, and emits `admin_rot` event.

#### `get_admin(env: Env) -> Option<Address>`
- **Auth**: Public read.
- **Behavior**: Returns current admin address if initialized.

#### `set_writer(env: Env, admin: Address, writer: Address, authorized: bool) -> Result<(), Error>`
- **Auth**: `admin.require_auth()`.
- **Behavior**: Adds or removes score submission privilege for `writer`. Returns `WriterAlreadyAuthorized` if attempting to grant to an existing authorized writer.

#### `is_writer(env: Env, writer: Address) -> bool`
- **Auth**: Public read.
- **Behavior**: Returns `true` if `writer` is either the contract admin or explicitly authorized.

#### `set_expiry_window(env: Env, admin: Address, ledger_count: u64) -> Result<(), Error>`
- **Auth**: `admin.require_auth()`.
- **Behavior**: Updates the score freshness window. Rejects `0` with `InvalidExpiryWindow`.

#### `get_expiry_window(env: Env) -> u64`
- **Auth**: Public read.
- **Behavior**: Returns current expiry window in ledgers (defaults to `100,000`).

#### `set_fraud_contract(env: Env, admin: Address, fraud_contract: Address) -> Result<(), Error>`
- **Auth**: `admin.require_auth()`.
- **Behavior**: Configures companion fraud detection contract for cross-contract risk verification.

#### `get_fraud_contract(env: Env) -> Option<Address>`
- **Auth**: Public read.
- **Behavior**: Returns companion fraud detection contract address if configured.

---

### 4.2 Scoring Operations

#### `submit_score(env: Env, caller: Address, subject: Address, score: u32, model_version: String, evidence_hash: BytesN<32>) -> Result<ScoreRecord, Error>`
- **Auth**: `caller.require_auth()`.
- **Validation**:
  - Caller must be an authorized writer or admin.
  - `score <= 1000`.
  - `!model_version.is_empty()`.
  - If fraud contract configured, queries `get_current_risk(subject)`. Rejects with `FraudDetected` if risk is `RiskLevel::Critical`.
- **State Changes**:
  - Sets `Score(subject)` to new `ScoreRecord`.
  - Appends to `ScoreHistory(subject)` ring buffer (capped at 50).
  - Extends persistent TTL by 90 days.
  - Emits `score_submitted` event: `(Symbol("score_submitted"), subject), (subject, score, model_version)`.

#### `get_score(env: Env, subject: Address) -> Option<ScoreRecord>`
- **Auth**: Public read.
- **Behavior**: Returns latest `ScoreRecord` for `subject`, or `None` if never evaluated.

#### `get_score_history(env: Env, subject: Address, limit: u32) -> Vec<ScoreRecord>`
- **Auth**: Public read.
- **Behavior**: Returns up to `limit` historical evaluations, sliced to return the most recent entries.

#### `is_score_valid(env: Env, subject: Address) -> bool`
- **Auth**: Public read.
- **Behavior**: Returns `true` if score exists and `current_ledger_sequence <= record.expires_at`.

#### `validate_score(env: &Env, score: u32) -> Result<(), ErrorCategory>`
- **Auth**: Public helper.
- **Behavior**: Validates `score <= 1000`, returning `Ok(())` or `Err(ErrorCategory::Validation)`.

---

## 5. Expiration & Validity Semantics

Scores are computed with ledger-based validity:

$$\text{computed\_at} = \text{env.ledger().sequence()}$$
$$\text{expires\_at} = \text{computed\_at} + \text{expiry\_window}$$

A score is valid if and only if:

$$\text{env.ledger().sequence()} \le \text{expires\_at}$$

Consumer protocols must check `is_score_valid(subject)` or verify `expires_at` directly before relying on score data for credit underwriting.

---

## 6. Integration Examples

### 6.1 Submitting Score from ML Pipeline (TypeScript / Node.js)

```typescript
import { Contract, Keypair, Address, scValToNative, xdr } from "@stellar/stellar-sdk";

const creditScoreContract = new Contract(CREDIT_SCORE_CONTRACT_ID);
const writerKeypair = Keypair.fromSecret(WRITER_SECRET);

async function publishCreditScore(
  subjectAddress: string,
  numericScore: number,
  modelVersion: string,
  evidenceHashBytes: Buffer
) {
  const tx = await server.buildTransaction({
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  .addOperation(
    creditScoreContract.call(
      "submit_score",
      writerKeypair.publicKey(),
      subjectAddress,
      numericScore,
      modelVersion,
      evidenceHashBytes
    )
  )
  .setTimeout(30)
  .build();

  tx.sign(writerKeypair);
  const response = await server.sendTransaction(tx);
  return response;
}
```

### 6.2 Consuming Score in a Lending Contract (Rust / Soroban)

```rust
use soroban_sdk::{contractimpl, Address, Env, IntoVal};

mod credit_score {
    soroban_sdk::contractimport!(file = "../target/wasm32-unknown-unknown/release/credit_score.wasm");
}

pub struct LendingPool;

#[contractimpl]
impl LendingPool {
    pub fn evaluate_loan_application(
        env: Env,
        credit_contract_addr: Address,
        borrower: Address,
        loan_amount: i128,
    ) -> Result<bool, LendingError> {
        borrower.require_auth();

        let client = credit_score::Client::new(&env, &credit_contract_addr);

        if !client.is_score_valid(&borrower) {
            return Err(LendingError::ScoreExpiredOrMissing);
        }

        let record = client.get_score(&borrower).ok_or(LendingError::ScoreNotFound)?;

        if record.score < 670 {
            return Err(LendingError::InsufficientCreditScore);
        }

        Ok(true)
    }
}
```
