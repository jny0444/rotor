#![cfg(test)]

use crate::contract::{RotorCore, RotorCoreClient};
use crate::error::Error;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, Env,
};

/// Create the RotorCore contract client
fn create_rotor_client<'a>(e: &Env) -> RotorCoreClient<'a> {
    let address = e.register(RotorCore, ());
    RotorCoreClient::new(e, &address)
}

/// Create a mock token contract and return its address and admin client
fn create_token<'a>(
    e: &Env,
    admin: &Address,
) -> (
    Address,
    token::TokenClient<'a>,
    token::StellarAssetClient<'a>,
) {
    let token_address = e.register_stellar_asset_contract_v2(admin.clone());
    let token_client = token::TokenClient::new(e, &token_address.address());
    let admin_client = token::StellarAssetClient::new(e, &token_address.address());
    (token_address.address(), token_client, admin_client)
}

/// Set up the environment with a specific ledger sequence
fn setup_env_with_ledger(sequence: u32) -> Env {
    let e = Env::default();
    e.ledger().set(LedgerInfo {
        timestamp: 12345,
        protocol_version: 23,
        sequence_number: sequence,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 3110400,
    });
    e
}

#[test]
fn test_lock_tokens() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    // Create rotor contract
    let rotor_client = create_rotor_client(&e);

    // Create a mock token and mint to user
    let (token_address, token_client, admin_client) = create_token(&e, &admin);
    admin_client.mint(&user, &1000);

    assert_eq!(token_client.balance(&user), 1000);

    // Lock 500 tokens until ledger 200
    let unlock_ledger: u32 = 200;
    rotor_client.lock(&token_address, &user, &500, &unlock_ledger);

    // Check user balance decreased
    assert_eq!(token_client.balance(&user), 500);

    // Check contract holds the tokens
    assert_eq!(token_client.balance(&rotor_client.address), 500);

    // Check lock info is stored correctly
    let lock_info = rotor_client.get_lock(&user, &token_address).unwrap();
    assert_eq!(lock_info.amount, 500);
    assert_eq!(lock_info.unlock_ledger, 200);
}

#[test]
fn test_release_tokens_after_unlock() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);
    let (token_address, token_client, admin_client) = create_token(&e, &admin);
    admin_client.mint(&user, &1000);

    // Lock 500 tokens until ledger 200
    rotor_client.lock(&token_address, &user, &500, &200);
    assert_eq!(token_client.balance(&user), 500);

    // Advance ledger to 200 (unlock time)
    e.ledger().set(LedgerInfo {
        timestamp: 12345,
        protocol_version: 23,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 3110400,
    });

    // Release tokens
    let released = rotor_client.release(&token_address, &user);
    assert_eq!(released, 500);

    // Check user got tokens back
    assert_eq!(token_client.balance(&user), 1000);

    // Check contract no longer holds tokens
    assert_eq!(token_client.balance(&rotor_client.address), 0);

    // Check lock info is removed
    assert!(rotor_client.get_lock(&user, &token_address).is_none());
}

#[test]
fn test_release_fails_before_unlock() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);
    let (token_address, _token_client, admin_client) = create_token(&e, &admin);
    admin_client.mint(&user, &1000);

    // Lock tokens until ledger 200
    rotor_client.lock(&token_address, &user, &500, &200);

    // Try to release before unlock time (current ledger is still 100)
    let result = rotor_client.try_release(&token_address, &user);
    assert_eq!(result, Err(Ok(Error::LockNotExpired)));
}

#[test]
fn test_release_fails_no_lock() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);
    let (token_address, _token_client, _admin_client) = create_token(&e, &admin);

    // Try to release without any lock
    let result = rotor_client.try_release(&token_address, &user);
    assert_eq!(result, Err(Ok(Error::NoLockFound)));
}

#[test]
fn test_lock_fails_with_zero_amount() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);
    let (token_address, _token_client, admin_client) = create_token(&e, &admin);
    admin_client.mint(&user, &1000);

    // Try to lock 0 tokens
    let result = rotor_client.try_lock(&token_address, &user, &0, &200);
    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn test_lock_fails_with_negative_amount() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);
    let (token_address, _token_client, admin_client) = create_token(&e, &admin);
    admin_client.mint(&user, &1000);

    // Try to lock negative amount
    let result = rotor_client.try_lock(&token_address, &user, &-100, &200);
    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn test_lock_fails_with_past_unlock_ledger() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);
    let (token_address, _token_client, admin_client) = create_token(&e, &admin);
    admin_client.mint(&user, &1000);

    // Try to lock with unlock_ledger in the past
    let result = rotor_client.try_lock(&token_address, &user, &500, &50);
    assert_eq!(result, Err(Ok(Error::InvalidUnlockLedger)));
}

