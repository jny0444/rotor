use soroban_sdk::{Env, contract, contractimpl};

#[contract]
pub struct RotorCore;

#[contractimpl]
impl RotorCore {
    pub fn deposit(e: &Env, amount: i128) {
        
    }

    pub fn withdraw() {}
}