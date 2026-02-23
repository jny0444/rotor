# Deploying Rotor Relayer on Deno Deploy

## ⚠️ Important Note about @aztec/bb.js

The `@aztec/bb.js` package may have compatibility issues with Deno Deploy because:
- It uses WASM binaries that may not work in Deno's edge runtime
- Large package size (3MB+ you mentioned)
- May have Node.js-specific dependencies

**Test locally first** before deploying to Deno Deploy.

## Local Testing with Deno

```bash
# Test if bb.js works in Deno
deno task dev
```

If you get errors about bb.js, you have two options:
1. Use a different deployment platform (Fly.io, Railway, Render)
2. Move proof verification to the client side

## Deploy to Deno Deploy

### Option 1: Via GitHub (Recommended)

1. Install Deno Deploy CLI:
```bash
deno install -A --global jsr:@deno/deployctl
```

2. Link to GitHub:
   - Go to https://dash.deno.com/new
   - Connect your GitHub repository
   - Set the entry point to: `relayer/src/index-deno.ts`
   - Add environment variables in the dashboard

3. Push to GitHub - auto-deploys!

### Option 2: Direct Deploy

```bash
cd /Users/jnyandeepsingh/Programming/Github/rotor/relayer

# Deploy
deployctl deploy \
  --project=rotor-relayer \
  --env-file=.env \
  src/index-deno.ts
```

## Environment Variables

Set these in Deno Deploy dashboard:
- `CONTRACT_ID`
- `RELAYER_SECRET`
- `STELLAR_RPC` (optional)
- `NETWORK_PASSPHRASE` (optional)

## If @aztec/bb.js doesn't work

### Alternative: Client-side verification

Move proof verification to the client, relayer only submits to Stellar:

```typescript
// In client
const backend = new UltraHonkBackend(circuit.bytecode);
const { proof, publicInputs } = await backend.generateProof(inputs);
const valid = await backend.verifyProof({ proof, publicInputs });

if (!valid) throw new Error("Invalid proof");

// Send to relayer (which now trusts client verification)
await fetch('/withdraw', {
  method: 'POST',
  body: JSON.stringify({ proof, publicInputs, recipient })
});
```

Then remove bb.js from relayer dependencies.

### Alternative: Use a traditional server

If bb.js absolutely requires Node.js APIs:
- **Fly.io** (best option - supports any runtime)
- **Railway** (easy deployment)
- **Render** (free tier)

All of these support Docker or direct Bun deployment with no size limits.
