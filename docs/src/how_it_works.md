# How It Works

Rotor uses a combination of cryptographic commitments, Merkle trees, and zero-knowledge proofs to provide privacy for Stellar transactions.

## Overview

The protocol consists of two main operations:

1. **Deposit**: Lock assets in the protocol with a cryptographic commitment
2. **Withdrawal**: Prove ownership and withdraw to a new address without revealing which deposit

## The Deposit Process

### Step 1: Generate Secrets

When you want to make a private deposit, you first generate two random values:
- **Secret**: A random value known only to you
- **Nullifier**: Another random value that will later prevent double-spending

### Step 2: Create Commitment

These values are combined using the Poseidon hash function to create a **commitment**:

```
commitment = Poseidon2(nullifier, secret)
```

This commitment acts as a cryptographic fingerprint that proves you made a deposit, without revealing your secrets.

### Step 3: Deposit Assets

You send your assets to the Rotor smart contract along with your commitment. The contract:
- Accepts your deposit
- Stores the commitment in a Merkle tree
- Associates the deposit with your commitment (not your address)

At this point, your assets are locked in the protocol, but there's no public link between your address and the commitment.

## The Merkle Tree

All commitments are stored in a **Merkle tree**, a cryptographic data structure that allows efficient proof of membership. Each time a new deposit is made, a new leaf is added to the tree.

The Merkle tree enables you to prove that your commitment exists in the set of all deposits without revealing which specific deposit is yours.

## The Withdrawal Process

### Step 1: Choose Recipient

Decide which address should receive the withdrawn assets. This can be a completely new address with no connection to your deposit address.

### Step 2: Generate Zero-Knowledge Proof

Using your secret and nullifier, you generate a zero-knowledge proof that demonstrates:

1. **You know a valid commitment**: Your secret and nullifier produce a commitment that exists in the Merkle tree
2. **You haven't withdrawn before**: You provide a nullifier hash that hasn't been used
3. **You want to withdraw to a specific address**: You specify the recipient

The proof confirms all this **without revealing**:
- Which commitment is yours
- Your original secret or nullifier
- Any link to your deposit address

### Step 3: Submit Withdrawal

You submit to the contract:
- The zero-knowledge proof
- The nullifier hash (to prevent double-spending)
- The recipient address
- The current Merkle root

### Step 4: Contract Verification

The Rotor smart contract verifies:
1. **Proof is valid**: The zero-knowledge proof checks out
2. **Nullifier is unused**: This specific nullifier hash hasn't been used before
3. **Merkle root matches**: The proof uses the current state of the tree

If all checks pass, the contract:
- Records the nullifier hash (preventing reuse)
- Transfers the assets to the recipient address

## Anonymity Set

The privacy you gain depends on the **anonymity set**—the number of deposits in the pool. The more people use Rotor, the harder it is to link deposits to withdrawals.

If there are 100 deposits and you withdraw, an observer only knows you're one of those 100 depositors, giving you 1-in-100 privacy.

## Security Guarantees

### Cryptographic Security

- **Poseidon Hash**: Optimized for zero-knowledge proofs, collision-resistant
- **Zero-Knowledge Proofs**: Mathematically proven to reveal nothing beyond validity
- **Nullifiers**: Prevent double-spending without revealing identity

### Smart Contract Security

- The contract never knows which deposit belongs to which withdrawal
- Assets are always accounted for—no funds can be created or destroyed
- Nullifiers are permanently recorded to prevent reuse

## Privacy Considerations

### What Rotor Protects

✅ Link between deposit address and withdrawal address  
✅ Which specific commitment belongs to you  
✅ Your secrets and nullifiers  
✅ Transaction graph analysis  

### What Rotor Doesn't Protect

❌ Deposit and withdrawal amounts (currently visible on-chain)  
❌ Timing correlation (if you deposit and immediately withdraw)  
❌ Network-level metadata (IP addresses)  
❌ Improper secret management by users  

## Best Practices

For maximum privacy:

1. **Wait Before Withdrawing**: Let more deposits accumulate to increase the anonymity set
2. **Use New Addresses**: Always withdraw to fresh addresses with no connection to your deposit address
3. **Vary Amounts**: Consider depositing and withdrawing in standard denominations
4. **Secure Your Secrets**: Your secret and nullifier are the keys to your funds—store them safely
5. **Use Privacy Tools**: Access Rotor through Tor or VPN to protect network-level privacy

## Technical Deep Dive

For developers interested in the cryptographic details, see:
- [ZK Circuit Architecture](./architecture/zk_circuit.md)
- [Smart Contract Implementation](./architecture/smart_contracts.md)
- [Cryptographic Primitives](./reference/cryptography.md)
