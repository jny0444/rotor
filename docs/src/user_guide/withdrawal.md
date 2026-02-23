# Withdrawing Funds

To withdraw with a note you have received (or generated yourself), use the **Avail Balance** tab in the Rotor interface.

## Step-by-step

1. **Connect your wallet.** You need a connected wallet even for withdrawals — Soroban requires the relayer to know your public key.
2. **Paste the withdrawal note.** Copy the JSON note from your secure storage and paste it into the "Withdrawal Note" field.
3. **Enter the recipient address.** This is the Stellar address (`G...` or `M...`) that should receive the XLM. This does not have to be your own address.
4. **Click Avail Balance.** The UI steps through the following stages:
   - **Parsing** — validates and decodes the note.
   - **Computing Tree** — recomputes the Merkle root from the commitment using Barretenberg.
   - **Generating ZK Proof** — runs the Noir circuit in-browser to produce an UltraHonk proof. This takes a few seconds.
   - **Notifying Relayer** — sends the proof and public inputs to the relayer server.
5. **Success.** The tx hash appears. Click it to view the transaction on [Stellar Expert](https://stellar.expert).

## What the proof contains

The ZK proof's public inputs are:

```
[root, nullifierHash, recipientField, amountField]
```

- `root` — the Merkle root at deposit time. The contract checks this is a known root.
- `nullifierHash` — marks the note as spent after the withdrawal.
- `recipientField` — the recipient address encoded as a BN254 field element. The relayer verifies this matches the `recipient` you supplied.
- `amountField` — the amount encoded as a field element. The contract reads this to determine how much XLM to transfer.

## What happens on-chain

The relayer submits a single Soroban transaction calling `withdraw(nullifier_hash, recipient, proof_amount_bytes32)`. The contract:

1. Checks the caller is the authorized relayer.
2. Derives the XLM amount from `proof_amount_bytes32`.
3. Checks the nullifier has not been spent.
4. Marks the nullifier as spent.
5. Calls `token.transfer(contract → recipient, amount)` via the XLM Stellar Asset Contract.

All five steps are atomic. If any fails, the transaction reverts and the nullifier is not marked spent.

## Errors

| Error | Likely cause |
|---|---|
| `Proof verification failed` | The note is corrupted or was created with a different circuit. |
| `nullifier already spent` | This note has already been claimed. |
| `unknown root` | The deposit is too old (> 30 root history entries). |
| `Contract has insufficient balance` | The contract's XLM balance is lower than the withdrawal amount. |
| `Invalid Stellar recipient address` | The address you entered is not a valid G... or M... address. |
