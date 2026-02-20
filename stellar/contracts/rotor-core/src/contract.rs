use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct RotorCore;

#[contractimpl]
impl RotorCore {
    pub fn deposit(e: &Env, amount: i128) {}

    pub fn withdraw() {}
}
