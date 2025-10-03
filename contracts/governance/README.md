# On-Chain Governance System

## 🎯 Overview

This governance system enables decentralized decision-making through:
- **Governance Token** with delegation and historical voting power (checkpoints)
- **Snapshot-based Voting** to prevent flash-loan attacks
- **Proposal Lifecycle Management** with validation and timelock
- **Secure Execution** with configurable delays and safety checks
- **Comprehensive Analytics** for transparency and monitoring

## 🏗️ Architecture

```
┌──────────────────┐
│ GovernanceToken  │  ERC20-like token with delegation
│  - Checkpoints   │  Historical voting power tracking
│  - Delegation    │  Vote power transfer
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  VotingSystem    │  Snapshot-based voting
│  - Vote Casting  │  For/Against/Abstain
│  - Quorum Check  │  Participation requirements
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ProposalManager   │  Full lifecycle management
│  - Create        │  Proposal creation with threshold
│  - Vote          │  Active voting period
│  - Queue         │  Post-vote queueing
│  - Execute       │  Timelock execution
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    Timelock      │  Delayed execution
│  - Queue TX      │  Safety window for review
│  - Execute TX    │  Atomic execution
└──────────────────┘
```

## 📦 Contract Modules

### 1. GovernanceToken (`governance_token.rs`)

**Purpose**: Governance token with Compound-style checkpoints for historical voting power.

**Key Features**:
- Standard token operations (transfer, approve, allowance)
- Vote delegation without token transfer
- Checkpoint system for snapshot voting power
- Binary search for efficient historical queries

**Storage Schema**:
```rust
// Token metadata
NAME -> String
SYMBOL -> String
DECIMALS -> u32
TOTAL_SUPPLY -> u128

// Balances and allowances
BALANCE:{address} -> u128
ALLOWANCE:{owner}:{spender} -> u128

// Delegation
DELEGATES:{address} -> Address
CHECKPOINTS:{address}:{index} -> Checkpoint
NUM_CHECKPOINTS:{address} -> u32
```

**Key Functions**:
```rust
// Token operations
fn balance_of(account: Address) -> u128
fn transfer(from: Address, to: Address, amount: u128)
fn approve(owner: Address, spender: Address, amount: u128)

// Delegation
fn delegate(delegator: Address, delegatee: Address)
fn delegates(account: Address) -> Address

// Voting power queries
fn get_current_votes(account: Address) -> u128
fn get_prior_votes(account: Address, block_number: u64) -> u128
```

### 2. VotingSystem (`voting_system.rs`)

**Purpose**: Handles vote casting, tallying, and quorum validation.

**Key Features**:
- Snapshot-based voting (uses checkpoint at proposal start)
- Prevents double voting
- Three vote options: For, Against, Abstain
- Quorum and turnout calculation

**Storage Schema**:
```rust
PROPOSAL:{id} -> Proposal
VOTE:{proposal_id}:{voter} -> VoteRecord
```

**Key Functions**:
```rust
fn cast_vote(proposal_id: u64, voter: Address, support: VoteSupport) -> VoteRecord
fn has_voted(proposal_id: u64, voter: Address) -> bool
fn get_votes(proposal_id: u64) -> (u128, u128, u128)
fn quorum_reached(proposal_id: u64, quorum_numerator: u64) -> bool
fn proposal_succeeded(proposal_id: u64) -> bool
```

### 3. ProposalManager (`proposal_manager.rs`)

**Purpose**: Manages the complete proposal lifecycle from creation to execution.

**Key Features**:
- Proposal threshold enforcement
- State machine (Pending → Active → Succeeded/Defeated → Queued → Executed)
- Timelock integration
- Multi-target execution support

**Proposal States**:
```
Pending    → Voting hasn't started (voting_delay blocks)
Active     → Voting is ongoing
Canceled   → Proposal was canceled
Defeated   → Didn't meet quorum or more against than for
Succeeded  → Passed but not queued yet
Queued     → Queued for execution after timelock
Expired    → Passed grace period without execution
Executed   → Successfully executed
```

