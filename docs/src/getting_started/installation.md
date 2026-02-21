# Installation

Rotor can be used through the web interface or integrated into your own applications. This guide covers both scenarios.

## Using the Web Interface

No installation required! Simply visit:

```
https://rotor.stellar.app
```

The web interface works on:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome, Firefox)
- Progressive Web App (PWA) for offline capabilities

### Installing as PWA

For a native app-like experience:

#### Chrome/Edge (Desktop)
1. Visit the Rotor website
2. Click the install icon in the address bar
3. Click "Install"

#### Safari (iOS)
1. Visit the Rotor website
2. Tap the Share button
3. Tap "Add to Home Screen"

#### Chrome (Android)
1. Visit the Rotor website
2. Tap the menu (three dots)
3. Tap "Add to Home Screen"

## Developer Installation

For developers wanting to run Rotor locally or integrate it into applications.

### Prerequisites

- Node.js 18+ and pnpm
- Go 1.21+ (for backend)
- Rust and Soroban CLI (for smart contracts)
- Noir (for ZK circuits)

### Clone the Repository

```bash
git clone https://github.com/rotor/rotor.git
cd rotor
```

### Install Frontend Dependencies

```bash
cd client
pnpm install
```

### Install Backend Dependencies

```bash
cd ../backend
go mod download
```

### Install Smart Contract Tools

```bash
# Install Soroban CLI
cargo install --locked soroban-cli

# Install Stellar CLI (optional)
cargo install --locked stellar-cli
```

### Install Circuit Tools

```bash
# Install Noir
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup
```

## Running Locally

### Start the Frontend

```bash
cd client
pnpm dev
```

The frontend will be available at `http://localhost:3000`

### Start the Backend

```bash
cd backend
go run main.go
```

The API will be available at `http://localhost:8080`

### Compile Smart Contracts

```bash
cd stellar/contracts/rotor-core
soroban contract build
```

### Compile ZK Circuit

```bash
cd circuit
nargo compile
```

## Environment Configuration

### Frontend (.env.local)

Create `client/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_CONTRACT_ID=your_contract_id
```

### Backend (.env)

Create `backend/.env`:

```env
PORT=8080
STELLAR_NETWORK=testnet
CONTRACT_ADDRESS=your_contract_id
HORIZON_URL=https://horizon-testnet.stellar.org
```

## Deploy to Testnet

### 1. Get Testnet XLM

Visit the Stellar testnet friendbot:

```bash
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

### 2. Deploy Smart Contracts

```bash
cd stellar/contracts/rotor-core
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/rotor_core.wasm \
  --network testnet
```

### 3. Initialize Contract

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --network testnet \
  -- initialize
```

### 4. Update Environment Variables

Update your `.env` files with the deployed contract ID.

## Using the SDK

For integrating Rotor into your JavaScript/TypeScript application:

### Install SDK

```bash
npm install @rotor/sdk
# or
pnpm add @rotor/sdk
```

### Basic Usage

```typescript
import { RotorClient } from '@rotor/sdk';

const rotor = new RotorClient({
  network: 'testnet',
  contractId: 'YOUR_CONTRACT_ID'
});

// Generate secrets
const { secret, nullifier, commitment } = rotor.generateSecrets();

// Make deposit
await rotor.deposit({
  amount: '100',
  commitment,
  sourceAccount: 'YOUR_PUBLIC_KEY'
});

// Generate proof and withdraw
const proof = await rotor.generateProof({
  secret,
  nullifier,
  recipient: 'RECIPIENT_ADDRESS'
});

await rotor.withdraw({
  proof,
  nullifierHash: rotor.hashNullifier(nullifier),
  recipient: 'RECIPIENT_ADDRESS'
});
```

## Using the CLI

For command-line usage:

### Install CLI

```bash
npm install -g @rotor/cli
# or
pnpm add -g @rotor/cli
```

### CLI Commands

```bash
# Generate secrets
rotor generate-secrets

# Make deposit
rotor deposit --amount 100 --secret SECRET --nullifier NULLIFIER

# Make withdrawal
rotor withdraw --secret SECRET --nullifier NULLIFIER --recipient ADDRESS

# Check pool status
rotor status
```

## Docker Setup

Run the entire stack with Docker:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Troubleshooting

### Common Issues

**Frontend won't start:**
- Ensure Node.js 18+ is installed: `node --version`
- Clear cache: `pnpm clean && pnpm install`

**Backend connection error:**
- Check if backend is running on port 8080
- Verify network connectivity
- Check firewall settings

**Contract deployment fails:**
- Ensure you have testnet XLM
- Verify Soroban CLI is up to date
- Check network connection

**Proof generation takes too long:**
- Circuit compilation is computationally intensive
- Ensure you have sufficient RAM (4GB+ recommended)
- Consider using a more powerful machine

## Next Steps

- Follow the [Quick Start Guide](./quick_start.md)
- Complete your [First Transaction](./first_transaction.md)
- Read the [Developer Guide](../developer_guide/setup.md)
