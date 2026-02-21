# Smart Contracts

Rotor's smart contracts are written in Rust using the Soroban SDK and deployed on the Stellar blockchain.

## Contract Overview

The main Rotor protocol consists of three contracts:

### rotor-core
**Purpose**: Main privacy protocol  
**Location**: `/stellar/contracts/rotor-core`

**Responsibilities:**
- Accept and manage deposits
- Verify zero-knowledge proofs
- Maintain Merkle tree of commitments
- Track used nullifiers
- Transfer assets to recipients

### a-token & b-token
**Purpose**: Example Stellar assets for testing  
**Location**: `/stellar/contracts/{a-token,b-token}`

**Responsibilities:**
- Token minting for testing
- Token transfers
- Balance management

## Contract Structure

### File Organization

```
rotor-core/
├── Cargo.toml          # Dependencies and metadata
├── Makefile            # Build and deployment scripts
└── src/
    ├── lib.rs          # Module exports
    ├── contract.rs     # Main contract logic
    └── test.rs         # Contract tests
```

## Core Contract Methods

### Initialization

```rust
pub fn initialize(e: Env) -> Result<(), Error>
```

**Purpose**: Initialize the contract with default state  
**Called**: Once at deployment  
**Parameters**: Environment  
**Returns**: Success or error

**What it does:**
- Sets up initial Merkle tree
- Initializes nullifier storage
- Sets contract admin
- Configures parameters

### Deposit

```rust
pub fn deposit(
    e: Env,
    amount: i128,
    commitment: BytesN<32>
) -> Result<u32, Error>
```

**Purpose**: Accept a deposit and add commitment to Merkle tree  
**Called**: By users making deposits  

**Parameters:**
- `e`: Environment (Soroban context)
- `amount`: Amount of asset to deposit
- `commitment`: Poseidon2 hash of (nullifier, secret)

**Returns:**
- Leaf index in Merkle tree

**Process:**
1. Validate amount > 0
2. Transfer assets from caller to contract
3. Add commitment to Merkle tree
4. Emit deposit event
5. Return leaf index

**Events Emitted:**
```rust
DepositEvent {
    commitment: BytesN<32>,
    leaf_index: u32,
    timestamp: u64
}
```

### Withdraw

```rust
pub fn withdraw(
    e: Env,
    proof: Bytes,
    nullifier_hash: BytesN<32>,
    recipient: Address,
    root: BytesN<32>
) -> Result<(), Error>
```

**Purpose**: Verify proof and transfer assets to recipient  
**Called**: By users making withdrawals  

**Parameters:**
- `e`: Environment
- `proof`: Zero-knowledge proof (serialized)
- `nullifier_hash`: Hash of nullifier (prevents double-spend)
- `recipient`: Address to receive funds
- `root`: Merkle root used in proof

**Returns:**
- Success or error

**Process:**
1. Check nullifier hasn't been used
2. Verify Merkle root is valid (current or recent)
3. Verify zero-knowledge proof
4. Mark nullifier as used
5. Transfer assets to recipient
6. Emit withdrawal event

**Events Emitted:**
```rust
WithdrawalEvent {
    nullifier_hash: BytesN<32>,
    recipient: Address,
    timestamp: u64
}
```

### Get Current Root

```rust
pub fn get_root(e: Env) -> BytesN<32>
```

**Purpose**: Get the current Merkle tree root  
**Called**: By frontend before generating proof  
**Returns**: Current Merkle root

### Check Nullifier

```rust
pub fn is_nullifier_used(
    e: Env,
    nullifier_hash: BytesN<32>
) -> bool
```

**Purpose**: Check if a nullifier has been used  
**Called**: By frontend to prevent double-spend  
**Returns**: true if used, false otherwise

## Data Structures

### Storage Layout

```rust
// Merkle tree commitments
const COMMITMENTS: Symbol = symbol_short!("commits");

// Used nullifiers
const NULLIFIERS: Symbol = symbol_short!("nulls");

// Merkle tree roots (ring buffer)
const ROOTS: Symbol = symbol_short!("roots");

// Configuration
const CONFIG: Symbol = symbol_short!("config");
```

### Merkle Tree

The Merkle tree is stored as:
- **Leaves**: Map of `u32 -> BytesN<32>` (index -> commitment)
- **Roots**: Ring buffer of last N roots
- **Current Index**: Number of leaves

### Nullifier Set

Nullifiers are stored as:
- **Map**: `BytesN<32> -> bool` (nullifier_hash -> used)
- Once added, never removed

## Security Features

### Access Control

```rust
fn require_admin(e: &Env) -> Result<(), Error> {
    let admin = e.storage().get(&ADMIN)?;
    e.require_auth(&admin)?;
    Ok(())
}
```

Some functions require admin authorization:
- Contract upgrades
- Emergency pause
- Parameter updates

### Reentrancy Protection

Soroban provides built-in reentrancy protection. Recursive calls to the same contract are prevented at the platform level.

### Input Validation

