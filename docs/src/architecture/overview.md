# System Overview

Rotor is built as a modular, multi-component system designed for privacy, security, and scalability on Stellar

## Architecture Diagram

```
┌─────────────────┐
│   User Browser   │
│  (Next.js App)  │
└────────┬────────┘
         │
         │ REST API / WebSocket
         │
┌────────┴────────┐
│  Backend Server  │
│   (Go + API)    │
└────────┬────────┘
         │
         │ Stellar SDK
         │
┌────────┴────────────────────────┐
│     Stellar Blockchain          │
│  ┌──────────────────────┐  │
│  │  Rotor Smart Contract  │  │
│  │   (Soroban/Rust)      │  │
│  └──────────────────────┘  │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  ZK Proof Generation (Local)  │
│       (Noir Circuit)          │
│     Runs in Browser          │
└──────────────────────────────────┘
```

## Component Overview

### 1. Frontend (Next.js)
**Location**: `/client`  
**Language**: TypeScript/React  
**Purpose**: User interface and client-side proof generation

**Key Responsibilities:**
- User wallet integration
- Secret generation and management
- Local zero-knowledge proof generation
- Transaction submission
- State management and UI

[Learn more about Frontend Architecture →](./frontend.md)

### 2. Backend (Go)
**Location**: `/backend`  
**Language**: Go  
**Purpose**: API server and blockchain coordination

**Key Responsibilities:**
- REST API endpoints
- WebSocket connections for real-time updates
- Merkle tree state management
- Transaction monitoring
- Caching and optimization

[Learn more about Backend Architecture →](./backend.md)

### 3. Smart Contracts (Soroban)
**Location**: `/stellar/contracts`  
**Language**: Rust  
**Purpose**: On-chain protocol logic

**Key Contracts:**
- **rotor-core**: Main privacy protocol
- **a-token**: Test token A
- **b-token**: Test token B

**Key Responsibilities:**
- Deposit management
- Withdrawal verification
- Merkle tree storage
- Nullifier tracking
- Asset custody

[Learn more about Smart Contracts →](./smart_contracts.md)

### 4. ZK Circuit (Noir)
**Location**: `/circuit`  
**Language**: Noir  
**Purpose**: Zero-knowledge proof system

**Key Responsibilities:**
- Commitment verification
- Merkle tree membership proofs
- Nullifier hash generation
- Recipient binding
- Proof generation and verification

[Learn more about ZK Circuit →](./zk_circuit.md)

## Data Flow

### Deposit Flow

```
1. User generates secrets (Frontend)
2. Compute commitment = Poseidon2(nullifier, secret)
3. Submit deposit transaction to blockchain
4. Smart contract stores commitment in Merkle tree
5. Backend indexes new commitment
6. Frontend confirms deposit
```

### Withdrawal Flow

```
1. User loads secrets (Frontend)
2. Backend provides current Merkle tree state
3. Frontend generates ZK proof locally
4. User submits withdrawal transaction
5. Smart contract verifies proof on-chain
6. Contract checks nullifier not used
7. Contract transfers assets to recipient
8. Backend indexes withdrawal
```

## Security Model

### Trust Assumptions

**Trusted:**
- Stellar blockchain consensus
- Cryptographic primitives (Poseidon, Noir/UltraPlonk)
- User's ability to keep secrets private

**Not Trusted:**
- Backend server (can go down, but can't steal funds)
- Frontend hosting (users verify contract addresses)
- Network infrastructure (use Tor/VPN for metadata privacy)

### Threat Model

**Protected Against:**
- ✅ Blockchain analysis
- ✅ Transaction graph tracing
- ✅ Malicious backend server
- ✅ Contract manipulation (proofs are verified)
- ✅ Double-spending (nullifiers prevent)

**Not Protected Against:**
- ❌ User revealing their secrets
- ❌ Network-level surveillance (without Tor/VPN)
- ❌ Timing attacks (if deposit/withdraw immediately)
- ❌ Side-channel attacks on user's device
- ❌ Compromised user machine

## Key Design Decisions

### Client-Side Proof Generation

**Why:** Secrets never leave the user's device, eliminating server trust

**Tradeoff:** Slower proof generation, requires powerful client device

### Merkle Tree On-Chain

**Why:** Decentralized, trustless, censorship-resistant

**Tradeoff:** Storage costs, gas fees for updates

### Poseidon Hash Function

**Why:** Optimized for zero-knowledge circuits, efficient proving

**Tradeoff:** Less studied than SHA-256, requires specialized implementation

### Noir Proving System

**Why:** Modern, actively developed, good developer experience

**Tradeoff:** Larger proof sizes than alternatives, newer technology

## Scalability Considerations

### Current Limits

- **Merkle Tree Depth**: 20 levels = 1,048,576 deposits
- **Proof Generation**: 30-60 seconds on typical hardware
- **Proof Size**: ~200KB
- **On-Chain Verification**: <100ms

### Future Optimizations

- **Incremental Merkle Trees**: Allow unbounded deposits
- **Proof Aggregation**: Batch multiple withdrawals
- **Optimized Circuits**: Faster proving times
- **L2 Integration**: Reduce on-chain costs

## Deployment Architecture

### Testnet

```
Frontend: Vercel/Netlify
Backend: Single server
Contracts: Stellar Testnet
Database: PostgreSQL
Cache: Redis
```

### Mainnet (Planned)

```
Frontend: CDN + IPFS (decentralized)
Backend: Kubernetes cluster (redundant)
Contracts: Stellar Mainnet
Database: PostgreSQL (replicated)
Cache: Redis cluster
Monitoring: Prometheus + Grafana
```

## Technology Stack

### Frontend
- Next.js 14 (React framework)
- TypeScript (type safety)
- TailwindCSS (styling)
- Stellar SDK (blockchain interaction)
- Noir.js (proof generation)

### Backend
- Go 1.21 (performance)
- Gin (web framework)
- Stellar Go SDK
- PostgreSQL (state storage)
- Redis (caching)

### Smart Contracts
- Rust (language)
- Soroban SDK (Stellar contracts)
- Cargo (build system)

### ZK Circuit
- Noir (circuit language)
- UltraPlonk (proof system)
- Barretenberg (proving backend)

## Development Workflow

### Local Development

1. Run contracts on local Stellar network
2. Start backend pointing to local network
3. Start frontend with local API
4. Compile circuits for testing

### Testing

1. **Unit Tests**: Each component independently
2. **Integration Tests**: Component interactions
3. **E2E Tests**: Full user flows
4. **Circuit Tests**: Proof generation/verification

### Deployment

1. **Testnet**: Continuous deployment from main branch
2. **Audits**: Security reviews before mainnet
3. **Mainnet**: Tagged releases with governance approval

## Monitoring and Observability

### Metrics Tracked

- Deposit transaction success rate
- Withdrawal transaction success rate
- Proof generation time (client-side)
- API response times
- Anonymity set size
- Active users

### Alerting

- Contract execution failures
- Backend service downtime
- Abnormal transaction patterns
- Merkle tree inconsistencies

## Next Steps

Dive deeper into each component:

- [Smart Contracts Architecture](./smart_contracts.md)
- [ZK Circuit Design](./zk_circuit.md)
- [Backend API](./backend.md)
- [Frontend Architecture](./frontend.md)
