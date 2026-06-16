use crate::access::Whitelist;
use crate::events::StandardEvents;
use crate::math::{compound_interest, weighted_average};
use crate::storage::Counter;
use crate::time::Deadline;
use crate::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger},
    Address, Env,
};

#[test]
fn test_safe_math_operations() {
    // Test addition
    assert_eq!(SafeMath::add(100, 50).unwrap(), 150);
    assert!(SafeMath::add(i128::MAX, 1).is_err());

    // Test subtraction
    assert_eq!(SafeMath::sub(100, 50).unwrap(), 50);
    assert!(SafeMath::sub(i128::MIN, 1).is_err());

    // Test multiplication
    assert_eq!(SafeMath::mul(10, 5).unwrap(), 50);
    assert!(SafeMath::mul(i128::MAX, 2).is_err());

    // Test division
    assert_eq!(SafeMath::div(100, 5).unwrap(), 20);
    assert!(SafeMath::div(100, 0).is_err());

    // Test min/max
    assert_eq!(SafeMath::min(10, 20), 10);
    assert_eq!(SafeMath::max(10, 20), 20);

    // Test clamp
    assert_eq!(SafeMath::clamp(5, 10, 20), 10);
    assert_eq!(SafeMath::clamp(15, 10, 20), 15);
    assert_eq!(SafeMath::clamp(25, 10, 20), 20);
}

#[test]
fn test_percentage_calculations() {
    // Test percentage of value (5% of 1000 = 50)
    assert_eq!(Percentage::of(1000, 500).unwrap(), 50);

    // Test 100% of value
    assert_eq!(Percentage::of(1000, 10000).unwrap(), 1000);

    // Test 0.5% of value
    assert_eq!(Percentage::of(1000, 50).unwrap(), 5);

    // Test calculate percentage (50 is 5% of 1000)
    assert_eq!(Percentage::calculate(50, 1000).unwrap(), 500);

    // Test add percentage (1000 + 10% = 1100)
    assert_eq!(Percentage::add(1000, 1000).unwrap(), 1100);

    // Test subtract percentage (1000 - 10% = 900)
    assert_eq!(Percentage::sub(1000, 1000).unwrap(), 900);
}

#[test]
fn test_fixed_point_arithmetic() {
    // Test conversion
    let fixed = FixedPoint::from_int(10).unwrap();
    assert_eq!(FixedPoint::to_int(fixed), 10);

    // Test multiplication (10 * 2 = 20)
    let a = FixedPoint::from_int(10).unwrap();
    let b = FixedPoint::from_int(2).unwrap();
    let result = FixedPoint::mul(a, b).unwrap();
    assert_eq!(FixedPoint::to_int(result), 20);

    // Test division (100 / 10 = 10)
    let a = FixedPoint::from_int(100).unwrap();
    let b = FixedPoint::from_int(10).unwrap();
    let result = FixedPoint::div(a, b).unwrap();
    assert_eq!(FixedPoint::to_int(result), 10);

    // Test rounding
    let value = FixedPoint::from_int(10).unwrap() + 5_000_000; // 10.5
    assert_eq!(FixedPoint::round(value), 11);
}

#[test]
fn test_time_helpers() {
    let env = Env::default();
    env.ledger().set_timestamp(1000000);

    // Test current time
    let now = TimeHelpers::now(&env);
    assert!(now > 0);

    // Test time addition
    let future = TimeHelpers::add_duration(&env, 3600).unwrap();
    assert_eq!(future, now + 3600);

    // Test time difference
    let diff = TimeHelpers::time_diff(future, now).unwrap();
    assert_eq!(diff, 3600);

    // Test conversions
    assert_eq!(TimeHelpers::days_to_seconds(1).unwrap(), 86400);
    assert_eq!(TimeHelpers::hours_to_seconds(1).unwrap(), 3600);
    assert_eq!(TimeHelpers::seconds_to_days(86400), 1);
    assert_eq!(TimeHelpers::seconds_to_hours(3600), 1);
}

#[test]
fn test_deadline() {
    let env = Env::default();
    env.ledger().set_timestamp(1000000);

    // Create deadline 1 hour from now
    let deadline = Deadline::from_now(&env, 3600).unwrap();

    // Should not be expired
    assert!(!deadline.is_expired(&env));

    // Should have remaining time
    let remaining = deadline.remaining(&env).unwrap();
    assert!(remaining > 0 && remaining <= 3600);

    // Require not expired should succeed
    assert!(deadline.require_not_expired(&env).is_ok());
}

#[test]
fn test_ownable() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let contract_id = env.register(crate::lib_contract::Contract, ());

    env.mock_all_auths();

    // Initialize owner in contract context
    env.as_contract(&contract_id, || {
        Ownable::init(&env, &owner);

        // Check owner
        assert_eq!(Ownable::get_owner(&env).unwrap(), owner);
        assert!(Ownable::is_owner(&env, &owner));

        // Transfer ownership
        let new_owner = Address::generate(&env);
        assert!(Ownable::transfer_ownership(&env, &owner, &new_owner).is_ok());
        assert_eq!(Ownable::get_owner(&env).unwrap(), new_owner);
    });
}

