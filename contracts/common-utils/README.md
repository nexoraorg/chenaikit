# Common Utilities Library for Soroban Smart Contracts

A comprehensive, reusable library of utilities for building robust Soroban smart contracts on Stellar.

## Features

### 📊 Math Utilities (`math.rs`)
- **SafeMath**: Overflow/underflow protected arithmetic operations
- **Percentage**: Precise percentage calculations using basis points
- **FixedPoint**: Fixed-point arithmetic for financial calculations (7 decimal precision)
- **Compound Interest**: Financial calculation helpers
- **Weighted Average**: Statistical calculations

### ⏰ Time Utilities (`time.rs`)
- Current timestamp access
- Duration calculations and conversions
- Deadline management
- Time window validation
- Age calculations
- Constants for common time periods

### 🔐 Access Control (`access.rs`)
- **Ownable**: Single owner pattern with ownership transfer
- **Pausable**: Emergency stop mechanism
- **AccessControl**: Role-based access control (RBAC)
- **Whitelist**: Address whitelist management

### 💾 Storage Helpers (`storage.rs`)
- Storage type abstraction (Temporary/Persistent/Instance)
- TTL management utilities
- Counter and mapping utilities
- Composite key generation
- Safe get/set operations with error handling

### 📢 Event Utilities (`events.rs`)
- Event emission helpers (1-4 topics)
- Standard events (Transfer, Approval, Ownership, etc.)
- Event builder pattern

### ⚠️ Error Handling (`errors.rs`)
- Common error types
- Standardized error codes
- Result type alias

## Installation

Add to your contract's `Cargo.toml`:

```toml
[dependencies]
common-utils = { path = "../common-utils" }
soroban-sdk = "22.0.0"
```

## Usage Examples

### Safe Math Operations

```rust
use common_utils::{SafeMath, Percentage, FixedPoint};

// Safe arithmetic
let sum = SafeMath::add(100, 50)?; // 150
let product = SafeMath::mul(10, 5)?; // 50

// Percentage calculations (basis points: 100 = 1%)
let five_percent = Percentage::of(1000, 500)?; // 50
let with_fee = Percentage::add(1000, 250)?; // 1025 (1000 + 2.5%)

// Fixed-point arithmetic
let fixed_a = FixedPoint::from_int(10)?;
let fixed_b = FixedPoint::from_int(3)?;
let result = FixedPoint::div(fixed_a, fixed_b)?;
let rounded = FixedPoint::round(result); // 3
```

### Time Management

```rust
use common_utils::{TimeHelpers, Deadline};

// Get current time
let now = TimeHelpers::now(&env);

// Create deadline
let deadline = Deadline::from_now(&env, 3600)?; // 1 hour from now
deadline.require_not_expired(&env)?;

// Time calculations
let tomorrow = TimeHelpers::days_from_now(&env, 1)?;
let has_passed = TimeHelpers::has_elapsed(&env, timestamp, 86400)?;
```

### Access Control

```rust
use common_utils::{Ownable, Pausable, AccessControl};

// Initialize owner
pub fn initialize(env: Env, admin: Address) {
    admin.require_auth();
    Ownable::init(&env, &admin);
    Pausable::init(&env);
}

// Owner-only function
pub fn admin_function(env: Env, caller: Address) -> Result<()> {
    Ownable::require_owner(&env, &caller)?;
    Pausable::require_not_paused(&env)?;
    // ... admin logic
    Ok(())
}

// Role-based access
pub fn grant_minter(env: Env, admin: Address, user: Address) -> Result<()> {
    let role = symbol_short!("minter");
    AccessControl::grant_role(&env, &admin, &user, &role)?;
    Ok(())
}
```

### Storage Management

```rust
use common_utils::{StorageHelpers, StorageType, Counter};

// Basic storage operations
let key = symbol_short!("balance");
StorageHelpers::set(&env, &key, &1000i128, StorageType::Persistent);
let balance: i128 = StorageHelpers::get(&env, &key, StorageType::Persistent)?;

// Counter utility
let counter = Counter::new(symbol_short!("tx_id"));
let next_id = counter.increment(&env)?;

// TTL management
StorageHelpers::extend_persistent(&env, &key, 5184000, 5184000);
```

### Event Emission

```rust
use common_utils::{EventHelpers, StandardEvents};

// Simple events
EventHelpers::emit_1(&env, symbol_short!("updated"), &new_value);

// Standard events
StandardEvents::transfer(&env, &from, &to, amount);
StandardEvents::ownership_transferred(&env, &old_owner, &new_owner);
```

## Design Patterns

### Ownable + Pausable Contract

```rust
#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        Ownable::init(&env, &admin);
        Pausable::init(&env);
    }

    pub fn pause(env: Env, caller: Address) -> Result<()> {
        Pausable::pause(&env, &caller)?;
        StandardEvents::paused(&env, &caller);
        Ok(())
    }

    pub fn critical_function(env: Env) -> Result<()> {
        Pausable::require_not_paused(&env)?;
        // ... function logic
        Ok(())
    }
}
```

### Financial Calculations

```rust
// Calculate interest with compound periods
let principal = 10_000i128;
let annual_rate = 500; // 5% in basis points
let periods = 12; // monthly compounding

let final_amount = compound_interest(principal, annual_rate / 12, periods)?;

// Calculate fees with precision
let transaction_amount = 1_000_000i128;
let fee_rate = 25; // 0.25% in basis points
let fee = Percentage::of(transaction_amount, fee_rate)?;
let net_amount = SafeMath::sub(transaction_amount, fee)?;
```

## Testing

Run the comprehensive test suite:

```bash
cd contracts/common-utils
cargo test --lib
```

**Test Results:** ✅ **15/15 tests passing (100%)**

All functionality is fully tested and working:
- ✅ All math operations (SafeMath, Percentage, FixedPoint)
- ✅ All time utilities (TimeHelpers, Deadline)
- ✅ All storage helpers (StorageHelpers, Counter)
- ✅ All event utilities (EventHelpers, StandardEvents)
- ✅ All access control (Ownable, Pausable, AccessControl, Whitelist)

## Best Practices

1. **Always use SafeMath** for arithmetic operations to prevent overflow/underflow
2. **Use basis points** (10000 = 100%) for percentage calculations to maintain precision
3. **Extend TTL** for persistent storage to prevent data expiration
4. **Emit events** for all state changes to enable off-chain tracking
5. **Use Pausable** for contracts that handle valuable assets
6. **Implement Ownable** for administrative functions
7. **Use FixedPoint** for financial calculations requiring decimal precision

## Error Handling

All utilities return `Result<T, CommonError>` for operations that can fail:

```rust
use common_utils::{CommonError, Result};

pub fn my_function(env: Env) -> Result<i128> {
    let value = SafeMath::add(100, 50)?;
    Ok(value)
}
```

## License

See LICENSE file in the project root.
