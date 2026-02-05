use soroban_sdk::{contract, contractimpl, token, Address, Env};

#[contract]
pub struct RotorCore {}

#[contractimpl]
impl RotorCore {
    pub fn lock(e: &Env, token: Address, from: Address, amount: i128, unlock_timestamp: u32) {
        from.require_auth();
        let lock_contract = e.current_contract_address();

        let token_client = token::TokenClient::new(e, &token);

        token_client.approve(&from, &from, &amount, &unlock_timestamp);
        token_client.transfer_from(&from, &from, &lock_contract, &amount);
    }
}
