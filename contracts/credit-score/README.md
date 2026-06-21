# Credit Score Smart Contract

## 🎯 Overview

The Credit Score smart contract provides on-chain credit scoring functionality for the ChenAIKit platform. It enables:
- **Credit Score Storage**: Persistent storage of user credit scores
- **Score Updates**: Dynamic score adjustments based on various factors
- **Access Control**: Admin-controlled score management with user authorization
- **Oracle Integration**: Support for cross-contract oracle adjustments (extensible)
- **Contract Upgradeability**: Admin-only upgrade functionality with version control

## 🏗️ Architecture

```
┌──────────────────────┐
│ CreditScoreContract  │
├──────────────────────┤
│ • Initialize         │  Contract setup with admin
│ • Calculate Score    │  Base score calculation
│ • Get/Set Score      │  Score retrieval & storage
│ • Update Factors     │  Adjust scores via factors
│ • Oracle Adjustment  │  Cross-contract integration
│ • Upgrade            │  Contract upgradeability
└──────────────────────┘
         │
         ├─► Storage Module (Persistent)
         │   • Score mappings
         │   • TTL management
         │
         ├─► Access Control Module
         │   • Admin management
         │   • Role-based access
         │
         ├─► Events Module
         │   • Score updates
         │   • Upgrade events
         │
         └─► Upgrade Module
             • Version tracking
             • WASM updates
```

## 📦 Contract Modules

### 1. Main Contract ([lib.rs](src/lib.rs))

**Key Functions**:

```rust
// Initialization
pub fn initialize(env: Env, admin: Address)

// Score Operations
pub fn calculate_score(env: Env, account: Address) -> u32
pub fn get_score(env: Env, account: Address) -> u32
pub fn has_score(env: Env, account: Address) -> bool

// Score Management
pub fn update_factors(env: Env, account: Address, factors_str: String)
pub fn adjust_score_with_oracle(env: Env, user: Address, oracle_contract: Address)

// Admin Operations
pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>)
```

### 2. Storage Module ([storage.rs](src/storage.rs))

**Storage Schema**:
```rust
SCORE_KEY -> Map<Address, i128>
```

**Features**:
- Persistent storage with automatic TTL extension (1 year)
- Efficient score retrieval with default values
- Historical score tracking in temporary storage

### 3. Access Control Module ([access_control.rs](src/access_control.rs))

**Features**:
- Admin initialization and management
- Role-based access control
- Admin transfer capabilities
- Authorization enforcement

### 4. Events Module ([events.rs](src/events.rs))

**Events**:
```rust
TOPIC_SCORE_UPDATE -> (user: Address, new_score: i128)
TOPIC_UPGRADE -> (version: u32)
```

### 5. Upgrade Module ([upgrade.rs](src/upgrade.rs))

**Features**:
- Version-based upgrade control
- Admin-only upgrade execution
- Automatic TTL extension during migration
- Upgrade event emission

## 🔐 Security Features

### 1. Authorization Control
- User authorization required for score updates (`require_auth`)
- Admin-only upgrade functionality
- Role-based access for sensitive operations

### 2. Overflow Protection
- Safe arithmetic operations using `checked_add`/`checked_sub`
- Score boundaries enforced (minimum 0, capped at u32::MAX)

### 3. Upgrade Safety
- Version tracking prevents downgrades
- Admin verification before WASM updates
- TTL extension ensures data persistence

### 4. Data Persistence
- Persistent storage with 1-year TTL
- Automatic TTL extension on updates
- Temporary storage for historical tracking

## 🧪 Testing

### Run Tests
```bash
# Using cargo directly
cargo test --lib

# Using test script
./scripts/test.sh
```

### Test Coverage

**✅ 16/16 Tests Passing (100%)**

```
test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured
```

**Test Categories**:
- ✅ Initialization and setup
- ✅ Score calculation and retrieval
- ✅ Score storage and persistence
- ✅ Factor-based updates (boost/penalty)
- ✅ Oracle integration
- ✅ Multiple user isolation
- ✅ Edge cases (overflow, zero score, unknown factors)
- ✅ Authorization requirements
- ✅ Data persistence across calls

## 🚀 Deployment Guide

### Prerequisites

```bash
# Install Rust and Soroban CLI
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install --locked soroban-cli
```