#[test]
fn test_lock_fails_with_current_unlock_ledger() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);
    let (token_address, _token_client, admin_client) = create_token(&e, &admin);
    admin_client.mint(&user, &1000);

    // Try to lock with unlock_ledger equal to current
    let result = rotor_client.try_lock(&token_address, &user, &500, &100);
    assert_eq!(result, Err(Ok(Error::InvalidUnlockLedger)));
}

#[test]
fn test_lock_fails_if_already_locked() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);
    let (token_address, _token_client, admin_client) = create_token(&e, &admin);
    admin_client.mint(&user, &1000);

    // First lock
    rotor_client.lock(&token_address, &user, &500, &200);

    // Try to lock again
    let result = rotor_client.try_lock(&token_address, &user, &200, &300);
    assert_eq!(result, Err(Ok(Error::LockAlreadyExists)));
}

#[test]
fn test_is_lock_expired() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);
    let (token_address, _token_client, admin_client) = create_token(&e, &admin);
    admin_client.mint(&user, &1000);

    // Lock tokens
    rotor_client.lock(&token_address, &user, &500, &200);

    // Check not expired
    assert!(!rotor_client.is_lock_expired(&user, &token_address));

    // Advance ledger
    e.ledger().set(LedgerInfo {
        timestamp: 12345,
        protocol_version: 23,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 3110400,
    });

    // Check expired
    assert!(rotor_client.is_lock_expired(&user, &token_address));
}

#[test]
fn test_is_lock_expired_no_lock() {
    let e = setup_env_with_ledger(100);

    let user = Address::generate(&e);
    let token = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);

    // Should return false for non-existent lock
    assert!(!rotor_client.is_lock_expired(&user, &token));
}

#[test]
fn test_current_ledger() {
    let e = setup_env_with_ledger(12345);
    let rotor_client = create_rotor_client(&e);

    assert_eq!(rotor_client.current_ledger(), 12345);
}

#[test]
fn test_multiple_users_lock() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user1 = Address::generate(&e);
    let user2 = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);
    let (token_address, token_client, admin_client) = create_token(&e, &admin);
    admin_client.mint(&user1, &1000);
    admin_client.mint(&user2, &2000);

    // Both users lock tokens
    rotor_client.lock(&token_address, &user1, &500, &200);
    rotor_client.lock(&token_address, &user2, &1000, &300);

    // Check balances
    assert_eq!(token_client.balance(&user1), 500);
    assert_eq!(token_client.balance(&user2), 1000);
    assert_eq!(token_client.balance(&rotor_client.address), 1500);

    // Check individual lock info
    let lock1 = rotor_client.get_lock(&user1, &token_address).unwrap();
    assert_eq!(lock1.amount, 500);
    assert_eq!(lock1.unlock_ledger, 200);

    let lock2 = rotor_client.get_lock(&user2, &token_address).unwrap();
    assert_eq!(lock2.amount, 1000);
    assert_eq!(lock2.unlock_ledger, 300);
}

#[test]
fn test_lock_different_tokens() {
    let e = setup_env_with_ledger(100);
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let rotor_client = create_rotor_client(&e);

    // Create two different tokens
    let (token_a, token_a_client, admin_a) = create_token(&e, &admin);
    let (token_b, token_b_client, admin_b) = create_token(&e, &admin);

    admin_a.mint(&user, &1000);
    admin_b.mint(&user, &2000);

    // Lock both tokens
    rotor_client.lock(&token_a, &user, &500, &200);
    rotor_client.lock(&token_b, &user, &800, &250);

    // Check balances
    assert_eq!(token_a_client.balance(&user), 500);
    assert_eq!(token_b_client.balance(&user), 1200);

    // Check individual lock info
    let lock_a = rotor_client.get_lock(&user, &token_a).unwrap();
    assert_eq!(lock_a.amount, 500);
    assert_eq!(lock_a.unlock_ledger, 200);

    let lock_b = rotor_client.get_lock(&user, &token_b).unwrap();
    assert_eq!(lock_b.amount, 800);
    assert_eq!(lock_b.unlock_ledger, 250);
}
