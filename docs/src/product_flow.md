# 2. Product Flow

Rotor flow is two user actions and one relayer action.

## Step A: Fund contract (frontend)

Frontend calls Stellar Asset Contract `transfer(from=user, to=rotor_contract, amount)`.

- This moves tokens first.
- This is a normal signed transaction from the user wallet.

## Step B: Store commitment (frontend)

Frontend calls `deposit(depositor, commitment)`.

- `deposit` does not accept amount.
- Contract inserts commitment into Merkle tree.

## Step C: Withdraw (relayer)

Frontend computes proof and sends it to relayer:

- `proof`
- `publicInputs = [root, nullifier_hash, recipient, amount_field]`

Relayer verifies proof off-chain, then calls:

- `withdraw(nullifier_hash, recipient, proof_amount_bytes32)`

Contract derives amount from `proof_amount_bytes32`, checks nullifier, and transfers funds.
