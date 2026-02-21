# Introduction

## What is Rotor?

Rotor is a privacy-focused payments protocol built on the Stellar blockchain that leverages zero-knowledge (ZK) proofs to enable confidential transactions. By breaking the on-chain link between depositor and recipient addresses, Rotor allows users to transfer assets while preserving their financial privacy.

## Why Privacy Matters

While blockchain technology offers transparency and immutability, it also exposes all transaction details publicly. This lack of privacy can be problematic for:

- **Individuals** who want to keep their financial activities confidential
- **Businesses** that need to protect sensitive transaction data from competitors
- **Users** concerned about being tracked or profiled based on their on-chain activity

Rotor addresses these concerns by providing a trustless, non-custodial privacy layer for Stellar assets.

## How It Works

Rotor uses cryptographic techniques to ensure privacy:

1. **Deposits**: Users deposit assets into the Rotor protocol along with a cryptographic commitment (derived from a secret and nullifier using Poseidon hashing)
2. **Merkle Tree**: All commitments are stored in a Merkle tree, creating a set of anonymous deposits
3. **Withdrawals**: To withdraw, users provide a zero-knowledge proof that demonstrates they know a valid secret without revealing which deposit is theirs
4. **Nullifiers**: Each withdrawal uses a nullifier hash to prevent double-spending while maintaining anonymity

The zero-knowledge circuit ensures that withdrawals can only be made by legitimate depositors while keeping their identity private.

## Technical Architecture

Rotor consists of four main components:

- **Stellar Smart Contracts (Soroban)**: Core protocol logic handling deposits, withdrawals, and state management
- **ZK Circuit (Noir)**: Zero-knowledge proof system that verifies withdrawal validity without revealing sensitive information
- **Backend (Go)**: API server coordinating between the blockchain and client
- **Frontend (Next.js)**: User-friendly web interface for interacting with the protocol

## Key Features

- **Privacy-Preserving**: Break the on-chain link between sender and receiver
- **Non-Custodial**: Users maintain full control of their assets
- **Zero-Knowledge Proofs**: Cryptographically secure without revealing transaction details
- **Stellar-Native**: Built on Stellar's fast and low-cost infrastructure
- **Open Source**: Transparent and auditable codebase