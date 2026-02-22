#![cfg(test)]
#![cfg(test)]
extern crate alloc;

use crate::merkle_tree::{IncrementalMerkleTree, IncrementalMerkleTreeClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

#[test]
fn test_tree_initialization() {
    let env = Env::default();
    let admin = Address::generate(&env);

    // Register the contract
    let contract_id = env.register(IncrementalMerkleTree, (&admin, 20u32));
    let client = IncrementalMerkleTreeClient::new(&env, &contract_id);

    // Check initial state
    assert_eq!(client.get_depth(), 20, "Depth should be initialized to 20");
    assert_eq!(client.get_next_index(), 0, "Next leaf index should be 0");

    let root = client.get_latest_root();
    // The zero root for depth 20 (it's the 19th index in the ZEROS array logically, or 20-1)
    let expected_zero = client.get_zero(&19);
    assert_eq!(
        root, expected_zero,
        "Initial root should match the precomputed zero hash for depth 20"
    );
}

#[test]
fn test_tree_insertion() {
    let env = Env::default();
    env.mock_all_auths(); // Allow the admin to call auth-required functions

    let admin = Address::generate(&env);
    let contract_id = env.register(IncrementalMerkleTree, (&admin, 20u32));
    let client = IncrementalMerkleTreeClient::new(&env, &contract_id);

    // Insert a leaf
    let leaf = BytesN::from_array(&env, &[1u8; 32]);
    let index = client.insert(&admin, &leaf);

    assert_eq!(index, 0, "First leaf should be at index 0");
    assert_eq!(
        client.get_next_index(),
        1,
        "Next index should be updated to 1"
    );

    let stored_leaf = client.get_leaf(&0);
    assert_eq!(stored_leaf, leaf, "Stored leaf should match inserted leaf");

    let root = client.get_latest_root();
    let expected_zero = client.get_zero(&19);
    assert_ne!(root, expected_zero, "Root should change after insertion");
}
