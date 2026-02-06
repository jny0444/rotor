use soroban_sdk::{contract, contractimpl, token, Address, Env};

use crate::error::Error;
use crate::storage_types::{DataKey, LockInfo};

#[contract]
pub struct RotorCore;

#[contractimpl]
impl RotorCore {
    /// Lock tokens for a specified duration.
    ///
    /// # Arguments
    /// * `e` - The environment
    /// * `token` - The address of the token contract to lock
    /// * `from` - The address of the user locking tokens (must authorize)
    /// * `amount` - The amount of tokens to lock
    /// * `unlock_ledger` - The ledger sequence number when tokens can be unlocked
    ///
    /// # Returns
    /// * `Result<(), Error>` - Ok if successful, Error otherwise
    pub fn lock(
        e: Env,
        token: Address,
        from: Address,
        amount: i128,
        unlock_ledger: u32,
    ) -> Result<(), Error> {
        // Require authorization from the user
        from.require_auth();

        // Validate amount
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Validate unlock ledger is in the future
        let current_ledger = e.ledger().sequence();
        if unlock_ledger <= current_ledger {
            return Err(Error::InvalidUnlockLedger);
        }

        // Check if a lock already exists
        let key = DataKey::Lock(from.clone(), token.clone());
        if e.storage().persistent().has(&key) {
            return Err(Error::LockAlreadyExists);
        }

        // Get the contract address to receive tokens
        let lock_contract = e.current_contract_address();

        // Create token client and transfer tokens to the contract
        let token_client = token::TokenClient::new(&e, &token);
        token_client.transfer(&from, &lock_contract, &amount);

        // Store the lock information
        let lock_info = LockInfo {
            amount,
            unlock_ledger,
        };
        e.storage().persistent().set(&key, &lock_info);

        // Extend the TTL to ensure lock data persists until unlock
        let ttl = unlock_ledger.saturating_sub(current_ledger) + 1000; // Add buffer
        e.storage().persistent().extend_ttl(&key, ttl, ttl);

        Ok(())
    }

    /// Release locked tokens after the unlock time has passed.
    ///
    /// # Arguments
    /// * `e` - The environment
    /// * `token` - The address of the token contract
    /// * `to` - The address to send the unlocked tokens to (must be original locker)
    ///
    /// # Returns
    /// * `Result<i128, Error>` - The amount released if successful, Error otherwise
    pub fn release(e: Env, token: Address, to: Address) -> Result<i128, Error> {
        // Require authorization from the recipient
        to.require_auth();

        // Get the lock key
        let key = DataKey::Lock(to.clone(), token.clone());

        // Check if lock exists
        let lock_info: LockInfo = e
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NoLockFound)?;

        // Check if lock has expired
        let current_ledger = e.ledger().sequence();
        if current_ledger < lock_info.unlock_ledger {
            return Err(Error::LockNotExpired);
        }

        // Get the contract address
        let lock_contract = e.current_contract_address();

        // Transfer tokens back to the user
        let token_client = token::TokenClient::new(&e, &token);
        token_client.transfer(&lock_contract, &to, &lock_info.amount);

        // Remove the lock from storage
        e.storage().persistent().remove(&key);

        Ok(lock_info.amount)
    }

    /// Get lock information for a user and token.
    ///
    /// # Arguments
    /// * `e` - The environment
    /// * `user` - The address of the user
    /// * `token` - The address of the token contract
    ///
    /// # Returns
    /// * `Option<LockInfo>` - The lock info if it exists, None otherwise
    pub fn get_lock(e: Env, user: Address, token: Address) -> Option<LockInfo> {
        let key = DataKey::Lock(user, token);
        e.storage().persistent().get(&key)
    }

    /// Check if a lock is expired and can be released.
    ///
    /// # Arguments
    /// * `e` - The environment
    /// * `user` - The address of the user
    /// * `token` - The address of the token contract
    ///
    /// # Returns
    /// * `bool` - True if the lock exists and is expired, false otherwise
    pub fn is_lock_expired(e: Env, user: Address, token: Address) -> bool {
        let key = DataKey::Lock(user.clone(), token.clone());
        if let Some(lock_info) = e.storage().persistent().get::<DataKey, LockInfo>(&key) {
            e.ledger().sequence() >= lock_info.unlock_ledger
        } else {
            false
        }
    }

    /// Get the current ledger sequence number.
    ///
    /// # Arguments
    /// * `e` - The environment
    ///
    /// # Returns
    /// * `u32` - The current ledger sequence number
    pub fn current_ledger(e: Env) -> u32 {
        e.ledger().sequence()
    }
}
