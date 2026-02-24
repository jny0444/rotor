# Rotor

**A privacy-focused payments protocol on Stellar.**

Rotor enables private XLM transfers using zero-knowledge proofs. Deposit into a shielded pool, receive a withdrawal note, and redeem to any address—without creating a public on-chain link between sender and recipient.

```
Alice deposits 1 XLM → shielded pool ← no link → Bob receives 1 XLM
```

---

## Features

| | |
|---|---|
| **Zero-knowledge privacy** | Prove ownership without revealing which deposit you're withdrawing |
| **Non-custodial** | You control your assets; the protocol cannot access or freeze funds |
| **Stellar-native** | Built on Soroban smart contracts—fast, low-cost, ecosystem-compatible |
| **Client-side proofs** | ZK proofs generated in your browser; secrets never leave your device |

---

## How It Works

1. **Deposit** — Generate a secret commitment, fund the contract, and record it in a Merkle tree. You receive a withdrawal note (keep it private).
2. **Withdraw** — Present your note to the relayer. It verifies your ZK proof off-chain and submits the on-chain withdrawal to your chosen recipient.

The Soroban contract enforces nullifier uniqueness (no double-spend) and transfers XLM via the Stellar Asset Contract. Observers see only commitments and nullifiers—not the link between them.

You can look at how it works [here](https://drive.google.com/file/d/1UnTBRe96erOuKY5XV1Oiz821UCMGL2ys/view?usp=sharing).

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Client         │     │   Relayer        │     │   rotor-core     │
│   (Next.js)      │────▶│   (Hono/Node)    │────▶│   (Soroban)      │
│                  │     │                  │     │                  │
│ • Wallet connect │     │ • Verify proofs  │     │ • Merkle tree    │
│ • Proof gen      │     │ • Submit withdraw│     │ • Nullifiers    │
│ • Deposit UI     │     │ • GET /root      │     │ • XLM transfer   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                         │                        │
         └─────────────────────────┴────────────────────────┘
                                  │
                         Stellar Blockchain
```

| Component | Stack | Description |
|-----------|-------|-------------|
| **Client** | Next.js, React, Stellar SDK | Wallet connection, deposit flow, ZK proof generation (Noir + bb.js) |
| **Relayer** | Hono, Node.js, Stellar SDK | Proof verification (UltraHonk), withdrawal submission |
| **rotor-core** | Rust, Soroban | Merkle tree, nullifier tracking, SAC transfers |
| **Circuit** | Noir | Commitment, Merkle path, nullifier hash, recipient binding |

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (npm or pnpm)
- **Rust** (stable) — for building Soroban contracts
- **Stellar CLI** — for deployment

```bash
# Install Stellar CLI
curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/stellar/stellar-cli/refs/heads/main/install.sh | sh
```

### 1. Clone & Install

```bash
git clone https://github.com/rotor/rotor.git
cd rotor
```

### 2. Configure Environment

**Client** (`client/.env.local`):

```env
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_RELAYER_URL=http://localhost:3001
NEXT_PUBLIC_ROTOR_CONTRACT_ID=<your-contract-id>
NEXT_PUBLIC_XLM_SAC_ID=<xlm-sac-contract-id>
```

**Relayer** (`relayer/.env`):

```env
PORT=3001
STELLAR_RPC=https://mainnet.sorobanrpc.com
HORIZON_URL=https://horizon.stellar.org
NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
CONTRACT_ID=<your-contract-id>
RELAYER_SECRET=<relayer-secret-key>
```

### 3. Start the Relayer

```bash
cd relayer
npm install
npm start
```

### 4. Start the Client

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying the Contract

From `stellar/`:

```bash
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/rotor_core.wasm \
  --source <your-identity> \
  --network mainnet \
  -- \
  --token <XLM-SAC-contract-id>
```

Update `NEXT_PUBLIC_ROTOR_CONTRACT_ID` and `CONTRACT_ID` with the deployed contract ID.

---

## Deployed Addresses

| Network | rotor-core | XLM SAC |
|---------|------------|---------|
| **Mainnet** | `CBMQYO5IMT2P2AXSOEB6ON3CA3WLOYRVHEK26CK4T7G6H7YHCM2HADQ5` | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| **Testnet** | *(deploy locally)* | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

---

## Relayer API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/root` | GET | Latest Merkle root (for withdrawal notes) |
| `/verify` | POST | Verify ZK proof only |
| `/withdraw` | POST | Verify proof + submit withdrawal |

---

## Documentation

Full documentation is in `docs/` (build with [mdBook](https://rust-lang.github.io/mdBook/)):

- [Quick Start](docs/src/quick_start.md)
- [How It Works](docs/src/how_it_works.md)
- [Architecture](docs/src/architecture/overview.md)
- [User Guide](docs/src/user_guide/deposit.md)

---

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS, Stellar SDK
- **Relayer**: Hono, Node.js, tsx
- **Contract**: Rust, Soroban SDK, soroban-poseidon
- **ZK**: Noir, Barretenberg (bb.js), UltraHonk

---

## Security

- The relayer is **trusted** for submission; it cannot steal funds but can censor withdrawals.
- The contract enforces **nullifier uniqueness**—no commitment can be withdrawn twice.
- ZK proofs hide the deposit–withdrawal link; only commitments and nullifiers are visible on-chain.

---

## License

MIT