All inputs are validated:
- Amounts must be positive
- Addresses must be valid
- Proofs must be well-formed
- Commitments must be 32 bytes

### Proof Verification

```rust
fn verify_proof(
    e: &Env,
    proof: &Bytes,
    public_inputs: &[BytesN<32>]
) -> Result<bool, Error> {
    // Verify using Soroban's proof verification
    // Public inputs: [root, nullifier_hash, recipient]
    soroban_sdk::crypto::verify_proof(e, proof, public_inputs)
}
```

## Gas Optimization

### Storage Optimization

- Use `Symbol` instead of `String` for keys
- Store commitments compactly
- Use ring buffer for roots (only keep last 100)

### Computation Optimization

- Merkle tree updates are O(log n)
- Nullifier checks are O(1) map lookups
- Proof verification is constant time

### Batching Operations

Future feature: Allow multiple deposits in one transaction

```rust
pub fn batch_deposit(
    e: Env,
    commitments: Vec<BytesN<32>>
) -> Result<Vec<u32>, Error>
```

## Events and Logging

### Event Types

```rust
#[contract_event]
pub struct DepositEvent {
    pub commitment: BytesN<32>,
    pub leaf_index: u32,
    pub timestamp: u64,
}

#[contract_event]
pub struct WithdrawalEvent {
    pub nullifier_hash: BytesN<32>,
    pub recipient: Address,
    pub timestamp: u64,
}
```

Events are critical for:
- Off-chain indexing
- User notifications
- Analytics and monitoring

## Testing

### Unit Tests

Located in `test.rs`:

```rust
#[test]
fn test_deposit() {
    let env = Env::default();
    let contract_id = env.register_contract(None, RotorCore);
    let client = RotorCoreClient::new(&env, &contract_id);
    
    let commitment = BytesN::from_array(&env, &[1u8; 32]);
    let result = client.deposit(&1000, &commitment);
    
    assert_eq!(result, 0); // First deposit at index 0
}
```

### Integration Tests

Test interaction with token contracts:

```rust
#[test]
fn test_deposit_with_token() {
    // Setup token contract
    // Mint tokens to user
    // Approve Rotor contract
    // Deposit through Rotor
    // Verify balances
}
```

### Proof Verification Tests

```rust
#[test]
fn test_valid_withdrawal() {
    // Make deposit
    // Generate valid proof off-chain
    // Submit withdrawal
    // Verify success
}

#[test]
fn test_invalid_proof_rejected() {
    // Make deposit
    // Generate invalid proof
    // Submit withdrawal
    // Verify rejection
}
```

## Deployment

### Build Contract

```bash
cd stellar/contracts/rotor-core
make build
```

Outputs: `target/wasm32-unknown-unknown/release/rotor_core.wasm`

### Deploy to Testnet

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/rotor_core.wasm \
  --network testnet \
  --source ADMIN_SECRET_KEY
```

### Initialize Contract

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --network testnet \
  --source ADMIN_SECRET_KEY \
  -- initialize
```

## Upgradeability

Soroban contracts can be upgraded:

```rust
pub fn upgrade(e: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
    require_admin(&e)?;
    e.deployer().update_current_contract_wasm(new_wasm_hash);
    Ok(())
}
```

**Upgrade Process:**
1. Deploy new WASM
2. Admin calls `upgrade` with new WASM hash
3. Contract code is replaced
4. Storage is preserved

**Safety:**
- Requires admin authorization
- Can be disabled for full decentralization
- Storage migrations must be backward compatible

## Future Enhancements

### Multi-Asset Support

```rust
pub fn deposit_asset(
    e: Env,
    asset: Address,
    amount: i128,
    commitment: BytesN<32>
) -> Result<u32, Error>
```

### Relayer Support

```rust
pub fn withdraw_with_relayer(
    e: Env,
    proof: Bytes,
    nullifier_hash: BytesN<32>,
    recipient: Address,
    relayer: Address,
    relayer_fee: i128
) -> Result<(), Error>
```

### Emergency Features

```rust
pub fn emergency_pause(e: Env) -> Result<(), Error>
pub fn emergency_unpause(e: Env) -> Result<(), Error>
```

## Best Practices

### For Developers

1. **Always validate inputs**: Check bounds, types, and values
2. **Emit events**: Enable off-chain tracking
3. **Write tests**: Comprehensive unit and integration tests
4. **Optimize storage**: Minimize on-chain data
5. **Document public functions**: Clear parameter descriptions

### For Auditors

1. **Check proof verification**: Ensure correct public inputs
2. **Verify nullifier tracking**: No double-spend vulnerabilities
3. **Audit access control**: Admin functions properly gated
4. **Test edge cases**: Empty tree, maximum size, etc.
5. **Review upgrade mechanism**: Safe upgrade path

## Related Documentation

- [ZK Circuit Design](./zk_circuit.md)
- [Contract Interface Reference](../reference/contract_interface.md)
- [Development Guide](../developer_guide/contracts.md)
