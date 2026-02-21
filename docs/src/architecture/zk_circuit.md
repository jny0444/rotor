# ZK Circuit

The zero-knowledge circuit is the cryptographic core of Rotor, enabling private withdrawals while proving transaction validity.

## Circuit Overview

**Language**: Noir  
**Proof System**: UltraPlonk  
**Location**: `/circuit/src/main.nr`

## Circuit Purpose

The circuit proves the following statements without revealing secrets:

1. **I know a valid commitment**: My secret and nullifier hash to a commitment in the Merkle tree
2. **I haven't withdrawn before**: My nullifier hash hasn't been used
3. **I want to withdraw to this address**: Bind the proof to a specific recipient

## Public Inputs

These values are visible on-chain:

```noir
root: pub Field,              // Current Merkle tree root
nullifier_hash: pub Field,     // Hash of nullifier  
recipient: pub Field,          // Recipient address
```

## Private Inputs

These values remain secret:

```noir
nullifier: Field,              // Secret nullifier
secret: Field,                 // Secret value
merkleProof: [Field; 20],      // Merkle proof path
is_even: [bool; 20],           // Path directions
```

## Circuit Logic

### Full Circuit (main.nr)

```noir
use poseidon::poseidon2::Poseidon2;
mod merkle_tree;

fn main(
    root: pub Field,
    nullifier_hash: pub Field,
    recipient: pub Field,
    // private inputs
    nullifier: Field,
    secret: Field,
    merkleProof: [Field; 20],
    is_even: [bool; 20],
) {
    // 1. Compute commitment from secrets
    let commitment: Field = Poseidon2::hash([nullifier, secret], 2);

    // 2. Verify nullifier hash
    let computed_nullifier_hash: Field = Poseidon2::hash([nullifier], 1);
    assert(computed_nullifier_hash == nullifier_hash);

    // 3. Verify Merkle proof
    let computed_root = merkle_tree::calculate_merkle_root(
        commitment,
        merkleProof,
        is_even
    );
    assert(computed_root == root);

    // 4. Bind to recipient (prevents proof reuse)
    let _binding = Poseidon2::hash([secret, recipient], 2);
}
```

### Step-by-Step Breakdown

#### Step 1: Commitment Computation

```noir
let commitment: Field = Poseidon2::hash([nullifier, secret], 2);
```

**Purpose**: Recreate the commitment from secrets  
**Why**: Proves you know the preimage of a commitment  
**Security**: Poseidon2 is collision-resistant

#### Step 2: Nullifier Hash Verification

```noir
let computed_nullifier_hash: Field = Poseidon2::hash([nullifier], 1);
assert(computed_nullifier_hash == nullifier_hash);
```

**Purpose**: Prove nullifier hashes correctly  
**Why**: Contract needs nullifier hash to prevent double-spend  
**Security**: Reveals nullifier hash but not nullifier itself

#### Step 3: Merkle Proof Verification

```noir
let computed_root = merkle_tree::calculate_merkle_root(
    commitment,
    merkleProof,
    is_even
);
assert(computed_root == root);
```

**Purpose**: Prove commitment exists in Merkle tree  
**Why**: Validates you made a legitimate deposit  
**Security**: Can't fake membership without breaking Merkle tree

#### Step 4: Recipient Binding

```noir
let _binding = Poseidon2::hash([secret, recipient], 2);
```

**Purpose**: Bind proof to specific recipient  
**Why**: Prevents proof replay to different addresses  
**Security**: Anyone intercepting proof can't redirect funds

## Merkle Tree Module

### Implementation

```noir
pub fn calculate_merkle_root(
    leaf: Field,
    proof: [Field; 20],
    is_even: [bool; 20]
) -> Field {
    let mut current = leaf;
    
    for i in 0..20 {
        if is_even[i] {
            // Current is left child
            current = Poseidon2::hash([current, proof[i]], 2);
        } else {
            // Current is right child
            current = Poseidon2::hash([proof[i], current], 2);
        }
    }
    
    current
}
```

**How it works:**
1. Start with leaf (commitment)
2. For each level of tree:
   - If leaf is left child: hash(current, sibling)
   - If leaf is right child: hash(sibling, current)
3. After 20 iterations, reach root

**Tree Depth:** 20 levels = 2^20 = 1,048,576 possible leaves

## Poseidon Hash Function

### Why Poseidon?

Standard hash functions like SHA-256 are expensive in zero-knowledge circuits:
- SHA-256: ~25,000 constraints
- Poseidon2: ~150 constraints

Poseidon is designed specifically for ZK circuits.

### Security Properties

