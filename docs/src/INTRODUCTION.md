# Rotor

Rotor is a **private payments protocol on Stellar**. It lets you send XLM to any Stellar address without creating a publicly visible on-chain link between the sender and the recipient.

## The Core Idea

Rotor is a shielded pool. When you deposit, you receive a **withdrawal note** — a short JSON object you keep private. When you want the funds sent to another address, you present that note to Rotor, which generates a cryptographic proof that you are the rightful owner, and releases the funds to the destination without revealing the original deposit.

```
Alice deposits 1 XLM → contract ← no link → Bob receives 1 XLM
```

The proof is generated entirely in your browser using [Noir](https://noir-lang.org) circuits and the [Barretenberg](https://barretenberg.aztec.network) proving backend. No private key material ever leaves your device.

## Components

| Component | Description |
|---|---|
| **Client** | Next.js frontend — wallet connection, deposit UI, proof generation |
| **Relayer** | Node.js server — receives proof, verifies it, submits the on-chain withdrawal |
| **rotor-core** | Soroban smart contract — Merkle tree, nullifier tracking, XLM transfers |
| **Circuit** | Noir ZK circuit — proves knowledge of a valid commitment without revealing it |

## Threat Model

- The relayer is a **trusted service**: it verifies ZK proofs before submitting. It cannot steal funds, but it can censor withdrawals.
- The Soroban contract enforces **nullifier uniqueness** — no commitment can be withdrawn twice even if the relayer is compromised.
- The ZK proof hides which deposit corresponds to which withdrawal. On-chain, observers see only a commitment being inserted and later a nullifier being spent.

---

*If you only read one chapter, read **Quick Start**.*