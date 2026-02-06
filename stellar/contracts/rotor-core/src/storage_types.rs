use soroban_sdk::{contracttype, Address};

/// Storage keys for the contract
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Key for storing lock info for a specific user and token
    /// (user_address, token_address) -> LockInfo
    Lock(Address, Address),
    /// Key for storing admin address
    Admin,
}

/// Information about a token lock
#[derive(Clone)]
#[contracttype]
pub struct LockInfo {
    /// Amount of tokens locked
    pub amount: i128,
    /// Ledger sequence number when tokens can be unlocked
    pub unlock_ledger: u32,
}
