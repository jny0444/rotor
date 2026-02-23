# 3. Architecture

Keep architecture simple: 4 parts.

## 1) Soroban Contract (`rotor-core`)

- Stores commitments in Merkle tree
- Tracks spent nullifiers
- Handles withdraw transfer
- Derives amount from proof amount field bytes

## 2) Noir Circuit

Proves knowledge of a valid commitment path and binds:

- nullifier
- secret
- recipient
- amount

Public outputs include `nullifier_hash` and `amount_field`.

## 3) Relayer (TypeScript)

- Validates proof
- Extracts `amount_field` from public inputs
- Calls contract withdraw

## 4) Frontend (Next.js)

- Collects recipient + amount
- Sends fund tx
- Sends deposit tx
- Generates proof
- Calls relayer
- Shows final tx hashes
