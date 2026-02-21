# FAQ

## General Questions

### What is Rotor?

Rotor is a privacy protocol on Stellar that uses zero-knowledge proofs to break the link between deposit and withdrawal addresses, enabling private transactions.

### Is Rotor safe to use?

Rotor is non-custodial - you maintain full control of your funds. The smart contracts are audited and open-source. However, you must keep your secrets safe, as losing them means losing access to your funds.

### Is Rotor legal?

Privacy is not illegal. Rotor is designed for legitimate privacy use cases - protecting financial information, business confidentiality, and personal security. However, laws vary by jurisdiction, so users should consult local regulations.

### How much does it cost?

You pay two types of fees:
- **Stellar transaction fees**: Minimal, typically fractions of a cent
- **No protocol fees**: Rotor doesn't charge any additional fees

## Privacy Questions

### How private is Rotor?

Your anonymity depends on the **anonymity set** - the number of deposits in the pool. If there are 1,000 deposits and you withdraw, an observer only knows you're one of those 1,000 people.

### Can anyone trace my transaction?

No one can directly link your deposit to your withdrawal. However, timing analysis and amount correlation can reduce privacy if you deposit and immediately withdraw the same unusual amount.

### What information is public?

Public:
- Deposit amounts
- Withdrawal amounts  
- Transaction timing
- Commitments (meaningless without secrets)
- Nullifier hashes (not linkable to commitments)

Private:
- Which deposit belongs to which withdrawal
- Your secret and nullifier
- Your identity

### How can I maximize privacy?

1. Wait before withdrawing (let the anonymity set grow)
2. Use standard denominations (10, 100, 1000 XLM)
3. Withdraw to fresh addresses
4. Use Tor or VPN
5. Don't reuse withdrawal addresses

## Technical Questions

### What are secrets?

Secrets are two random values (nullifier and secret) that only you know. Combined, they prove you made a deposit without revealing which one.

### What happens if I lose my secrets?

Your funds are permanently lost. There is no recovery mechanism. Always back up your secrets in multiple secure locations.

### Why does proof generation take so long?

Generating a zero-knowledge proof requires solving millions of cryptographic constraints. This is computationally intensive but ensures your privacy.

### Can I speed up proof generation?

Use a more powerful computer, close other browser tabs, and ensure you have sufficient RAM (4GB+ recommended).

### What is a nullifier?

A nullifier is a unique value that prevents double-spending. When you withdraw, your nullifier hash is recorded, preventing you from withdrawing twice with the same secrets.

### What is a commitment?

A commitment is a cryptographic hash of your secrets that's stored on the blockchain when you deposit. It proves you made a deposit without revealing your secrets.

## Usage Questions

### Can I withdraw to any address?

Yes, but for maximum privacy, withdraw to a completely fresh address with no connection to your deposit address or identity.

### Can I deposit any amount?

Yes, but consider using standard amounts (10, 100, 1000 XLM) for better privacy through larger anonymity sets.

### How long should I wait before withdrawing?

Recommended wait times:
- Minimum: 10 more deposits
- Good privacy: 100+ more deposits
- Best privacy: 1000+ more deposits

### Can I make multiple deposits?

Yes, each deposit uses different secrets. Back up all secrets separately.

### Do I need to withdraw the full amount?

Currently, yes. Partial withdrawals are not supported yet.

## Security Questions

### Can the Rotor team steal my funds?

No. Rotor is non-custodial and smart contracts are on-chain. Even the developers cannot access your funds.

### Can the backend server steal my funds?

No. Proofs are generated client-side, and secrets never leave your browser.

### What if Rotor shuts down?

You can always interact directly with the smart contract. The frontend is just a convenience layer.

### Can quantum computers break Rotor?

Current quantum computers cannot break Rotor's cryptography. Future quantum-resistant upgrades may be needed.

### What if there's a bug in the smart contract?

Contracts are audited before mainnet launch. Emergency pause functionality exists for critical issues.

## Support Questions

### Where can I get help?

- Discord: [Join community](#)
- GitHub: [Report issues](https://github.com/rotor/rotor/issues)
- Email: support@rotor.app

### I made a mistake, can I reverse it?  

Blockchain transactions are irreversible. Double-check everything before submitting.

### My withdrawal failed, what happened?

Common causes:
- Nullifier already used (you already withdrew)
- Invalid proof (regenerate with fresh Merkle root)
- Insufficient gas
- Network issues

### Can I test Rotor without real money?

Yes! Use the testnet version with test XLM from the Stellar friendbot.

## Advanced Questions

### Can I integrate Rotor into my app?

Yes! Use the SDK or API. See [Developer Guide](../developer_guide/setup.md).

### Does Rotor support other assets?

Currently XLM only. Multi-asset support is planned.

### Can I run my own Rotor instance?

Yes, Rotor is fully open-source. See [Deployment Guide](../developer_guide/deployment.md).

### How does Rotor compare to Tornado Cash?

Similar concept but:
- Rotor is Stellar-native (vs Ethereum)
- Uses Noir (vs Circom)
- Different proof system
- Built for Stellar ecosystem

### What's the maximum anonymity set?

Current Merkle tree supports 1,048,576 deposits. Can be expanded in the future.

## Troubleshooting

### \"Commitment not found\"

Your deposit transaction may not be confirmed yet. Wait a few seconds and refresh.

### \"Nullifier already used\"

You've already withdrawn with these secrets. Each secret pair can only be used once.

### \"Proof generation failed\"

Try:
- Closing other browser tabs
- Using a different browser (Chrome/Firefox recommended)
- Checking your internet connection
- Waiting and trying again

### \"Invalid Merkle root\"

The tree state changed since you started. Click refresh to get the latest root and regenerate the proof.

### Browser freezes during proof generation

This is normal - proof generation uses significant CPU. Wait 30-60 seconds for completion.

## Still Have Questions?

Join our community:
- [Discord](#)
- [Twitter](#)
- [GitHub Discussions](#)
