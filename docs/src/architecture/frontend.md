# Frontend

The Rotor frontend is a Next.js application providing the user interface for private transactions.

## Technology Stack

**Framework**: Next.js 14 (App Router)  
**Language**: TypeScript  
**Styling**: TailwindCSS  
**Location**: `/client`

## Key Features

- Wallet integration (Freighter, Albedo, WalletConnect)
- Client-side secret generation
- Local zero-knowledge proof generation
-Transaction submission
- Real-time updates via WebSocket
- Responsive design (mobile & desktop)

## Component Structure

```
client/
├── app/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Homepage
│   ├── globals.css          # Global styles
│   └── profile/
│       └── page.tsx         # Profile page
├── components/
│   ├── Header.tsx           # Navigation header
│   ├── Footer.tsx           # Page footer
│   ├── Swap.tsx             # Main swap/privacy interface
│   └── WalletProvider.tsx   # Wallet context
└── lib/
    ├── stellar.ts           # Stellar SDK helpers
    ├── crypto.ts            # Cryptographic utilities
    ├── circuit.ts           # Noir proof generation
    └── api.ts               # Backend API client
```

## Core Components

### WalletProvider

Manages wallet connection state:

```typescript
export function WalletProvider({ children }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet');

  const connectWallet = async () => {
    // Freighter integration
    if (window.freighter) {
      const publicKey = await window.freighter.getPublicKey();
      setAddress(publicKey);
    }
  };

  return (
    <WalletContext.Provider value={{ address, connectWallet, network }}>
      {children}
    </WalletContext.Provider>
  );
}
```

### Swap Component

Main privacy interface for deposits/withdrawals:

```typescript
export function Swap() {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [secrets, setSecrets] = useState<Secrets | null>(null);

  return (
    <div className=\"swap-container\">
      <Tabs value={tab} onChange={setTab}>
        <Tab value=\"deposit\">Deposit</Tab>
        <Tab value=\"withdraw\">Withdraw</Tab>
      </Tabs>

      {tab === 'deposit' ? (
        <DepositForm amount={amount} onDeposit={handleDeposit} />
      ) : (
        <WithdrawForm secrets={secrets} onWithdraw={handleWithdraw} />
      )}
    </div>
  );
}
```

## Cryptographic Utilities

### Secret Generation

```typescript
import { randomBytes } from 'crypto';
import { poseidon } from 'circomlibjs';

export function generateSecrets(): Secrets {
  const nullifier = randomBytes(32);
  const secret = randomBytes(32);
  
  const commitment = poseidon([
    BigInt('0x' + nullifier.toString('hex')),
    BigInt('0x' + secret.toString('hex'))
  ]);

  const nullifierHash = poseidon([
    BigInt('0x' + nullifier.toString('hex'))
  ]);

  return {
    nullifier: nullifier.toString('hex'),
    secret: secret.toString('hex'),
    commitment: commitment.toString(16),
    nullifierHash: nullifierHash.toString(16)
  };
}
```

### Proof Generation

```typescript
import { Noir } from '@noir-lang/noir_js';
import circuit from '../../circuit/target/main.json';

export async function generateProof(inputs: ProofInputs): Promise<Proof> {
  const noir = new Noir(circuit);
  
  // Generate witness
  const witness = await noir.generateWitness(inputs);
  
  // Generate proof
  const proof = await noir.generateProof(witness);
  
  return proof;
}
```

## API Integration

### REST Client

```typescript
class RotorAPI {
  constructor(private baseURL: string) {}

  async getStatus() {
    const res = await fetch(`${this.baseURL}/status`);
    return res.json();
  }

  async getMerkleProof(commitment: string) {
    const res = await fetch(`${this.baseURL}/merkle-proof/${commitment}`);
    return res.json();
  }

  async submitWithdrawal(data: WithdrawalData) {
    const res = await fetch(`${this.baseURL}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }
}
```

### WebSocket Client

```typescript
export function useWebSocket() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080/ws');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'deposit') {
        setDeposits(prev => [...prev, data]);
      }
    };

    return () => ws.close();
  }, []);

  return { deposits };
}
```

## State Management

### Local Storage

```typescript
export function saveSecrets(secrets: Secrets) {
  const encrypted = encrypt(JSON.stringify(secrets), password);
  localStorage.setItem('rotor_secrets', encrypted);
}

