# Quick Start

Get started with Rotor in under 5 minutes. This guide will walk you through making your first private transaction.

## Prerequisites

- A Stellar wallet with some XLM for gas fees
- A web browser (Chrome, Firefox, Safari, or Edge)
- An internet connection

## Step 1: Access Rotor

Visit the Rotor web interface:

```
https://rotor.stellar.app
```

(Replace with your actual deployment URL)

## Step 2: Connect Your Wallet

1. Click **"Connect Wallet"** in the top right corner
2. Choose your wallet provider:
   - Freighter (browser extension)
   - Albedo (web-based)
   - WalletConnect (mobile wallets)
3. Authorize the connection

## Step 3: Make a Deposit

1. Navigate to the **"Deposit"** tab
2. Enter the amount of XLM you want to deposit
3. Click **"Generate Secrets"**
   - The app will create a random secret and nullifier
   - **IMPORTANT**: Back up these secrets immediately
4. Click **"Download Backup"** to save your secrets
5. Click **"Deposit"** and confirm the transaction in your wallet

Your deposit will be confirmed in 3-5 seconds.

## Step 4: Wait (Optional but Recommended)

For better privacy, wait for more deposits to accumulate before withdrawing. The more deposits in the pool, the larger your anonymity set.

You can check the current anonymity set on the dashboard.

## Step 5: Make a Withdrawal

1. Navigate to the **"Withdraw"** tab
2. Enter your secret and nullifier (or upload your backup file)
3. Enter the recipient address (use a fresh address for maximum privacy)
4. Click **"Generate Proof"**
   - This may take 30-60 seconds
   - The browser computes the zero-knowledge proof locally
5. Click **"Withdraw"** and confirm

Your funds will arrive at the recipient address in 3-5 seconds!

## Step 6: Verify Privacy

The withdrawal transaction is now on the blockchain, but:

✅ No one can link it to your original deposit  
✅ Your secrets remain private  
✅ The recipient address shows no connection to your deposit address  

Congratulations! You've completed your first private transaction with Rotor.

## What's Next?

- Learn more about [How It Works](../how_it_works.md)
- Read [Security Best Practices](../user_guide/security.md)
- Explore [Advanced Features](../user_guide/secrets.md)

## Need Help?

If you encounter any issues:

1. Check the [FAQ](../resources/faq.md)
2. Join our [Discord community](https://discord.gg/rotor)
3. Report bugs on [GitHub](https://github.com/rotor/rotor/issues)

## Security Reminders

⚠️ **Critical**: Your secrets are the ONLY way to access your deposited funds. If you lose them, your funds are permanently lost.

**Best practices:**
- Always download the backup file
- Store it in a secure location (encrypted USB, password manager, etc.)
- Never share your secrets with anyone
- Consider making multiple backup copies
