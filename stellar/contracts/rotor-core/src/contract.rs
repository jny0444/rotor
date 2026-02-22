use soroban_poseidon::poseidon2_hash;
use soroban_sdk::{
    contract, contractimpl, contracttype, crypto::BnScalar, log, token, vec, Address, BytesN, Env,
    U256,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
#[contracttype]
pub enum DataKey {
    Relayer,            // Address: authorized relayer (submits withdrawals)
    Token,              // Address: SAC address for the deposited asset (e.g. native XLM)
    Depth,              // u32: tree depth (set once in constructor)
    NextLeafIndex,      // u32: next leaf to insert
    CurrentRootIndex,   // u32: position in root ring buffer
    CachedSubtree(u32), // BytesN<32>: cached subtree at level i
    Root(u32),          // BytesN<32>: root at ring buffer position i
    Leaf(u32),          // BytesN<32>: commitment at leaf index i
    Nullifier(BytesN<32>), // bool: whether a nullifier_hash has been spent
}

const ROOT_HISTORY_SIZE: u32 = 30;
const TREE_DEPTH: u32 = 20;

// ---------------------------------------------------------------------------
// Precomputed zero hashes for the empty Merkle tree.
//
// zeros(0) = keccak256("cyfrin") % BN254_FIELD_SIZE
// zeros(i+1) = Poseidon2(zeros(i), zeros(i))
//
// These MUST match the hash function used in the Noir circuit.
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
pub struct RotorCore;

#[contractimpl]
impl RotorCore {
    /// Initialize the mixer contract.
    ///
    /// - `relayer`: address authorized to submit withdrawals on behalf of recipients.
    /// - `token`:   SAC address for the deposited asset (native XLM on testnet:
    ///              CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC).
    pub fn __constructor(env: Env, relayer: Address, token: Address) {
        env.storage().instance().set(&DataKey::Relayer, &relayer);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Depth, &TREE_DEPTH);
        env.storage().instance().set(&DataKey::NextLeafIndex, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::CurrentRootIndex, &0u32);

        let initial_root = BytesN::from_array(&env, &ZEROS[TREE_DEPTH as usize - 1]);
        env.storage()
            .persistent()
            .set(&DataKey::Root(0), &initial_root);
    }

    // -----------------------------------------------------------------------
    // DEPOSIT
    // -----------------------------------------------------------------------

    /// Record a commitment in the Merkle tree.
    ///
    /// The token transfer is handled separately by the frontend — the user
    /// calls the SAC's `transfer()` directly to fund the contract, then
    /// calls this function to store the commitment on-chain.
    ///
    /// This keeps the deposit function free of amount information.
    pub fn deposit(env: Env, depositor: Address, commitment: BytesN<32>) -> u32 {
        depositor.require_auth();

        let leaf_index = Self::insert_leaf(&env, commitment.clone());

        log!(&env, "Deposit: leaf={}", leaf_index);

        leaf_index
    }

    // -----------------------------------------------------------------------
    // WITHDRAW
    // -----------------------------------------------------------------------

    /// Withdraw XLM from the mixer to a recipient.
    ///
    /// Called by the relayer AFTER verifying the ZK proof off-chain.
    ///
    /// `proof_amount` is the BN254 field element from the ZK proof's public
    /// inputs that encodes the withdrawal amount in stroops. The contract
    /// derives the actual i128 amount by interpreting the lower 16 bytes of
    /// the 32-byte big-endian field element.
    ///
    /// The contract:
    /// 1. Verifies the caller is the authorized relayer
    /// 2. Derives the amount from `proof_amount`
    /// 3. Ensures the nullifier has not been spent (prevents double-withdraw)
    /// 4. Marks the nullifier as spent
    /// 5. Transfers XLM from the contract to the recipient via SAC
    pub fn withdraw(
        env: Env,
        nullifier_hash: BytesN<32>,
        recipient: Address,
        proof_amount: BytesN<32>,
    ) {
        let relayer: Address = env
            .storage()
            .instance()
            .get(&DataKey::Relayer)
            .expect("relayer not set");
        relayer.require_auth();

        let amount = Self::field_to_amount(&proof_amount);
        assert!(amount > 0, "amount must be positive");

        let nullifier_key = DataKey::Nullifier(nullifier_hash.clone());
        let already_spent: bool = env
            .storage()
            .persistent()
            .get(&nullifier_key)
            .unwrap_or(false);
        assert!(!already_spent, "nullifier already spent");

        env.storage().persistent().set(&nullifier_key, &true);

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("token not set");
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &recipient, &amount);

        log!(
            &env,
            "Withdraw: recipient={}, amount={}",
            recipient,
            amount
        );
    }

    /// Interpret the lower 16 bytes of a 32-byte big-endian field element as i128.
    /// XLM amounts fit comfortably within i128 (max supply ~5×10^17 stroops).
    fn field_to_amount(field: &BytesN<32>) -> i128 {
        let arr = field.to_array();
        let mut v: i128 = 0;
        let mut i = 16usize;
        while i < 32 {
            v = (v << 8) | (arr[i] as i128);
            i += 1;
        }
        v
    }

    // -----------------------------------------------------------------------
    // VIEW FUNCTIONS
    // -----------------------------------------------------------------------

    pub fn get_latest_root(env: Env) -> BytesN<32> {
        let idx: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentRootIndex)
            .unwrap();
        env.storage().persistent().get(&DataKey::Root(idx)).unwrap()
    }

    pub fn get_next_index(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::NextLeafIndex)
            .unwrap()
    }

    pub fn is_valid_root(env: Env, root: BytesN<32>) -> bool {
        Self::is_known_root(&env, &root)
    }

    pub fn is_spent(env: Env, nullifier_hash: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Nullifier(nullifier_hash))
            .unwrap_or(false)
    }

    pub fn get_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .expect("token not set")
    }

    pub fn get_balance(env: Env) -> i128 {
        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("token not set");
        let token_client = token::Client::new(&env, &token_addr);
        token_client.balance(&env.current_contract_address())
    }

    // -----------------------------------------------------------------------
    // INTERNAL: Merkle tree operations
    // -----------------------------------------------------------------------

    fn insert_leaf(env: &Env, leaf: BytesN<32>) -> u32 {
        let next_index: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextLeafIndex)
            .unwrap();

        let max_leaves = 1u32 << TREE_DEPTH;
        assert!(next_index < max_leaves, "merkle tree is full");

        env.storage()
            .persistent()
            .set(&DataKey::Leaf(next_index), &leaf);

        let mut current_index = next_index;
        let mut current_hash = leaf;

        for i in 0..TREE_DEPTH {
            if current_index % 2 == 0 {
                let right = BytesN::from_array(env, &ZEROS[i as usize]);
                env.storage()
                    .persistent()
                    .set(&DataKey::CachedSubtree(i), &current_hash);
                current_hash = Self::hash_pair(env, &current_hash, &right);
            } else {
                let left: BytesN<32> = env
                    .storage()
                    .persistent()
                    .get(&DataKey::CachedSubtree(i))
                    .unwrap();
                current_hash = Self::hash_pair(env, &left, &current_hash);
            }
            current_index /= 2;
        }

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

        next_index
    }

    fn is_known_root(env: &Env, root: &BytesN<32>) -> bool {
        let zero = BytesN::from_array(env, &[0u8; 32]);
        if *root == zero {
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
                if r == *root {
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

    fn hash_pair(env: &Env, left: &BytesN<32>, right: &BytesN<32>) -> BytesN<32> {
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
}
