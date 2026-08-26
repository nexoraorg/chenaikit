# Fraud Detection Smart Contract (`fraud-detect`)

## Overview

The `fraud-detect` smart contract is a decentralized fraud detection and risk evaluation engine implemented for Soroban. It analyzes caller-provided transaction data in real time, detecting anomalies, behavioral heuristic patterns (velocity bursts, unusual amounts, rapid succession, circular transfers, address repetition), and calculates bounded composite risk scores.

## Architecture

The contract is structured into modular components:

- **`lib.rs`**: Core Soroban contract definition and public entry points.
- **`validation.rs`**: Boundary validation engine enforcing input bounds and rejection semantics.
- **`errors.rs`**: Explicit contract error enumeration (`ContractError`).
- **`types.rs`**: Domain types, configuration objects, score records, and bounds inventories.
- **`storage.rs`**: Safe persistent and instance storage management with bounded ring-buffer transaction history.
- **`patterns.rs`**: Heuristic pattern matchers (velocity, round numbers, unusual amounts, timing, circularity).
- **`risk_scorer.rs`**: Multi-dimensional risk score computation and statistical anomaly detection.
- **`events.rs`**: Audit telemetry and validation failure event publication.
- **`upgrade.rs`**: Admin-authorized WASM upgrade and rollback engine.

---

## Input Constraints and Bounds Inventory

Boundary validation is strictly enforced before any state modification occurs. If any input violates boundary constraints, execution reverts immediately with a descriptive error code and emits a `val_err` event for off-chain observability.

| Parameter / Field | Type | Minimum Bound | Maximum Bound | Rejection Error Code | Semantics & Rationale |
|---|---|---|---|---|---|
| `amount` | `i128` | `1` | `100_000_000_000_000_000_000_000_000` | `InvalidAmount` (4) | Zero, negative amounts, or values exceeding ~100M tokens (18 decimals) are invalid. |
| `transaction_type` | `String` | `1` byte | `64` bytes | `EmptyString` (8) / `StringTooLong` (9) | Prevents empty descriptors and unbounded memory allocation. |
| `velocity_threshold` | `u32` | `1` | `10_000` | `InvalidThreshold` (5) | Must allow at least 1 transaction; cannot exceed 10k to prevent resource exhaustion. |
| `velocity_window` | `u64` | `10` seconds | `31_536_000` seconds (1 year) | `InvalidWindow` (6) | Time window must be realistic (between 10 seconds and 365 days). |
| `max_single_amount` | `i128` | `1` | `100_000_000_000_000_000_000_000_000` | `InvalidAmount` (4) | Configuration threshold above which unusual amount scoring activates. |
| `risk_score_threshold`| `u32` | `0` | `100` | `InvalidScore` (7) | Scores are strictly clamped in the range `0..=100`. |
| `anomaly_threshold` | `i64` | `0` | `10_000` | `InvalidThreshold` (5) | Statistical deviation threshold for anomaly alerts. |
| `timestamp` | `u64` | `1` | `current_ledger_time + 300` | `InvalidTimestamp` (11) | Rejects zero timestamps and timestamps drifting more than 5 minutes into future. |
| `history_capacity` | `u32` | N/A | `1_000` entries | N/A (Eviction) | Bounded ring-buffer storage; oldest entry evicted upon reaching 1,000 records. |

---

## Rejection Semantics

1. **Atomic Rejection**: If an input is malformed or out of bounds, the contract panics with the specific `ContractError` code or returns `Err(ContractError)`. No ledger state is modified.
2. **State Invariance**:
   - `user_history` length remains unchanged on failure.
   - User aggregate risk score remains unchanged on failure.
   - Configuration remains unchanged on failure.
   - Whitelist and blacklist remain unchanged on failure.
3. **Telemetry & Auditability**:
   - Validation failures publish a `val_err` event containing `(error_code, input_tag, timestamp)`.
4. **Special Account States**:
   - **Blacklisted**: `analyze_transaction` immediately short-circuits to score `100` without recording to history.
   - **Whitelisted**: `analyze_transaction` records transaction and returns score `0`.

---

## Contract Public Interface

### Core Methods

- `initialize(admin: Address) -> Result<(), ContractError>`
- `analyze_transaction(user: Address, from_address: Address, to_address: Address, amount: i128, transaction_type: String) -> Result<u32, ContractError>`
- `get_risk_score(user: Address) -> Result<u32, ContractError>`
- `get_indicators(user: Address) -> Vec<String>`
- `get_bounds_inventory() -> InputBoundsInventory`

### Configuration & Administration

- `update_config(admin: Address, config: FraudConfig) -> Result<(), ContractError>`
- `get_config() -> FraudConfig`
- `add_to_blacklist(admin: Address, address: Address) -> Result<(), ContractError>`
- `remove_from_blacklist(admin: Address, address: Address) -> Result<(), ContractError>`
- `is_blacklisted(address: Address) -> bool`
- `add_to_whitelist(admin: Address, address: Address) -> Result<(), ContractError>`
- `remove_from_whitelist(admin: Address, address: Address) -> Result<(), ContractError>`
- `is_whitelisted(address: Address) -> bool`
- `clear_user_history(admin: Address, user: Address) -> Result<(), ContractError>`

### Upgrade & Maintenance

- `upgrade(admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), ContractError>`
- `rollback(admin: Address) -> Result<(), ContractError>`
- `get_version() -> u32`
- `get_upgrade_history() -> Vec<UpgradeRecord>`
- `ping() -> bool`

---

## Testing

Run all validation and boundary tests:

```bash
cargo test -p fraud-detect
```

Run workspace-wide test suite:

```bash
cargo test --workspace
```

Run formatting and clippy validation:

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

Build production wasm:

```bash
cargo build --workspace --release --target wasm32-unknown-unknown
```
