# Backend API

The Rotor backend is a Go-based API server that coordinates between the frontend and blockchain.

## Architecture

**Language**: Go 1.21+  
**Framework**: Gin (HTTP router)  
**Location**: `/backend`

## Responsibilities

- **API Endpoints**: REST and WebSocket interfaces
- **Merkle Tree Indexing**: Track all deposits and maintain tree state
- **Proof Data**: Provide Merkle proofs for proof generation
- **Transaction Monitoring**: Watch blockchain for new deposits/withdrawals
- **Caching**: Optimize frequent queries
- **Metrics**: Track usage and performance

## Key Design Principle

**The backend is NOT trusted for security** - it can go offline or become malicious without compromising user funds or privacy. Users can always interact directly with the smart contract.

## API Endpoints

### GET /health

**Purpose**: Health check  
**Response**:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "chainHeight": 1234567
}
```

### GET /status

**Purpose**: Get protocol statistics  
**Response**:
```json
{
  "totalDeposits": 1523,
  "totalWithdrawals": 891,
  "anonymitySet": 632,
  "currentRoot": "0x1234...",
  "merkleTreeSize": 1523
}
```

### POST /deposit

**Purpose**: Submit deposit transaction  
**Request**:
```json
{
  "amount": "100",
  "commitment": "0xabcd...",
  "sourceAddress": "G..."
}
```

**Response**:
```json
{
  "txHash": "0x5678...",
  "leafIndex": 1523,
  "estimatedConfirmation": 5
}
```

### GET /merkle-proof/:commitment

**Purpose**: Get Merkle proof for a commitment  
**Response**:
```json
{
  "commitment": "0xabcd...",
  "leafIndex": 42,
  "proof": [
    "0x1111...",
    "0x2222...",
    // ... 20 siblings
  ],
  "pathIndices": [0, 1, 0, 1, ...], // 0 = left, 1 = right
  "root": "0x9999..."
}
```

### POST /withdraw

**Purpose**: Submit withdrawal transaction  
**Request**:
```json
{
  "proof": "0x...", // ZK proof bytes
  "nullifierHash": "0xdef0...",
  "recipient": "G...",
  "root": "0x9999..."
}
```

**Response**:
```json
{
  "txHash": "0xabcd...",
  "estimatedConfirmation": 5
}
```

### GET /commitment/:commitment/status

**Purpose**: Check if commitment exists  
**Response**:
```json
{
  "exists": true,
  "leafIndex": 42,
  "timestamp": 1234567890,
  "root": "0x9999..."
}
```

### GET /nullifier/:hash/used

**Purpose**: Check if nullifier has been used  
**Response**:
```json
{
  "used": false
}
```

### WebSocket /ws

**Purpose**: Real-time updates  
**Events**:
```json
// New deposit
{
  "type": "deposit",
  "commitment": "0x...",
  "leafIndex": 1524,
  "timestamp": 1234567890
}

// New withdrawal
{
  "type": "withdrawal",
  "nullifierHash": "0x...",
  "timestamp": 1234567890
}

// New root
{
  " type": "rootUpdate",
  "oldRoot": "0x...",
  "newRoot": "0x...",
  "leafIndex": 1524
}
```

## Internal Architecture

### Project Structure

```
backend/
├── main.go              # Entry point
├── go.mod              # Dependencies
├── api/
│   ├── handlers.go    # HTTP handlers
│   ├── routes.go      # Route definitions
│   └── middleware.go  # CORS, auth, etc.
├── blockchain/
│   ├── client.go      # Stellar client
│   ├── monitor.go     # Event monitoring
│   └── transactions.go # TX building
├── merkle/
│   ├── tree.go        # Merkle tree logic
│   ├── proof.go       # Proof generation
│   └── store.go       # Tree storage
├── database/
│   ├── postgres.go    # DB connection
│   ├── models.go      # Data models
│   └── queries.go     # DB queries
└── utils/
    ├── crypto.go      # Hash utilities
    └── errors.go      # Error types
```

### Data Models

```go
type Deposit struct {
    ID          int64     `db:"id"`
    Commitment  string    `db:"commitment"`
    LeafIndex   uint32    `db:"leaf_index"`
    Amount      string    `db:"amount"`
    TxHash      string    `db:"tx_hash"`
    Timestamp   time.Time `db:"timestamp"`
}

type Withdrawal struct {
    ID            int64     `db:"id"`
    NullifierHash string    `db:"nullifier_hash"`
    Recipient     string    `db:"recipient"`
    TxHash        string    `db:"tx_hash"`
    Timestamp     time.Time `db:"timestamp"`
}

type MerkleNode struct {
    Level uint32 `db:"level"`
    Index uint32 `db:"index"`
    Hash  string `db:"hash"`
}
```

## Merkle Tree Management

### In-Memory Tree

```go
type MerkleTree struct {
    leaves []string
    nodes  map[string]string // "level:index" -> hash
    depth  uint32
}

