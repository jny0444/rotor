import { Hono } from "hono";
import { cors } from "hono/cors";
import { UltraHonkBackend } from "@aztec/bb.js";
import circuit from "./circuit.json";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RELAYER_PORT = Number(process.env.PORT || 3001);
const STELLAR_RPC = process.env.STELLAR_RPC || "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.CONTRACT_ID || "";
const RELAYER_SECRET = process.env.RELAYER_SECRET || ""; // Relayer's Stellar secret key

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = new Hono();

app.use("/*", cors({ origin: "*" }));

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "rotor-relayer" }));

// ---------------------------------------------------------------------------
// POST /verify
//
// Accepts a ZK proof and public inputs, verifies the proof using bb.js,
// and returns whether the proof is valid.
//
// Body: { proof: number[], publicInputs: string[] }
// ---------------------------------------------------------------------------
app.post("/verify", async (c) => {
  try {
    const body = await c.req.json();
    const { proof, publicInputs } = body;

    if (!proof || !publicInputs) {
      return c.json({ valid: false, error: "Missing proof or publicInputs" }, 400);
    }

    // Convert proof from number[] to Uint8Array
    const proofBytes = new Uint8Array(proof);

    // Verify using UltraHonk
    const backend = new UltraHonkBackend(circuit.bytecode);
    const valid = await backend.verifyProof({ proof: proofBytes, publicInputs });
    await backend.destroy();

    return c.json({ valid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return c.json({ valid: false, error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /withdraw
//
// Full withdrawal flow:
// 1. Verify the ZK proof
// 2. If valid, submit withdrawal transaction to the Soroban contract
//
// Body: {
//   proof: number[],
//   publicInputs: string[],   // [root, nullifierHash, recipient]
//   recipient: string,        // Stellar address (G...)
// }
// ---------------------------------------------------------------------------
app.post("/withdraw", async (c) => {
  try {
    const body = await c.req.json();
    const { proof, publicInputs, recipient } = body;

    if (!proof || !publicInputs || !recipient) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    // Step 1: Verify the proof
    const proofBytes = new Uint8Array(proof);
    const backend = new UltraHonkBackend(circuit.bytecode);
    const valid = await backend.verifyProof({ proof: proofBytes, publicInputs });
    await backend.destroy();

    if (!valid) {
      return c.json({ success: false, error: "Invalid proof" }, 400);
    }

    // Step 2: Extract public inputs
    const [root, nullifierHash, recipientField] = publicInputs;

    // Step 3: Submit withdrawal to Soroban contract
    // TODO: Implement Soroban transaction submission
    //
    // This would:
    // 1. Build a contract invocation tx calling withdraw(root, nullifierHash, recipient)
    // 2. Sign it with the relayer's keypair (RELAYER_SECRET)
    // 3. Submit to the Stellar network
    //
    // For now, return the verification result
    if (!CONTRACT_ID || !RELAYER_SECRET) {
      return c.json({
        success: true,
        verified: true,
        submitted: false,
        message: "Proof verified. Contract submission not configured — set CONTRACT_ID and RELAYER_SECRET env vars.",
        publicInputs: { root, nullifierHash, recipient: recipientField },
      });
    }

    // When contract is deployed, uncomment and implement:
    // const result = await submitWithdrawal(root, nullifierHash, recipient);
    // return c.json({ success: true, verified: true, submitted: true, hash: result.hash });

    return c.json({
      success: true,
      verified: true,
      submitted: false,
      message: "Proof verified. Withdrawal submission coming soon.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Withdrawal failed";
    return c.json({ success: false, error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
console.log(`🔐 Rotor Relayer running on http://localhost:${RELAYER_PORT}`);
export default {
  port: RELAYER_PORT,
  fetch: app.fetch,
};
