# Your First Transaction

This guide provides a detailed walkthrough of making your first private transaction with Rotor.

## Overview

A complete Rotor transaction consists of two phases:

1. **Deposit Phase**: Lock funds with a cryptographic commitment
2. **Withdrawal Phase**: Prove ownership and withdraw to a new address

Let's walk through each step in detail.

## Before You Begin

### What You'll Need

- ✅ Stellar wallet with XLM
- ✅ Rotor web interface access
- ✅ Secure place to store secrets
- ✅ 10-15 minutes

### Understanding the Process

Rotor breaks the link between your deposit address and withdrawal address using zero-knowledge cryptography. After completing this guide, you'll understand:

- How commitments work
- Why secrets are crucial
- How zero-knowledge proofs provide privacy
- Best practices for maximum anonymity

## Phase 1: Making a Deposit

### Step 1: Connect Your Wallet

1. Visit the Rotor web interface
2. Click **"Connect Wallet"**
3. Select your wallet provider (Freighter, Albedo, or WalletConnect)
4. Approve the connection request

Your wallet address will appear in the top right corner once connected.

### Step 2: Navigate to Deposit

Click the **"Deposit"** tab in the main navigation.

### Step 3: Enter Amount

Enter the amount you want to deposit:

- Minimum: 10 XLM (example)
- Maximum: 10,000 XLM (example)
- Consider using standard amounts (10, 100, 1000 XLM) for better privacy

**Why standard amounts?** If everyone deposits different amounts, it's easier to correlate deposits with withdrawals.

### Step 4: Generate Secrets

Click **"Generate Secrets"**. The interface will create:

- **Secret**: A random 256-bit value
- **Nullifier**: Another random 256-bit value
- **Commitment**: Hash of secret and nullifier

These are displayed in both hex and as a mnemonic phrase.

### Step 5: ⚠️ BACKUP YOUR SECRETS

This is the most critical step:

1. Click **"Download Backup"** to save a JSON file
2. **OPTIONAL**: Write down the mnemonic phrase on paper
3. Store the backup in a secure location:
   - Password manager (recommended)
   - Encrypted USB drive
   - Hardware wallet (if supported)
   - Multiple locations for redundancy

⚠️ **WARNING**: If you lose these secrets, your funds are permanently lost. There is no recovery mechanism.

### Step 6: Confirm Understanding

Check the boxes confirming:
- ☐ I have backed up my secrets
- ☐ I understand these secrets cannot be recovered
- ☐ I will never share these secrets with anyone

### Step 7: Submit Deposit

1. Click **"Deposit"**
2. Review the transaction details in your wallet
3. Approve the transaction

The transaction will be confirmed in 3-5 seconds.

### Step 8: Verify Deposit

Once confirmed, you'll see:
- Transaction hash
- Your commitment added to the Merkle tree
- New anonymity set size
- Deposit timestamp

Keep the transaction hash for your records (optional—it doesn't compromise privacy).

## Waiting Period

### Why Wait?

For maximum privacy, wait before withdrawing. The longer you wait:

- More deposits accumulate in the pool
- Your anonymity set increases
- Harder to correlate your deposit with withdrawal

### How Long to Wait?

- **Minimum**: 10 deposits after yours
- **Good**: 100 deposits after yours
- **Excellent**: 1000+ deposits after yours
- **Timing**: Hours to days depending on activity

### Monitoring the Pool

Check the dashboard to see:
- Current anonymity set size
- Recent deposits
- Pool activity
- Estimated wait time recommendations

## Phase 2: Making a Withdrawal

### Step 1: Prepare Recipient Address

Decide where to withdraw. For maximum privacy:

✅ **DO**: Use a completely fresh address  
✅ **DO**: Use an address that has never interacted with your deposit address  
❌ **DON'T**: Withdraw to your original deposit address  
❌ **DON'T**: Withdraw to an address linked to your identity  

### Step 2: Navigate to Withdraw

Click the **"Withdraw"** tab.

### Step 3: Load Your Secrets

Choose one option:

**Option A: Upload Backup File**
1. Click **"Upload Backup"**
2. Select your backup JSON file
3. Enter password if encrypted

**Option B: Manual Entry**
1. Paste your secret
2. Paste your nullifier

**Option C: Mnemonic Phrase**
1. Click **"Use Mnemonic"**
2. Enter your 24-word phrase

The interface will verify your secrets and display:
- Your commitment
- Verification that this commitment exists in the tree
- That you haven't withdrawn yet

### Step 4: Enter Recipient

Paste the recipient address in the designated field.

Double-check this address carefully—blockchain transactions are irreversible!

### Step 5: Generate Proof

Click **"Generate Proof"**.

**What happens now?**
- Your browser computes a zero-knowledge proof (locally, nothing sent to server)
- This proves you know valid secrets without revealing them
- Proves your commitment is in the Merkle tree
- Proves you haven't withdrawn before
- Takes 30-60 seconds depending on your device

You'll see a progress bar. Don't close the tab during this process.

### Step 6: Review Proof

Once generated, the interface shows:
- Proof size (~200KB)
- Nullifier hash (prevents double-spend)
- Merkle root used
- Estimated gas cost

### Step 7: Submit Withdrawal

1. Click **"Withdraw"**
2. The transaction is submitted to the blockchain
3. Wait for confirmation (3-5 seconds)

**Note**: You don't need to connect a wallet for withdrawal—the proof itself authorizes the transaction!

### Step 8: Verify Withdrawal

Once confirmed:
- Funds arrive at recipient address
- Nullifier is recorded (prevents reuse)
- Your commitment remains in the Merkle tree
- No link between deposit and withdrawal is created

## Verification

### Verify Your Privacy

Check the blockchain explorer:

1. Look at your deposit transaction
   - Shows your deposit address and commitment
2. Look at your withdrawal transaction
   - Shows recipient address and nullifier hash
   - Shows NO connection to deposit

✅ **Success**: No observable link between the two transactions!

### What Observers See

**Without Rotor:**
```
Alice -> Bob (traceable)
```

**With Rotor:**
```
Alice -> Rotor Pool
...
Rotor Pool -> Bob
```

No one can determine that Alice sent funds to Bob.

## Best Practices Recap

### Security
- ✅ Back up secrets immediately
- ✅ Use strong encryption for backups
- ✅ Never share secrets
- ✅ Verify contract addresses

### Privacy
- ✅ Wait before withdrawing
- ✅ Use fresh recipient addresses
- ✅ Access through Tor/VPN
- ✅ Use standard deposit amounts

### Operational
- ✅ Test with small amounts first
- ✅ Keep transaction hashes for records
- ✅ Monitor pool activity
- ✅ Understand the technology

## What's Next?

- Learn about [Managing Your Secrets](../user_guide/secrets.md)
- Review [Security Best Practices](../user_guide/security.md)
- Understand [How It Works](../how_it_works.md) in depth
- Join the community on [Discord](#)

## Troubleshooting

### "Commitment not found"
- Your deposit hasn't been confirmed yet (wait a few seconds)
- You're using the wrong secrets
- You're connected to the wrong network

### "Nullifier already used"
- You've already withdrawn with these secrets
- Each secret pair can only be used once

### "Proof generation failed"
- Browser ran out of memory (close other tabs)
- Incompatible browser (try Chrome or Firefox)
- Network issue (check connection)

### "Invalid Merkle root"
- New deposits were made since you started
- Click "Refresh" to get the latest root
- Try generating the proof again

Need more help? Check the [FAQ](../resources/faq.md) or ask in our [Discord](#).