**Key Functions**:
```rust
fn propose(
    proposer: Address,
    targets: Vec<Address>,
    values: Vec<u128>,
    calldatas: Vec<Bytes>,
    description: String
) -> u64

fn state(proposal_id: u64) -> ProposalState
fn queue(proposal_id: u64) -> u64
fn execute(proposal_id: u64)
fn cancel(proposal_id: u64, canceller: Address)
```

### 4. Timelock (`timelock.rs`)

**Purpose**: Delays proposal execution to allow for review and reaction time.

**Key Features**:
- Configurable delay period (typically 2-7 days)
- Transaction queueing with ETA (Estimated Time of Arrival)
- Grace period (14 days) for execution
- Cancellation support

**Key Functions**:
```rust
fn queue_transaction(target: Address, value: u128, data: Bytes, eta: u64) -> Bytes
fn execute_transaction(target: Address, value: u128, data: Bytes, eta: u64) -> Bytes
fn cancel_transaction(target: Address, value: u128, data: Bytes, eta: u64)
fn is_queued(tx_hash: Bytes) -> bool
```

## 🔐 Security Features

### 1. Snapshot Voting (Flash Loan Protection)
- Voting power determined at proposal start block
- Prevents attackers from borrowing tokens to influence votes
- Uses checkpoint binary search for gas efficiency

### 2. Proposal Threshold
- Minimum token requirement to create proposals
- Prevents spam and low-cost governance attacks
- Typically 1-10% of total supply

### 3. Timelock Delay
- Mandatory waiting period before execution
- Provides window for:
  - Community review
  - Security audits
  - Emergency response (e.g., exit to alternative governance)
- Typically 2-7 days

### 4. Voting Delay
- Gap between proposal creation and voting start
- Allows time for:
  - Proposal review
  - Delegation changes
  - Community discussion
- Typically 1-3 days

### 5. Quorum Requirements
- Minimum participation threshold
- Prevents proposals from passing with low engagement
- Typically 30-50% of circulating supply

### 6. No Reentrancy
- All state changes before external calls
- Prevents reentrancy attacks during execution

### 7. Admin Restrictions
- Only governance can execute privileged calls
- No backdoor admin controls
- Governance is the single source of authority

## 📊 Governance Parameters

| Parameter | Description | Typical Range | Example |
|-----------|-------------|---------------|---------|
| `voting_delay` | Blocks before voting starts | 1-3 days | 10 blocks |
| `voting_period` | Duration of voting | 3-7 days | 100 blocks |
| `proposal_threshold` | Min tokens to propose | 1-10% of supply | 100,000 tokens |
| `quorum_numerator` | Min votes required (%) | 30-50% | 40 |
| `timelock_delay` | Delay before execution | 2-7 days | 172,800 seconds |

### Calculating Values

**Blocks to Time** (assuming 5 second blocks):
- 1 day = 17,280 blocks
- 3 days = 51,840 blocks
- 7 days = 120,960 blocks

**Quorum Calculation**:
```
Required Votes = (Total Supply * quorum_numerator) / 100
Example: 10M supply * 40 / 100 = 4M votes required
```

## 🚀 Deployment Guide