- **Collision Resistant**: Hard to find two inputs with same output
- **Preimage Resistant**: Hard to find input given output
- **Second Preimage Resistant**: Hard to find different input with same output

### Usage in Rotor

```noir
// Commitment (2 inputs)
Poseidon2::hash([nullifier, secret], 2)

// Nullifier hash (1 input)
Poseidon2::hash([nullifier], 1)

// Recipient binding (2 inputs)
Poseidon2::hash([secret, recipient], 2)

// Merkle tree nodes (2 inputs)
Poseidon2::hash([left, right], 2)
```

## Proof Generation

### Process

1. **User provides secrets**: nullifier, secret
2. **Backend provides Merkle proof**: path and siblings
3. **Frontend generates proof**:
   ```typescript
   const proof = await generateProof({
     root,
     nullifier_hash,
     recipient,
     nullifier,
     secret,
     merkleProof,
     is_even
   });
   ```
4. **Proof is serialized**: ~200KB
5. **Submitted to blockchain**: Contract verifies

### Performance

- **Generation Time**: 30-60 seconds (browser)
- **Verification Time**: <100ms (on-chain)
- **Proof Size**: ~200KB
- **Memory Usage**: ~1GB during generation

### Optimization Tips

- Use Web Workers to avoid blocking UI
- Show progress bar
- Cache compiled circuit
- Use WASM for better performance

## Proof Verification

### On-Chain Verification

The smart contract verifies proofs:

```rust
fn verify_proof(
    proof: &Bytes,
    public_inputs: &[Field]
) -> bool {
    // Public inputs: [root, nullifier_hash, recipient]
    soroban_sdk::crypto::verify_proof(proof, public_inputs)
}
```

### Verification Steps

1. **Parse proof**: Deserialize from bytes
2. **Check public inputs**: Match on-chain values
3. **Verify pairing equation**: UltraPlonk verification
4. **Return result**: true if valid

### Why Verification is Fast

Verification only requires:
- Small number of pairings
- Simple arithmetic
- No constraint solving

Generation is slow because it requires:
- Solving all constraints
- Computing witness
- Creating proof commitment

## Circuit Compilation

### Build Circuit

```bash
cd circuit
nargo compile
```

Outputs:
- `target/main.json`: Circuit description
- Proving and verification keys

### Generate Verification Key

```bash
nargo codegen-verifier
```

Generate Solidity/Rust verifier code.

## Security Considerations

### Circuit Bugs

**Risk**: Bugs in circuit allow invalid proofs  
**Mitigation**: Extensive testing, formal verification, audits

### Underconstrained Circuits

**Risk**: Missing constraints allow unintended solutions  
**Example**: Forgetting to check nullifier hash
**Mitigation**: Comprehensive test cases, proof-of-concept attacks

### Trusted Setup

**Risk**: UltraPlonk requires trusted setup  
**Mitigation**: Use ceremony with many participants  
**Status**: Noir uses universal setup, more secure

### Side Channels

**Risk**: Proof generation timing leaks information  
**Mitigation**: Constant-time operations, timing analysis  
**Status**: Not a major concern for privacy (proof is public)

## Testing

### Unit Tests

```bash
nargo test
```

Tests individual functions:
- Poseidon hashing
- Merkle root calculation
- Circuit constraints

### Integration Tests

```typescript
test('Valid proof verifies', async () => {
  const secrets = generateSecrets();
  const commitment = computeCommitment(secrets);
  
  // Make deposit
  await deposit(commitment);
  
  // Get Merkle proof
  const proof = await getMerkleProof(commitment);
  
  // Generate ZK proof
  const zkProof = await generateProof({ ...secrets, ...proof });
  
  // Verify
  expect(await verifyProof(zkProof)).toBe(true);
});

test('Invalid nullifier rejected', async () => {
  const secrets = generateSecrets();
  const wrongNullifier = generateRandomField();
  
  // Try to generate proof with wrong nullifier
  await expect(
    generateProof({ ...secrets, nullifier: wrongNullifier })
  ).rejects.toThrow();
});
```

## Future Improvements

### Smaller Proofs

- Use recursive SNARKs
- Proof aggregation
- More efficient proof systems (Halo2, Plonky2)

### Faster Proving

- GPU acceleration
- Distributed proving
- Incremental verification

### Enhanced Privacy

- Hide amounts with range proofs
- Stealth addresses
- Multi-asset commitments

## Related Documentation

- [Smart Contracts](./smart_contracts.md)
- [Cryptographic Primitives](../reference/cryptography.md)
- [Circuit Development Guide](../developer_guide/circuits.md)
