use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// No lock exists for this user and token
    NoLockFound = 1,
    /// The unlock time has not been reached yet
    LockNotExpired = 2,
    /// The amount to lock must be greater than zero
    InvalidAmount = 3,
    /// The unlock ledger must be in the future
    InvalidUnlockLedger = 4,
    /// A lock already exists for this user and token
    LockAlreadyExists = 5,
}
