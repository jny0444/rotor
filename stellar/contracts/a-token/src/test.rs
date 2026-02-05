use crate::contract::{AToken, ATokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn create_client<'a>(e: &Env, owner: &Address, initial_supply: i128) -> ATokenClient<'a> {
    let name = String::from_str(e, "After Token");
    let symbol = String::from_str(e, "AT");
    let address = e.register(AToken, (name, symbol, owner, initial_supply));

    ATokenClient::new(e, &address)
}

#[test]
fn initial_state() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner, 1000);

    assert_eq!(client.total_supply(), 1000);
    assert_eq!(client.balance(&owner), 1000);
    assert_eq!(client.symbol(), String::from_str(&e, "AT"));
    assert_eq!(client.name(), String::from_str(&e, "After Token"));
    assert_eq!(client.decimals(), 18);
}

#[test]
fn transfer_tokens() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);
    let client = create_client(&e, &owner, 1000);

    e.mock_all_auths();
    client.mint(&spender, &200);

    assert_eq!(client.balance(&spender), 200);

    client.approve(&spender, &owner, &200, &100);
    client.transfer_from(&owner, &spender, &recipient, &200);

    assert_eq!(client.balance(&spender), 0);
    assert_eq!(client.balance(&recipient), 200);

    assert_eq!(client.total_supply(), 1200);
}

#[test]
fn burn_tokens() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner, 1000);

    e.mock_all_auths();
    client.burn(&owner, &500);

    assert_eq!(client.total_supply(), 500);
    assert_eq!(client.balance(&owner), 500);
}

#[test]
fn mint_tokens() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner, 1000);

    e.mock_all_auths();
    client.mint(&owner, &500);

    assert_eq!(client.balance(&owner), 1500);
    assert_eq!(client.total_supply(), 1500);
}
