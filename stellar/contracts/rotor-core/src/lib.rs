#![no_std]

mod contract;
mod error;
mod storage_types;

#[cfg(test)]
mod test;

pub use contract::RotorCoreClient;
pub use error::Error;
pub use storage_types::{DataKey, LockInfo};
