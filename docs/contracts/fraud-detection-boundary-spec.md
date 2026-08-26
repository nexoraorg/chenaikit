# Fraud Detection Contract: Boundary Specification & Threat Model

## Executive Summary

Smart contract decision logic operating on Stellar/Soroban relies on caller-supplied transaction parameters (amounts, address counterparties, timestamps, transaction classifications) and admin-configured thresholds. This document formalizes the boundary envelopes, arithmetic safety invariants, and rejection semantics enforced by the `fraud-detect` Soroban contract.

---

## 1. Threat Model & Abuse Scenarios

### 1.1 Integer Overflows and Underflows
- **Threat**: Callers pass extreme values (`i128::MAX`, `i128::MIN`, negative amounts) aiming to trigger silent arithmetic wraparounds, corrupting internal variance or risk aggregations.
- **Mitigation**:
  - `validate_amount` strictly mandates `1 <= amount <= MAX_VALID_AMOUNT` (`10^26`).
  - All internal arithmetic operations utilize `saturating_add`, `saturating_sub`, `saturating_mul`, and `checked_div`.
  - Negative values trigger an explicit `InvalidAmount` error code.

### 1.2 Resource Exhaustion via Unbounded Memory
- **Threat**: Attackers supply arbitrarily long strings for `transaction_type` or deluge the contract with calls to bloat persistent storage vectors.
- **Mitigation**:
  - `transaction_type` is bounded by `MAX_TX_TYPE_LEN = 64` bytes.
  - History per user is stored as a ring-buffer capped at `MAX_HISTORY_CAPACITY = 1000` items, evicting the oldest element on capacity.

### 1.3 State Manipulation via Rejected Inputs
- **Threat**: Malformed calls modifying contract state before validation (partial state commit attacks).
- **Mitigation**:
  - All validations occur at the very entrance of each function before any storage reads/writes.
  - When an error is returned or thrown, no state is persisted or advanced.

### 1.4 Unauthorized Upgrades and Rollback Exploitation
- **Threat**: Callers other than the designated administrator attempting contract code migration or triggering uninitialized rollbacks.
- **Mitigation**:
  - `require_admin` enforces `admin.require_auth()` and strictly checks against instance storage `ADMIN_KEY`.
  - Rollback requires a previously committed `ROLLBACK_HASH_KEY`.

---

## 2. Complete Input Bounds Matrix

| Identifier | Rust Type | Min Boundary | Max Boundary | Error on Rejection |
|---|---|---|---|---|
| `amount` | `i128` | `1` | `100_000_000_000_000_000_000_000_000` | `ContractError::InvalidAmount` (4) |
| `transaction_type` | `String` | `1` | `64` | `ContractError::EmptyString` (8) / `ContractError::StringTooLong` (9) |
| `velocity_threshold` | `u32` | `1` | `10_000` | `ContractError::InvalidThreshold` (5) |
| `velocity_window` | `u64` | `10` | `31_536_000` | `ContractError::InvalidWindow` (6) |
| `max_single_amount` | `i128` | `1` | `100_000_000_000_000_000_000_000_000` | `ContractError::InvalidAmount` (4) |
| `risk_score_threshold` | `u32` | `0` | `100` | `ContractError::InvalidScore` (7) |
| `anomaly_threshold` | `i64` | `0` | `10_000` | `ContractError::InvalidThreshold` (5) |
| `timestamp` | `u64` | `1` | `ledger_time + 300` | `ContractError::InvalidTimestamp` (11) |
| `history_capacity` | `u32` | `1` | `1_000` | Evicted FIFO ring-buffer |

---

## 3. Score Normalization & Clamping Guarantees

The composite risk score is calculated via 5 orthogonal dimensions:

$$Score_{total} = \min\left(100, Score_{velocity} + Score_{amount} + Score_{timing} + Score_{pattern} + Score_{historical}\right)$$

Where individual component caps are:
- $Score_{velocity} \in [0, 50]$
- $Score_{amount} \in [0, 40]$
- $Score_{timing} \in [0, 20]$
- $Score_{pattern} \in [0, 40]$
- $Score_{historical} \in [0, 30]$

Total score is mathematically clamped to `[0, 100]` before return, ensuring downstream consumption protocols never receive an out-of-range risk value.

---

## 4. Verification Evidence

The test suite covers:
- **Zero Values**: Validates rejection of `amount == 0`, `velocity_threshold == 0`, `velocity_window == 0`, `max_single_amount == 0`, and empty string inputs.
- **Maximum Values**: Tests `MAX_VALID_AMOUNT`, `MAX_VALID_AMOUNT + 1`, `i128::MAX`, `MAX_VELOCITY_THRESHOLD + 1`, `MAX_VELOCITY_WINDOW + 1`, `MAX_SCORE_BOUND + 1`, and `MAX_TX_TYPE_LEN + 1`.
- **Malformed Inputs**: Tests negative amounts (`-1`, `-50M`, `i128::MIN`), negative anomaly thresholds, and string length boundaries.
- **State Rejection**: Proves rejected inputs never increment user history, alter risk scores, or mutate configuration.
- **Pattern & Scoring Bounds**: Confirms all scores remain `<= 100` regardless of transaction frequency or size.