func (t *MerkleTree) AddLeaf(commitment string) uint32 {
    index := uint32(len(t.leaves))
    t.leaves = append(t.leaves, commitment)
    t.recomputePath(index)
    return index
}

func (t *MerkleTree) GetProof(index uint32) ([]string, []uint32) {
    proof := make([]string, t.depth)
    pathIndices := make([]uint32, t.depth)
    
    currentIndex := index
    for level := uint32(0); level < t.depth; level++ {
        siblingIndex := currentIndex ^ 1 // XOR with 1 to get sibling
        proof[level] = t.getNode(level, siblingIndex)
        pathIndices[level] = currentIndex % 2
        currentIndex = currentIndex / 2
    }
    
    return proof, pathIndices
}
```

### Database Persistence

```go
func (s *Store) SaveDeposit(deposit *Deposit) error {
    query := `
        INSERT INTO deposits 
        (commitment, leaf_index, amount, tx_hash, timestamp)
        VALUES ($1, $2, $3, $4, $5)
    `
    _, err := s.db.Exec(query,
        deposit.Commitment,
        deposit.LeafIndex,
        deposit.Amount,
        deposit.TxHash,
        deposit.Timestamp,
    )
    return err
}
```

## Blockchain Monitoring

### Event Listener

```go
func (m *Monitor) Start() {
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            m.pollEvents()
        case <-m.stop:
            return
        }
    }
}

func (m *Monitor) pollEvents() {
    // Get latest transactions
    txs, err := m.client.GetTransactions(m.contractID, m.lastCursor)
    if err != nil {
        log.Error("Failed to poll", err)
        return
    }
    
    for _, tx := range txs {
        m.processTransaction(tx)
    }
}

func (m *Monitor) processTransaction(tx *Transaction) {
    switch tx.Type {
    case "deposit":
        m.handleDeposit(tx)
    case "withdrawal":
        m.handleWithdrawal(tx)
    }
}
```

## Caching Strategy

### Redis Cache

```go
type Cache struct {
    client *redis.Client
}

func (c *Cache) GetCurrentRoot() (string, error) {
    return c.client.Get(context.Background(), "current_root").Result()
}

func (c *Cache) CacheProof(commitment string, proof *MerkleProof) error {
    data, _ := json.Marshal(proof)
    return c.client.Set(
        context.Background(),
        "proof:"+commitment,
        data,
        10*time.Minute, // TTL
    ).Err()
}
```

### Cache Invalidation

```go
func (m *Monitor) handleDeposit(tx *Transaction) {
    // Add to tree
    index := m.tree.AddLeaf(tx.Commitment)
    
    // Invalidate root cache
    m.cache.Delete("current_root")
    
    // Invalidate affected proofs
    m.cache.DeletePattern("proof:*")
    
    // Save to database
    m.store.SaveDeposit(&Deposit{...})
    
    // Broadcast to WebSocket clients
    m.broadcast("deposit", tx)
}
```

## Error Handling

```go
type APIError struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
}

func handleError(c *gin.Context, err error) {
    switch e := err.(type) {
    case *NotFoundError:
        c.JSON(404, APIError{404, e.Error()})
    case *ValidationError:
        c.JSON(400, APIError{400, e.Error()})
    default:
        log.Error("Internal error", err)
        c.JSON(500, APIError{500, "Internal server error"})
    }
}
```

## Testing

```go
func TestGetMerkleProof(t *testing.T) {
    tree := NewMerkleTree(20)
    
    // Add some leaves
    commitments := []string{"0x111", "0x222", "0x333"}
    for _, c := range commitments {
        tree.AddLeaf(c)
    }
    
    // Get proof for first leaf
    proof, indices := tree.GetProof(0)
    
    // Verify proof
    root := tree.Root()
    computed := VerifyProof(commitments[0], proof, indices)
    
    assert.Equal(t, root, computed)
}
```

## Deployment

### Docker

```dockerfile
FROM golang:1.21 AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o backend main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/backend /backend
EXPOSE 8080
CMD ["/backend"]
```

### Configuration

```bash
# .env
PORT=8080
DATABASE_URL=postgresql://user:pass@localhost/rotor
REDIS_URL=redis://localhost:6379
STELLAR_NETWORK=testnet
CONTRACT_ID=C...
HORIZON_URL=https://horizon-testnet.stellar.org
```

## Monitoring

### Metrics

- Request latency
- Request count by endpoint
- Error rate
- Active WebSocket connections
- Cache hit rate
- Database query time

### Logging

```go
log.Info("Deposit processed",
    "commitment", commitment,
    "leafIndex", index,
    "txHash", txHash,
)
```

## Related Documentation

- [Smart Contracts](./smart_contracts.md)
- [Frontend Architecture](./frontend.md)
- [API Reference](../reference/api.md)
