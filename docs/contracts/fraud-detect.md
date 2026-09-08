# Fraud Detection Contract Specification & Risk Flag Architecture

## 1. Overview

The `fraud-detect` Soroban contract provides a real-time risk assessment, transaction pattern analysis, and on-chain fraud flagging system for the Chenaikit ecosystem. It serves as the authoritative source of risk signals for downstream contracts such as `credit-score` and lending protocol integrations.

## 2. Core Data Models

### 2.1 RiskLevel Enum

Matches the `ModelResult` verdict shape, ordered monotonically by severity:

| Variant | Value | Meaning |
|---|---|---|
| `Low` | `1` | Clean record; normal operation. |
| `Medium` | `2` | Elevated risk indicators; manual review recommended. |
| `High` | `3` | Strong suspicion; strict validation or limit reduction. |
| `Critical` | `4` | Definite fraud / exploit activity; immediate freeze / rejection. |

### 2.2 RiskFlag Schema

Flags represent explicit risk findings submitted by authorized models or auditors:

```rust
pub struct RiskFlag {
    pub id: u64,
    pub subject: Address,
    pub risk_level: RiskLevel,
    pub reasons: Vec<Symbol>,
    pub evidence_hash: BytesN<32>,
    pub flagged_at: u64,
    pub flagged_by: Address,
    pub resolved: bool,
    pub resolution_note: Option<Symbol>,
}
```

## 3. Storage Layout & Efficiency

To prevent expensive iterations over historical records during mission-critical transactions:

1. **Monotonic Sequence Counter (`FLAG_SEQ_KEY`)**: Instance storage tracks `u64` sequence IDs, guaranteeing collision-free, deterministic flag IDs.
2. **Flag History Ring-Buffer (`FLAG_HISTORY_KEY(subject)`)**: Persistent storage maintains up to `MAX_FLAG_HISTORY_CAPACITY = 50` flags per subject. Eviction prioritizes dropping the oldest resolved flags when capacity is exceeded.
3. **Cached Effective Risk (`EFFECTIVE_RISK_KEY(subject)`)**: Persistent storage caches the calculated effective risk (maximum `risk_level` among active, unresolved flags). Evaluated at mutation time, allowing O(1) read access.
4. **Administrative Override (`OVERRIDE_RISK_KEY(subject)`)**: Persistent storage allows administrators to bypass model-driven assessments. Lookups evaluate override state before reading effective risk.

## 4. Writer Registry & Access Control

Multiple AI models, off-chain risk services, and security auditors can submit flags without sharing administrative private keys.

- `set_writer(admin, writer, authorized)`: Designates or revokes writer privileges. Requires administrator signature.
- `is_writer(writer)`: Queries writer status.
- `submit_flag`: Authorized for administrators and registered writers.
- `resolve_flag`: Authorized for administrators and registered writers.
- `override_status` / `remove_override`: Restricted strictly to administrators.

## 5. Contract Events

| Topic Symbol | Short Identifier | Emitted Data | Description |
|---|---|---|---|
| `Symbol::new(env, "flg_sub")` | `flg_sub` | `(subject, flag_id, risk_level, caller, evidence_hash)` | Emitted when a new risk flag is submitted. |
| `Symbol::new(env, "flg_res")` | `flg_res` | `(subject, flag_id, caller, resolution_note)` | Emitted when a risk flag is resolved. |
| `Symbol::new(env, "override")` | `override` | `(admin, subject, risk_level)` | Emitted when an administrative override is set. |

## 6. Architecture Decision Record (ADR): Cross-Contract Integration

### Context
Downstream financial contracts (such as `credit-score`) must evaluate fraud risk before permitting sensitive state modifications, such as issuing loans or updating credit scores. Two architectural patterns exist:
1. **Synchronous On-Chain Cross-Contract Queries**: Downstream contracts invoke `fraud-detect.get_current_risk(subject)` synchronously during their state-modifying calls.
2. **Off-Chain Orchestration**: Off-chain workers query both contracts, determine eligibility, and submit signed proofs or batched transactions.

### Decision & Tradeoff Analysis

| Metric | Pattern 1: Synchronous On-Chain | Pattern 2: Off-Chain Orchestration |
|---|---|---|
| **Atomicity** | Guaranteed. Zero time-of-check to time-of-use (TOCTOU) window. | Vulnerable to race conditions between verification and settlement. |
| **Gas / Footprint** | O(1) storage read via cached effective risk. Negligible footprint. | Extra gas for cryptographic proof verification. |
| **Composability** | Autonomous. Direct smart contract to smart contract interoperability. | Requires external relayer infrastructure and keeper maintenance. |
| **Failure Mode** | Downstream transaction reverts cleanly if subject has `Critical` risk. | Requires complex retry loops and rollback handling. |

### Recommendation
Chenaikit standardizes on **Pattern 1 (Synchronous On-Chain Cross-Contract Queries)** for high-stakes decisions:
- Downstream contracts store the address of the `fraud-detect` contract (`DataKey::FraudContract`).
- On state mutation (`record_score`, `update_score`), downstream contracts call `fraud_contract.get_current_risk(subject)`.
- If risk evaluates to `RiskLevel::Critical`, the transaction immediately aborts with `Error::FraudDetected`.
- The O(1) lookup design ensures that cross-contract overhead is bounded and predictable.