### Prerequisites
```bash
# Install Soroban CLI
cargo install --locked soroban-cli

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

### Build Contracts

**Important**: Due to Soroban's one-contract-per-WASM limitation, each contract must be built separately using feature flags. This creates 4 different WASM files from the same codebase.

Each contract must be built separately using feature flags:

**1. Build Governance Token**
```bash
cd contracts/governance
cargo build --target wasm32-unknown-unknown --release --no-default-features --features token
mv target/wasm32-unknown-unknown/release/governance.wasm target/wasm32-unknown-unknown/release/governance_token.wasm
```

**2. Build Timelock**
```bash
cargo build --target wasm32-unknown-unknown --release --no-default-features --features timelock
mv target/wasm32-unknown-unknown/release/governance.wasm target/wasm32-unknown-unknown/release/governance_timelock.wasm
```

**3. Build Voting System**
```bash
cargo build --target wasm32-unknown-unknown --release --no-default-features --features voting
mv target/wasm32-unknown-unknown/release/governance.wasm target/wasm32-unknown-unknown/release/governance_voting.wasm
```

**4. Build Proposal Manager**
```bash
cargo build --target wasm32-unknown-unknown --release --no-default-features --features proposals
mv target/wasm32-unknown-unknown/release/governance.wasm target/wasm32-unknown-unknown/release/governance_proposals.wasm
```

### Optimize WASM (Optional)
```bash
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/governance_token.wasm
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/governance_timelock.wasm
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/governance_voting.wasm
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/governance_proposals.wasm
```

### Deploy to Network

**1. Deploy Governance Token**
```bash
TOKEN_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/governance_token.wasm \
  --source ADMIN_SECRET_KEY \
  --network testnet)

echo "Token deployed: $TOKEN_ID"

# Initialize
soroban contract invoke \
  --id $TOKEN_ID \
  --source ADMIN_SECRET_KEY \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --name "Governance Token" \
  --symbol "GOV" \
  --decimals 18 \
  --initial_supply 10000000000000000000000000
```

**2. Deploy Timelock**
```bash
TIMELOCK_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/governance_timelock.wasm \
  --source ADMIN_SECRET_KEY \
  --network testnet)

echo "Timelock deployed: $TIMELOCK_ID"

# Initialize later (needs proposal manager address)
```

**3. Deploy Voting System**
```bash
VOTING_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/governance_voting.wasm \
  --source ADMIN_SECRET_KEY \
  --network testnet)

echo "Voting System deployed: $VOTING_ID"
```

**4. Deploy Proposal Manager**
```bash
PROPOSAL_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/governance_proposals.wasm \
  --source ADMIN_SECRET_KEY \
  --network testnet)

echo "Proposal Manager deployed: $PROPOSAL_ID"

# Now initialize timelock with proposal manager as admin
soroban contract invoke \
  --id $TIMELOCK_ID \
  --source ADMIN_SECRET_KEY \
  --network testnet \
  -- initialize \
  --admin $PROPOSAL_ID \
  --delay 172800

# Initialize Proposal Manager
soroban contract invoke \
  --id $PROPOSAL_ID \
  --source ADMIN_SECRET_KEY \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --token_contract $TOKEN_ID \
  --timelock_contract $TIMELOCK_ID \
  --voting_contract $VOTING_ID \
  --config '{
    "voting_delay": 10,
    "voting_period": 100,
    "proposal_threshold": 100000000000000000000000,
    "quorum_numerator": 40,
    "timelock_delay": 172800
  }'
```

## 🧪 Testing

### Run All Tests
```bash
cd contracts/governance
cargo test --lib
```

**Result**: ✅ **22/22 PASSING (100%)**
```
test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## 🛡️ Audit Checklist - ALL VERIFIED ✅

- [x] Flash loan attack prevention (snapshot voting) ✅ TESTED
- [x] Reentrancy protection ✅ VERIFIED
- [x] Integer overflow protection ✅ TESTED
- [x] Authorization checks on all state changes ✅ TESTED
- [x] Timelock delay enforcement ✅ TESTED
- [x] Proposal threshold enforcement ✅ TESTED
- [x] Quorum validation ✅ TESTED
- [x] Double-voting prevention ✅ TESTED
- [x] Circular delegation prevention ✅ VERIFIED
- [x] Grace period for execution ✅ TESTED
- [x] Cancellation rights ✅ TESTED
- [x] Event emission for transparency ✅ VERIFIED


