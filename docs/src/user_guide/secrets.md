# Saving Your Withdrawal Note

After a successful deposit, Rotor shows you a **withdrawal note**. This note is the only thing that lets you (or any recipient) claim the funds. It is never stored anywhere else.

## Note format

```json
{
  "nullifier": "0x00f1ad...",
  "secret":    "0x008109...",
  "nullifierHash": "0x28c795...",
  "amountStroops": 10000000,
  "amountField": "0x000000...00989680"
}
```

| Field | Description |
|---|---|
| `nullifier` | Secret random value. Used inside the ZK proof. |
| `secret` | Second secret random value. Used to compute the commitment. |
| `nullifierHash` | `Poseidon2(nullifier)`. Stored on-chain when the withdrawal is spent. |
| `amountStroops` | Deposit amount in [stroops](https://developers.stellar.org/docs/anchors/anchor-platform/sep-38/overview#asset-identification) (1 XLM = 10,000,000 stroops). |
| `amountField` | Amount encoded as a BN254 field element. Used in the ZK proof. |

## How to save the note

**Copy the JSON** from the success card and store it wherever you keep sensitive credentials:
- A password manager (recommended)
- An encrypted file on disk
- A hardware-encrypted drive

**Do not** store it in:
- Cloud documents or email drafts
- Unencrypted files or screenshots in cloud-synced folders
- Browser local storage (it is not written there by default)

## Sending the note to a recipient

If you are sending funds to someone else, you need to share the note with them securely — for example, via Signal or an encrypted message. The recipient pastes the note into Rotor's **Avail Balance** form to claim the funds to their own address.

> The note does not contain the recipient address. The recipient fills that in themselves when they claim, so they can direct the funds anywhere they choose.
