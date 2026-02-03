use soroban_sdk::{
    contract, contractimpl, symbol_short, Address, Env, MuxedAddress, String, Symbol,
};
use stellar_tokens::fungible::{burnable::FungibleBurnable, Base, FungibleToken};

pub const OWNER: Symbol = symbol_short!("OWNER");

#[contract]
pub struct AToken;

#[contractimpl]
impl AToken {
    pub fn __constructor(
        e: &Env,
        name: String,
        symbol: String,
        owner: Address,
        initial_supply: i128,
    ) {
        Base::set_metadata(e, 18, name, symbol);
        Base::mint(e, &owner, initial_supply);

        e.storage().instance().set(&OWNER, &owner);
    }

    pub fn mint(e: &Env, to: Address, amount: i128) {
        let owner: Address = e
            .storage()
            .instance()
            .get(&OWNER)
            .expect("OWNER SHOULD BE SET");
        owner.require_auth();

        Base::mint(e, &to, amount);
    }
}

#[contractimpl]
impl FungibleToken for AToken {
    type ContractType = Base;

    fn transfer(e: &Env, from: Address, to: MuxedAddress, amount: i128) {
        Self::ContractType::transfer(e, &from, &to, amount);
    }

    fn transfer_from(e: &Env, spender: Address, from: Address, to: Address, amount: i128) {
        Self::ContractType::transfer_from(e, &spender, &from, &to, amount);
    }

    fn balance(e: &Env, account: Address) -> i128 {
        Self::ContractType::balance(e, &account)
    }

    fn total_supply(e: &Env) -> i128 {
        Self::ContractType::total_supply(e)
    }

    fn symbol(e: &Env) -> String {
        Self::ContractType::symbol(e)
    }

    fn name(e: &Env) -> String {
        Self::ContractType::name(e)
    }

    fn decimals(e: &Env) -> u32 {
        Self::ContractType::decimals(e)
    }

    fn approve(e: &Env, owner: Address, spender: Address, amount: i128, live_until_ledger: u32) {
        Self::ContractType::approve(e, &owner, &spender, amount, live_until_ledger);
    }
}

#[contractimpl]
impl FungibleBurnable for AToken {
    fn burn(e: &Env, from: Address, amount: i128) {
        Self::ContractType::burn(e, &from, amount);
    }

    fn burn_from(e: &Env, spender: Address, from: Address, amount: i128) {
        Self::ContractType::burn_from(e, &spender, &from, amount);
    }
}
