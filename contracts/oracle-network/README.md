# Oracle Network Contract

A decentralized model oracle network for verifiable ML inference on Soroban.

## Overview

The Oracle Network contract implements a staked, multi-node oracle system that:
- Runs approved ML models through registered oracle nodes
- Cryptographically signs and aggregates node outputs
- Submits attested scores on-chain via commit-reveal scheme
- Allows disputed scores to be challenged and slashed
- Enables governance control over node admission and model version approval

## Architecture

```
ML model (Python)          Oracle Node (TS)              Soroban chain
┌────────────┐   infer     ┌────────────────┐  sign+sub   ┌──────────────────┐
│ credit-score│ ─────────▶ │ OracleWorker    │ ──────────▶ │ oracle-network    │
│ fraud-detect│            │ - model hash    │             │  contract         │
└────────────┘            │ - keypair sign  │             │ - quorum agg.     │
       ▲                    │ - retry/backoff │             │ - stake/slash     │
       │ drift/version check└────────────────┘             │ - dispute window  │
       │                                                    └─────────┬────────┘
┌─────┴────────┐                                                     │ cross-contract
│ governance    │◀────────────── admits nodes, sets params ──────────┘
│ contract      │                                          ┌──────────────────┐
└───────────────┘                                          │ credit-score /    │
                                                              │ fraud-detect      │
                                                              │ (consume attested │
                                                              │  scores only)     │
                                                              └──────────────────┘
```

## Key Features

### Node Registry & Staking
- Node registration requires locking a bond
- Stake-weighted quorum for aggregation
- Reputation tracking for node selection

### Commit-Reveal Submission
- Nodes submit hash(score, salt) in commit phase
- Reveal phase prevents copy-trading
- Configurable timing for each phase

### Quorum Aggregation
- Configurable threshold (e.g., 5-of-9)
- Median/trimmed-mean aggregation
- Variance tolerance checks

### Slashing Mechanism
- Nodes deviating from aggregate lose stake
- Failed reveals are slashed
- Slash split between treasury and disputer

### Dispute Window
- Staked parties can challenge finalized scores
- Re-aggregation with fresh node set
- Economic penalties for frivolous disputes

### Model Version Binding
- Every submission references approved model hash
- Governance controls model version approval
- Rejects unapproved model submissions

## Storage

### Instance Storage
- `admin`: Contract administrator
- `governance`: Governance contract address
- `config`: Network configuration parameters
- `nodes`: Map of registered nodes
- `submissions`: Map of submission statuses
- `models`: Set of approved model hashes
- `commits`: Map of commit data
- `reveals`: Map of reveal data
- `disputes`: Map of dispute records

## Configuration

```rust
pub struct Config {
    pub min_stake: i128,                    // Minimum stake (1M stroops)
    pub quorum_threshold: u32,              // Nodes required for quorum
    pub max_nodes: u32,                     // Maximum registered nodes
    pub commit_duration_ledgers: u32,       // Commit phase duration
    pub reveal_duration_ledgers: u32,       // Reveal phase duration
    pub dispute_window_ledgers: u32,       // Dispute window duration
    pub slash_percentage: u32,             // Percentage of stake to slash
    pub variance_tolerance: i128,           // Allowed score variance
}
```

## Functions

### Initialization
- `initialize(admin, governance)` - Set up contract with admin and governance

### Node Management
- `register_node(node, stake_amount)` - Register a new oracle node
- `unregister_node(node)` - Unregister and return stake
- `get_node(node)` - Get node information
- `get_all_nodes()` - Get all registered nodes

### Submission
- `submit_commit(node, commit_hash, model_hash)` - Submit commit hash
- `reveal(node, score, salt)` - Reveal actual score and salt
- `finalize_aggregation(request_id)` - Finalize aggregation

### Dispute & Slashing
- `file_dispute(disputer, request_id, evidence)` - File a dispute
- `execute_slashing(request_id)` - Execute slashing

### Governance
- `approve_model_version(governance, model_hash, metadata)` - Approve model
- `revoke_model_version(governance, model_hash)` - Revoke model
- `update_config(governance, config)` - Update network parameters

### Queries
- `get_config()` - Get current configuration
- `get_submission(request_id)` - Get submission status
- `get_approved_models()` - Get approved model versions
- `is_model_approved(model_hash)` - Check model approval

### Upgrade
- `upgrade(admin, new_wasm_hash)` - Upgrade contract
- `get_version()` - Get contract version

## Testing

Run tests with:
```bash
cd contracts/oracle-network
cargo test
```

## Security Considerations

### Commit-Reveal Scheme
Prevents copy-trading by requiring nodes to commit to a hash before revealing their actual score.

### Economic Security
- Minimum stake requirement creates economic barrier to entry
- Slashing creates economic disincentive for malicious behavior
- Dispute window allows timely challenges

### Model Version Control
- Governance approval ensures only vetted models are used
- Hash binding prevents model substitution attacks

### Limitations
- On-chain randomness is not truly verifiable (documented honestly)
- Dispute resolution relies on honest node majority
- Economic security depends on stake size vs attack profit

## Building

```bash
cd contracts/oracle-network
cargo build --release --target wasm32-unknown-unknown
```

## Deployment

See `scripts/` directory for deployment scripts.
