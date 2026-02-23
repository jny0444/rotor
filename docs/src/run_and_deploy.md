# 4. Run and Deploy

## Build contract

From `stellar/`:

```bash
stellar contract build
```

## Deploy contract (testnet)

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/rotor_core.wasm \
  --source <your-source> \
  --network testnet \
  -- \
  --relayer $(stellar keys address relayer) \
  --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

Copy the deployed contract id into:

- `client/.env.local` (`NEXT_PUBLIC_ROTOR_CONTRACT_ID`)
- `relayer/.env` (`CONTRACT_ID`)

Restart client and relayer after env changes.

## Build docs

From `docs/`:

```bash
mdbook build
```
