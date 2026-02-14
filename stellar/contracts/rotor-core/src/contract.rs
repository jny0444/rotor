use soroban_sdk::{contract, contractimpl};

#[contract]
pub struct RotorCore;

#[contractimpl]
impl RotorCore {
    pub fn deposit() {}

    pub fn withdraw() {}
}