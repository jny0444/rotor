# Quick Start

Get Rotor running locally in under 5 minutes.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | With `pnpm` package manager |
| Rust toolchain | stable | Required for building Soroban contracts |
| `stellar` CLI | latest | For testnet access and deployment |
| `nargo` | 1.0.0-beta.15 | Noir compiler (optional, circuit is pre-compiled) |
| `bb` | matching nargo | Barretenberg CLI (optional) |

Install the Stellar CLI:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/stellar/stellar-cli/refs/heads/main/install.sh | sh
```

## 1. Configure environment variables

**Client** (`client/.env.local`):
```bash
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_RELAYER_URL=http://localhost:3001
NEXT_PUBLIC_ROTOR_CONTRACT_ID=<deployed-contract-id>
NEXT_PUBLIC_XLM_SAC_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

**Relayer** (`relayer/.env`):
```bash
CONTRACT_ID=<deployed-contract-id>
RELAYER_SECRET=<relayer-stellar-secret-key>
STELLAR_RPC=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
PORT=3001
```

## 2. Start the relayer

```bash
cd relayer
pnpm install
pnpm dev
```

The relayer exposes three endpoints: `GET /root`, `POST /verify`, and `POST /withdraw`.

## 3. Start the client

```bash
cd client
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4. Send a private payment

1. Connect your Stellar wallet (Freighter, LOBSTR, etc.).
2. Enter the **recipient** address and the **amount**.
3. Click **Send**. Three transactions happen automatically:
   - Fund the shielded pool
   - Commit your note to the Merkle tree
   - Generate ZK proof and withdraw to recipient via the relayer
4. Copy the withdrawal note shown in the success card and send it to the recipient if needed.

> **Testnet accounts**: Fund both your wallet and the relayer with Friendbot:
> `curl "https://friendbot.stellar.org?addr=<your-address>"`