### Build

```bash
# Build the contract
./scripts/build.sh

# Or manually
cargo build --target wasm32-unknown-unknown --release
```

### Optimize (Optional)

```bash
# Optimize WASM for production
./scripts/optimize.sh

# Or manually
soroban contract optimize \
    --wasm target/wasm32-unknown-unknown/release/credit_score.wasm
```

### Deploy to Testnet

```bash
# Set environment variables
export DEPLOYER_SECRET=S...  # Your Stellar secret key
export ADMIN_ADDRESS=G...    # Admin's Stellar address
export NETWORK=testnet

# Deploy and initialize
./scripts/deploy.sh
```

The deployment script will:
1. Deploy the contract to testnet
2. Save the contract ID to `.contract-id-testnet`
3. Initialize with the admin address (if provided)

### Manual Deployment

```bash
# Deploy
CONTRACT_ID=$(soroban contract deploy \
    --wasm target/wasm32-unknown-unknown/release/credit_score.wasm \
    --source DEPLOYER_SECRET \
    --network testnet)

# Initialize
soroban contract invoke \
    --id $CONTRACT_ID \
    --source DEPLOYER_SECRET \
    --network testnet \
    -- initialize \
    --admin ADMIN_ADDRESS
```

## 📖 Usage Examples

### Calculate and Get Score

```bash
# Calculate base score for a user
./scripts/invoke.sh calculate_score --account GABC...

# Get existing score
./scripts/invoke.sh get_score --account GABC...

# Check if user has a score
./scripts/invoke.sh has_score --account GABC...
```

### Update Score Factors

```bash
# Boost score (+50)
./scripts/invoke.sh update_factors \
    --account GABC... \
    --factors_str "boost"

# Apply penalty (-50)
./scripts/invoke.sh update_factors \
    --account GABC... \
    --factors_str "penalty"
```

### Oracle Integration

```bash
# Adjust score using oracle contract
./scripts/invoke.sh adjust_score_with_oracle \
    --user GABC... \
    --oracle_contract CDEF...
```

## 📊 Score Mechanics

### Default Values
- **Base Score**: 600
- **Boost Adjustment**: +50
- **Penalty Adjustment**: -50
- **Minimum Score**: 0
- **Maximum Score**: u32::MAX (4,294,967,295)

### Factor Types
- `"boost"`: Increases score by 50
- `"penalty"`: Decreases score by 50 (minimum 0)
- Other values: No effect on score

### Oracle Adjustment
- Stub implementation adds +10
- Can be extended with real oracle contract integration
- Requires oracle contract address

## 🔄 Contract Upgrade

Only the admin can upgrade the contract:

```bash
# Generate new WASM hash
NEW_WASM_HASH=$(soroban contract install \
    --wasm new_version.wasm \
    --source ADMIN_SECRET)

# Upgrade contract
soroban contract invoke \
    --id CONTRACT_ID \
    --source ADMIN_SECRET \
    --network testnet \
    -- upgrade \
    --admin ADMIN_ADDRESS \
    --new_wasm_hash $NEW_WASM_HASH
```

## 📝 Development Scripts

All scripts are located in the `scripts/` directory:

| Script | Purpose |
|--------|---------|
| `build.sh` | Build contract to WASM |
| `optimize.sh` | Optimize WASM file size |
| `test.sh` | Run test suite |
| `deploy.sh` | Deploy to network |
| `initialize.sh` | Initialize deployed contract |
| `invoke.sh` | Invoke contract functions |

## 🛡️ Security Considerations

1. **Authorization**: All score modifications require user authorization
2. **Admin Control**: Upgrades restricted to admin only
3. **Overflow Safety**: All arithmetic operations use safe math
4. **Data Integrity**: Persistent storage with automatic TTL management
5. **Event Transparency**: All state changes emit events for tracking

## 🔮 Future Extensions

- [ ] Multi-factor credit scoring algorithm
- [ ] Integration with external data oracles
- [ ] Credit score history and analytics
- [ ] Reputation-based score adjustments
- [ ] Lending decision support
- [ ] Gas optimization for batch operations

## 📄 License

This contract is part of the ChenAIKit project.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- All tests pass (`cargo test --lib`)
- Code follows Rust best practices
- New features include test coverage
- Documentation is updated

---