export function loadSecrets(password: string): Secrets | null {
  const encrypted = localStorage.getItem('rotor_secrets');
  if (!encrypted) return null;
  
  try {
    const decrypted = decrypt(encrypted, password);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}
```

## User Flows

### Deposit Flow

1. User enters amount
2. Click \"Generate Secrets\"
3. Display secrets and backup options
4. User backs up secrets
5. Click \"Deposit\"
6. Wallet prompts for approval
7. Transaction submitted
8. Show confirmation

### Withdrawal Flow

1. User enters/uploads secrets
2. Verify commitment exists
3. Fetch Merkle proof from backend
4. User enters recipient address
5. Click \"Generate Proof\"
6. Show progress (30-60s)
7. Proof generated
8. Click \"Withdraw\"
9. Transaction submitted
10. Show confirmation

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy components
const ProofGenerator = dynamic(() => import('./ProofGenerator'), {
  ssr: false,
  loading: () => <LoadingSpinner />
});
```

### Web Workers

```typescript
// proof-worker.ts
self.onmessage = async (e) => {
  const { inputs } = e.data;
  const proof = await generateProof(inputs);
  self.postMessage({ proof });
};

// main.ts
const worker = new Worker('proof-worker.js');
worker.postMessage({ inputs });
worker.onmessage = (e) => {
  const { proof } = e.data;
  // Use proof
};
```

## Security Considerations

### Secret Handling

- Never send secrets to backend
- Generate proofs client-side only
- Encrypt backups with user password
- Clear memory after use (where possible)

### Contract Address Verification

```typescript
const KNOWN_CONTRACTS = {
  testnet: 'C...',
  mainnet: 'C...'
};

function verifyContract(address: string, network: Network): boolean {
  return address === KNOWN_CONTRACTS[network];
}
```

### HTTPS Only

```typescript
// next.config.ts
export default {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload'
        }
      ]
    }];
  }
};
```

## Testing

### Component Tests

```typescript
import { render, fireEvent } from '@testing-library/react';

test('Deposit form validates amount', () => {
  const { getByRole, getByText } = render(<DepositForm />);
  
  const input = getByRole('textbox');
  fireEvent.change(input, { target: { value: '-10' } });
  
  expect(getByText('Amount must be positive')).toBeInTheDocument();
});
```

### Integration Tests

```typescript
test('Complete deposit flow', async () => {
  const { getByText, getByRole } = render(<App />);
  
  // Connect wallet
  fireEvent.click(getByText('Connect Wallet'));
  await waitFor(() => expect(getByText('Connected')).toBeInTheDocument());
  
  // Enter amount
  const input = getByRole('textbox');
  fireEvent.change(input, { target: { value: '100' } });
  
  // Generate secrets
  fireEvent.click(getByText('Generate Secrets'));
  await waitFor(() => expect(getByText('Download Backup')).toBeInTheDocument());
  
  // Submit deposit
  fireEvent.click(getByText('Deposit'));
  await waitFor(() => expect(getByText('Deposit Successful')).toBeInTheDocument());
});
```

## Deployment

### Build

```bash
cd client
pnpm build
```

### Environment Variables

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.rotor.stellar.app
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_CONTRACT_ID=C...
NEXT_PUBLIC_WS_URL=wss://api.rotor.stellar.app/ws
```

### Deploy to Vercel

```bash
vercel --prod
```

## Related Documentation

- [Backend API](./backend.md)
- [User Guide](../user_guide/deposit.md)
- [Development Setup](../developer_guide/setup.md)
