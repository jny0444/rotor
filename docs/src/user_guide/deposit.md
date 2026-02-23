# Making a Deposit

Depositing in Rotor is a two-step process: you transfer XLM into the shielded pool, then register your commitment on-chain.

## What is a commitment?

A **commitment** is a cryptographic hash that proves ownership of a deposit without revealing the deposit value or your identity:

```
commitment = Poseidon2(nullifier, secret, amount)
```

The `nullifier` and `secret` are 32-byte random values generated in your browser. You keep them private — they are your *withdrawal credentials*.

## How the deposit works in the UI

When you press **Send** on the frontend:

1. **Generate credentials**: The browser generates a random `nullifier` and `secret`.
2. **Compute commitment**: `commitment = Poseidon2(nullifier, secret, amount)`.
3. **Fund the pool**: Your wallet calls the XLM Stellar Asset Contract (`transfer(you → rotor_contract, amount)`). This is a standard signed transaction requiring your wallet approval.
4. **Register commitment**: The frontend calls `deposit(commitment)` on the `rotor-core` contract. The contract inserts the commitment as a leaf in its incremental Merkle tree and emits an event.

After this, your XLM is inside the shielded pool and your commitment is in the Merkle tree. **No one can link the deposit to the future withdrawal.**

## The withdrawal note

After a successful deposit, you receive a **withdrawal note**:

```json
{
  "nullifier": "0x...",
  "secret": "0x...",
  "nullifierHash": "0x...",
  "amountStroops": 10000000,
  "amountField": "0x..."
}
```

> **This note is your money.** Back it up somewhere safe. It is never stored on-chain or on any server. If you lose it, the funds cannot be recovered.

## What not to do

- Do **not** share the note with anyone you don't want to receive the funds.
- Do **not** use a custodial wallet for depositing — the note is stored in browser memory and may be lost if the page crashes before you copy it.
- Do **not** close the success card before copying the note.
