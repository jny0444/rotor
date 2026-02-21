use soroban_sdk::{contract, contractimpl, Bytes, BytesN, Env};

#[contract]
pub struct RotorCore;

#[contractimpl]
impl RotorCore {
    pub fn deposit(e: &Env, commitment: BytesN<32>) {}

    pub fn withdraw(e: &Env, proof: Bytes, root: BytesN<32>, nullifier_hash: BytesN<32>) {}
}
