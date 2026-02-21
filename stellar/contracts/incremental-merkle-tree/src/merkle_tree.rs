use soroban_poseidon::poseidon2_hash;
use soroban_sdk::{
    contract, contractimpl, contracttype, crypto::BnScalar, log, vec, Address, BytesN, Env, U256,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
#[contracttype]
pub enum DataKey {
    Admin,              // Address: contract admin
    Depth,              // u32: tree depth
    NextLeafIndex,      // u32: next leaf to insert
    CurrentRootIndex,   // u32: position in root ring buffer
    CachedSubtree(u32), // BytesN<32>: cached subtree at level i
    Root(u32),          // BytesN<32>: root at ring buffer position i
    Leaf(u32),          // BytesN<32>: commitment at leaf index i
}

const ROOT_HISTORY_SIZE: u32 = 30;

// ---------------------------------------------------------------------------
// Precomputed zero hashes for the empty Merkle tree (depth 20).
//
// zeros(0) = keccak256("cyfrin") % BN254_FIELD_SIZE
// zeros(i+1) = Poseidon2(zeros(i), zeros(i))
//
// These MUST match the Poseidon2 hash used in the Noir circuit.
// ---------------------------------------------------------------------------
const ZEROS: [[u8; 32]; 20] = [
    hex("0d823319708ab99ec915efd4f7e03d11ca1790918e8f04cd14100aceca2aa9ff"),
    hex("170a9598425eb05eb8dc06986c6afc717811e874326a79576c02d338bdf14f13"),
    hex("273b1a40397b618dac2fc66ceb71399a3e1a60341e546e053cbfa5995e824caf"),
    hex("16bf9b1fb2dfa9d88cfb1752d6937a1594d257c2053dff3cb971016bfcffe2a1"),
    hex("1288271e1f93a29fa6e748b7468a77a9b8fc3db6b216ce5fc2601fc3e9bd6b36"),
    hex("1d47548adec1068354d163be4ffa348ca89f079b039c9191378584abd79edeca"),
    hex("0b98a89e6827ef697b8fb2e280a2342d61db1eb5efc229f5f4a77fb333b80bef"),
    hex("231555e37e6b206f43fdcd4d660c47442d76aab1ef552aef6db45f3f9cf2e955"),
    hex("03d0dc8c92e2844abcc5fdefe8cb67d93034de0862943990b09c6b8e3fa27a86"),
    hex("1d51ac275f47f10e592b8e690fd3b28a76106893ac3e60cd7b2a3a443f4e8355"),
    hex("16b671eb844a8e4e463e820e26560357edee4ecfdbf5d7b0a28799911505088d"),
    hex("115ea0c2f132c5914d5bb737af6eed04115a3896f0d65e12e761ca560083da15"),
    hex("139a5b42099806c76efb52da0ec1dde06a836bf6f87ef7ab4bac7d00637e28f0"),
    hex("0804853482335a6533eb6a4ddfc215a08026db413d247a7695e807e38debea8e"),
    hex("2f0b264ab5f5630b591af93d93ec2dfed28eef017b251e40905cdf7983689803"),
    hex("170fc161bf1b9610bf196c173bdae82c4adfd93888dc317f5010822a3ba9ebee"),
    hex("0b2e7665b17622cc0243b6fa35110aa7dd0ee3cc9409650172aa786ca5971439"),
    hex("12d5a033cbeff854c5ba0c5628ac4628104be6ab370699a1b2b4209e518b0ac5"),
    hex("1bc59846eb7eafafc85ba9a99a89562763735322e4255b7c1788a8fe8b90bf5d"),
    hex("1b9421fbd79f6972a348a3dd4721781ec25a5d8d27342942ae00aba80a3904d4"),
];

// ---------------------------------------------------------------------------
// Compile-time hex decoder
// ---------------------------------------------------------------------------
const fn hex(s: &str) -> [u8; 32] {
    let b = s.as_bytes();
    let mut out = [0u8; 32];
    let mut i = 0;
    while i < 32 {
        out[i] = (hex_digit(b[i * 2]) << 4) | hex_digit(b[i * 2 + 1]);
        i += 1;
    }
    out
}

const fn hex_digit(c: u8) -> u8 {
    match c {
        b'0'..=b'9' => c - b'0',
        b'a'..=b'f' => c - b'a' + 10,
        b'A'..=b'F' => c - b'A' + 10,
        _ => panic!("invalid hex"),
    }
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------
#[contract]
pub struct IncrementalMerkleTree;

#[contractimpl]
impl IncrementalMerkleTree {
    /// Initialize the Merkle tree with the given depth.
    ///
    /// - `admin`: address authorized to insert leaves
    /// - `depth`: tree depth (max 20, determines max leaves = 2^depth)
    pub fn __constructor(env: Env, admin: Address, depth: u32) {
        assert!(depth > 0 && depth <= 20, "depth must be 1..=20");

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Depth, &depth);
        env.storage().instance().set(&DataKey::NextLeafIndex, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::CurrentRootIndex, &0u32);

        // Initial root = zeros(depth - 1) — root of an empty tree
        let initial_root = BytesN::from_array(&env, &ZEROS[depth as usize - 1]);
        env.storage()
            .persistent()
            .set(&DataKey::Root(0), &initial_root);
    }

    // -----------------------------------------------------------------------
    // WRITE FUNCTIONS
    // -----------------------------------------------------------------------

    /// Insert a leaf into the Merkle tree. Returns the leaf index.
    ///
    /// Only the admin can insert leaves.
    pub fn insert(env: Env, caller: Address, leaf: BytesN<32>) -> u32 {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        assert!(caller == admin, "only admin can insert");
        caller.require_auth();

        let depth: u32 = env.storage().instance().get(&DataKey::Depth).unwrap();
        let next_index: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextLeafIndex)
            .unwrap();

        let max_leaves = 1u32 << depth;
        assert!(next_index < max_leaves, "merkle tree is full");

        // Store the leaf
        env.storage()
            .persistent()
            .set(&DataKey::Leaf(next_index), &leaf);

        let mut current_index = next_index;
        let mut current_hash = leaf;

        for i in 0..depth {
            if current_index % 2 == 0 {
                // Even: current is left child, right sibling is zero at this level
                let right = BytesN::from_array(&env, &ZEROS[i as usize]);
                env.storage()
                    .persistent()
                    .set(&DataKey::CachedSubtree(i), &current_hash);
                current_hash = Self::hash_left_right(&env, &current_hash, &right);
            } else {
                // Odd: current is right child, left sibling is cached subtree
                let left: BytesN<32> = env
                    .storage()
                    .persistent()
                    .get(&DataKey::CachedSubtree(i))
                    .unwrap();
                current_hash = Self::hash_left_right(&env, &left, &current_hash);
            }
            current_index /= 2;
        }

        // Store the new root in the ring buffer
        let current_root_idx: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentRootIndex)
            .unwrap();
        let new_root_idx = (current_root_idx + 1) % ROOT_HISTORY_SIZE;

        env.storage()
            .instance()
            .set(&DataKey::CurrentRootIndex, &new_root_idx);
        env.storage()
            .persistent()
            .set(&DataKey::Root(new_root_idx), &current_hash);
        env.storage()
            .instance()
            .set(&DataKey::NextLeafIndex, &(next_index + 1));

        log!(&env, "Leaf inserted at index {}", next_index);

        next_index
    }

    // -----------------------------------------------------------------------
    // VIEW FUNCTIONS
    // -----------------------------------------------------------------------

    /// Check if a root exists in the root history (last 30 roots).
    pub fn is_known_root(env: Env, root: BytesN<32>) -> bool {
        let zero = BytesN::from_array(&env, &[0u8; 32]);
        if root == zero {
            return false;
        }

        let current_root_idx: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentRootIndex)
            .unwrap();

        let mut i = current_root_idx;
        loop {
            let stored: Option<BytesN<32>> = env.storage().persistent().get(&DataKey::Root(i));
            if let Some(r) = stored {
                if r == root {
                    return true;
                }
            }
            if i == 0 {
                i = ROOT_HISTORY_SIZE;
            }
            i -= 1;
            if i == current_root_idx {
                break;
            }
        }
        false
    }

    /// Get the latest Merkle root.
    pub fn get_latest_root(env: Env) -> BytesN<32> {
        let idx: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentRootIndex)
            .unwrap();
        env.storage().persistent().get(&DataKey::Root(idx)).unwrap()
    }

    /// Get the next leaf index (= total number of leaves inserted).
    pub fn get_next_index(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::NextLeafIndex)
            .unwrap()
    }

    /// Get the tree depth.
    pub fn get_depth(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Depth).unwrap()
    }

    /// Get a specific leaf by index.
    pub fn get_leaf(env: Env, index: u32) -> BytesN<32> {
        env.storage()
            .persistent()
            .get(&DataKey::Leaf(index))
            .expect("leaf not found")
    }

    /// Get the zero element at level i.
    pub fn get_zero(env: Env, level: u32) -> BytesN<32> {
        assert!((level as usize) < ZEROS.len(), "level out of bounds");
        BytesN::from_array(&env, &ZEROS[level as usize])
    }

    // -----------------------------------------------------------------------
    // INTERNAL: Poseidon2 hashing
    // -----------------------------------------------------------------------

    /// Hash two 32-byte field elements: Poseidon2(left, right)
    ///
    /// Matches Noir circuit: `Poseidon2::hash([left, right], 2)` with t=3.
    fn hash_left_right(env: &Env, left: &BytesN<32>, right: &BytesN<32>) -> BytesN<32> {
        let left_bytes = soroban_sdk::Bytes::from_slice(env, &left.to_array());
        let right_bytes = soroban_sdk::Bytes::from_slice(env, &right.to_array());

        let left_u256 = U256::from_be_bytes(env, &left_bytes);
        let right_u256 = U256::from_be_bytes(env, &right_bytes);

        let inputs = vec![env, left_u256, right_u256];
        let result: U256 = poseidon2_hash::<3, BnScalar>(env, &inputs);

        let result_bytes = result.to_be_bytes();
        let mut arr = [0u8; 32];
        for i in 0..32 {
            arr[i] = result_bytes.get(i as u32).unwrap();
        }
        BytesN::from_array(env, &arr)
    }

    /// Public wrapper for hash_left_right — useful for testing.
    pub fn hash_pair(env: Env, left: BytesN<32>, right: BytesN<32>) -> BytesN<32> {
        Self::hash_left_right(&env, &left, &right)
    }
}
