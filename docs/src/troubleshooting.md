# 5. Troubleshooting

## `HostError: Error(WasmVm, InvalidAction)` on withdraw

Usually means contract and relayer argument types are out of sync.

Fix:

1. Rebuild contract.
2. Redeploy contract.
3. Update both env contract ids.
4. Restart relayer and client.

## Proof verifies but withdraw fails

Check:

- Relayer is calling latest contract id.
- Recipient address is valid (`G...` or `M...` where supported).
- Nullifier is not already spent.
- Contract has enough funded balance.

## Balance does not update

Wallet balance is refreshed after successful send and polled periodically.
If stale:

- Check network/RPC connectivity.
- Reconnect wallet.

## Old tx hashes disappear too quickly

Success hashes should persist until user closes the success card manually.
# 5. Troubleshooting