#[test]
fn test_pausable() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let contract_id = env.register(crate::lib_contract::Contract, ());

    env.mock_all_auths();

    env.as_contract(&contract_id, || {
        // Initialize
        Ownable::init(&env, &owner);
        Pausable::init(&env);

        // Should not be paused initially
        assert!(!Pausable::is_paused(&env));
        assert!(Pausable::require_not_paused(&env).is_ok());

        // Pause
        assert!(Pausable::pause(&env, &owner).is_ok());
        assert!(Pausable::is_paused(&env));
        assert!(Pausable::require_not_paused(&env).is_err());

        // Unpause
        assert!(Pausable::unpause(&env, &owner).is_ok());
        assert!(!Pausable::is_paused(&env));
    });
}

#[test]
fn test_access_control() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let role = symbol_short!("minter");
    let contract_id = env.register(crate::lib_contract::Contract, ());

    env.mock_all_auths();

    env.as_contract(&contract_id, || {
        // Initialize owner
        Ownable::init(&env, &admin);

        // Grant role
        assert!(AccessControl::grant_role(&env, &admin, &user, &role).is_ok());
        assert!(AccessControl::has_role(&env, &user, &role));

        // Revoke role
        assert!(AccessControl::revoke_role(&env, &admin, &user, &role).is_ok());
        assert!(!AccessControl::has_role(&env, &user, &role));
    });
}

#[test]
fn test_storage_helpers() {
    let env = Env::default();
    let key = symbol_short!("test");
    let contract_id = env.register(crate::lib_contract::Contract, ());

    env.as_contract(&contract_id, || {
        // Test set and get
        StorageHelpers::set(&env, &key, &42i128, StorageType::Instance);
        assert_eq!(
            StorageHelpers::get::<_, i128>(&env, &key, StorageType::Instance).unwrap(),
            42
        );

        // Test has
        assert!(StorageHelpers::has_instance(&env, &key));

        // Test increment
        let new_val = StorageHelpers::increment(&env, &key, StorageType::Instance).unwrap();
        assert_eq!(new_val, 43);

        // Test decrement
        let new_val = StorageHelpers::decrement(&env, &key, StorageType::Instance).unwrap();
        assert_eq!(new_val, 42);

        // Test remove
        StorageHelpers::remove(&env, &key, StorageType::Instance);
        assert!(!StorageHelpers::has_instance(&env, &key));
    });
}

#[test]
fn test_counter() {
    let env = Env::default();
    let counter = Counter::new(symbol_short!("cnt"));
    let contract_id = env.register(crate::lib_contract::Contract, ());

    env.as_contract(&contract_id, || {
        // Initial value should be 0
        assert_eq!(counter.get(&env), 0);

        // Increment
        assert_eq!(counter.increment(&env).unwrap(), 1);
        assert_eq!(counter.increment(&env).unwrap(), 2);
        assert_eq!(counter.get(&env), 2);

        // Set
        counter.set(&env, 10);
        assert_eq!(counter.get(&env), 10);

        // Reset
        counter.reset(&env);
        assert_eq!(counter.get(&env), 0);
    });
}

#[test]
fn test_weighted_average() {
    let values = [100i128, 200, 300];
    let weights = [1i128, 2, 3];

    // (100*1 + 200*2 + 300*3) / (1+2+3) = 1400 / 6 = 233
    let avg = weighted_average(&values, &weights).unwrap();
    assert_eq!(avg, 233);
}

#[test]
fn test_compound_interest() {
    // 1000 principal, 10% rate (1000 basis points), 3 periods
    // Period 1: 1000 + 100 = 1100
    // Period 2: 1100 + 110 = 1210
    // Period 3: 1210 + 121 = 1331
    let result = compound_interest(1000, 1000, 3).unwrap();
    assert_eq!(result, 1331);
}

#[test]
fn test_event_helpers() {
    let env = Env::default();

    // Test simple event emission (should not panic)
    EventHelpers::emit_1(&env, symbol_short!("test"), &42i128);
    EventHelpers::emit_2(&env, symbol_short!("test"), symbol_short!("data"), &42i128);
}

#[test]
fn test_standard_events() {
    let env = Env::default();
    let addr1 = Address::generate(&env);
    let addr2 = Address::generate(&env);

    // Test standard events (should not panic)
    StandardEvents::transfer(&env, &addr1, &addr2, 100);
    StandardEvents::approval(&env, &addr1, &addr2, 50);
    StandardEvents::ownership_transferred(&env, &addr1, &addr2);
    StandardEvents::paused(&env, &addr1);
    StandardEvents::unpaused(&env, &addr1);
}

#[test]
fn test_whitelist() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(crate::lib_contract::Contract, ());

    env.mock_all_auths();

    env.as_contract(&contract_id, || {
        // Initialize owner
        Ownable::init(&env, &admin);

        // Add to whitelist
        assert!(Whitelist::add(&env, &admin, &user).is_ok());
        assert!(Whitelist::is_whitelisted(&env, &user));

        // Remove from whitelist
        assert!(Whitelist::remove(&env, &admin, &user).is_ok());
        assert!(!Whitelist::is_whitelisted(&env, &user));
    });
}
