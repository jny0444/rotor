import { Hono } from "hono";
import { cors } from "hono/cors";
import { UltraHonkBackend } from "@aztec/bb.js";
import * as StellarSdk from "@stellar/stellar-sdk";
import circuit from "./circuit.json";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RELAYER_PORT = Number(process.env.PORT || 3001);
const STELLAR_RPC =
  process.env.STELLAR_RPC || "https://mainnet.sorobanrpc.com";
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ||
  "Public Global Stellar Network ; September 2015";
const CONTRACT_ID = process.env.CONTRACT_ID || "";
const RELAYER_SECRET = process.env.RELAYER_SECRET || "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/^0x/, ""), "hex");
}

function decodeEd25519(address: string): Buffer {
  if (StellarSdk.StrKey.isValidMed25519PublicKey(address)) {
    return Buffer.from(StellarSdk.StrKey.decodeMed25519PublicKey(address).slice(0, 32));
  }
  return Buffer.from(StellarSdk.StrKey.decodeEd25519PublicKey(address));
}

function stellarAddressToField(address: string): string {
  const raw = decodeEd25519(address);
  raw[0] = 0;
  return "0x" + raw.toString("hex");
}

function toBaseAddress(address: string): string {
  if (StellarSdk.StrKey.isValidMed25519PublicKey(address)) {
    const ed25519 = StellarSdk.StrKey.decodeMed25519PublicKey(address).slice(0, 32);
    return StellarSdk.StrKey.encodeEd25519PublicKey(Buffer.from(ed25519));
  }
  return address;
}

/** Parse amount (stroops) from proof public input (field element hex) */
function fieldHexToStroops(fieldHex: string): number {
  const hex = fieldHex.startsWith("0x") ? fieldHex : "0x" + fieldHex;
  const n = BigInt(hex);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount too large");
  return Number(n);
}

async function pollSorobanTx(
  server: StellarSdk.rpc.Server,
  hash: string,
  timeoutMs = 60_000,
  intervalMs = 2_000
): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const resp = await server.getTransaction(hash);
    if (resp.status !== "NOT_FOUND") return resp;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Transaction ${hash} not confirmed within ${timeoutMs / 1000}s`
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = new Hono();

app.use("/*", cors({ origin: "*" }));

app.get("/", (c) =>
  c.json({
    status: "ok",
    service: "rotor-relayer",
    configured: Boolean(CONTRACT_ID && RELAYER_SECRET),
  })
);

// ---------------------------------------------------------------------------
// GET /root — return the contract's latest Merkle root (for withdrawal notes)
// ---------------------------------------------------------------------------
app.get("/root", async (c) => {
  try {
    if (!CONTRACT_ID || !RELAYER_SECRET) {
      return c.json(
        { error: "Relayer not configured" },
        503
      );
    }
    const keypair = StellarSdk.Keypair.fromSecret(RELAYER_SECRET);
    const rpcServer = new StellarSdk.rpc.Server(STELLAR_RPC);
    const account = await rpcServer.getAccount(keypair.publicKey());
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("get_latest_root"))
      .setTimeout(180)
      .build();
    const sim = await rpcServer.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      return c.json({ error: sim.error }, 502);
    }
    const retval = sim.result?.retval;
    if (!retval) {
      return c.json({ error: "No root in simulation result" }, 502);
    }
    if (retval.switch().name !== "scvBytes") {
      return c.json({ error: "Unexpected root type" }, 502);
    }
    const bytes = retval.bytes();
    const hex = Buffer.from(bytes).toString("hex");
    return c.json({ root: "0x" + hex });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get root";
    console.error("[Relayer] GET /root error:", message);
    return c.json({ error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /verify
// ---------------------------------------------------------------------------
app.post("/verify", async (c) => {
  try {
    const { proof, publicInputs } = await c.req.json();

    if (!proof || !publicInputs) {
      return c.json(
        { valid: false, error: "Missing proof or publicInputs" },
        400
      );
    }

    const backend = new UltraHonkBackend(circuit.bytecode);
    const valid = await backend.verifyProof({
      proof: new Uint8Array(proof),
      publicInputs,
    });
    await backend.destroy();

    return c.json({ valid });
  } catch (err) {
    return c.json(
      {
        valid: false,
        error: err instanceof Error ? err.message : "Verification failed",
      },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// POST /withdraw
//
// Full withdrawal flow:
//   1. Validate inputs & match recipient against the proof
//   2. Verify the UltraHonk ZK proof
//   3. Call withdraw() on the rotor-core Soroban contract
//      — validates Merkle root, marks nullifier spent, transfers XLM to
//        recipient via SAC — all atomically in one transaction.
//
// Body: {
//   proof:        number[],     // UltraHonk proof bytes
//   publicInputs: string[],     // [root, nullifierHash, recipientField, amount] — amount from proof
//   recipient:    string,        // Stellar G... address
// }
// Amount is taken from publicInputs[3] (bound in the commitment), not from the request body.
// ---------------------------------------------------------------------------
app.post("/withdraw", async (c) => {
  try {
    const body = await c.req.json();
    const { proof, publicInputs, recipient } = body;

    if (!proof || !publicInputs || !recipient) {
      return c.json(
        {
          success: false,
          error: "Missing required fields: proof, publicInputs, recipient",
        },
        400
      );
    }

    if (!Array.isArray(publicInputs) || publicInputs.length !== 4) {
      return c.json(
        {
          success: false,
          error:
            "publicInputs must contain exactly 4 elements [root, nullifierHash, recipientField, amount]",
        },
        400
      );
    }

    if (
      !StellarSdk.StrKey.isValidEd25519PublicKey(recipient) &&
      !StellarSdk.StrKey.isValidMed25519PublicKey(recipient)
    ) {
      return c.json(
        { success: false, error: "Invalid Stellar recipient address" },
        400
      );
    }

    const [root, nullifierHash, recipientField, amountField] = publicInputs as [
      string,
      string,
      string,
      string,
    ];

    let amountStroops: number;
    try {
      amountStroops = fieldHexToStroops(amountField);
    } catch {
      return c.json(
        { success: false, error: "Invalid amount in proof" },
        400
      );
    }
    if (amountStroops <= 0) {
      return c.json(
        { success: false, error: "Amount in proof must be positive" },
        400
      );
    }

    const expectedField = stellarAddressToField(recipient);
    if (recipientField !== expectedField) {
      return c.json(
        {
          success: false,
          error: "Proof recipient does not match the supplied Stellar address",
        },
        400
      );
    }

    // ----- Step 1: Verify the ZK proof (UltraHonk via bb.js) -----

    console.log("[Relayer] Verifying UltraHonk proof…");
    const backend = new UltraHonkBackend(circuit.bytecode);
    const valid = await backend.verifyProof({
      proof: new Uint8Array(proof),
      publicInputs,
    });
    await backend.destroy();

    if (!valid) {
      console.log("[Relayer] Proof verification FAILED");
      return c.json(
        { success: false, error: "Proof verification failed" },
        400
      );
    }
    console.log("[Relayer] Proof verified");

    // ----- Step 2: Ensure relayer is fully configured -----

    if (!CONTRACT_ID || !RELAYER_SECRET) {
      return c.json(
        {
          success: false,
          error:
            "Relayer is not configured — set CONTRACT_ID and RELAYER_SECRET env vars",
        },
        503
      );
    }

    const relayerKeypair = StellarSdk.Keypair.fromSecret(RELAYER_SECRET);
    const relayerPubkey = relayerKeypair.publicKey();
    const rpc = new StellarSdk.rpc.Server(STELLAR_RPC);

    // ----- Step 3: Call withdraw() on the Soroban contract -----
    //
    // The contract validates root + nullifier, then transfers XLM from
    // the contract's balance to the recipient via the SAC — all atomic.

    console.log("[Relayer] Building Soroban withdraw transaction…");
    console.log(`[Relayer] Amount: ${amountStroops} stroops (${(amountStroops / 10_000_000).toFixed(7)} XLM)`);
    const relayerAccount = await rpc.getAccount(relayerPubkey);
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    const recipientBase = toBaseAddress(recipient);

    // Pass proof_amount as BytesN<32> — the contract derives the i128 amount
    // from the lower 16 bytes of this BN254 field element.
    const sorobanTx = new StellarSdk.TransactionBuilder(relayerAccount, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "withdraw",
          StellarSdk.xdr.ScVal.scvBytes(hexToBuffer(nullifierHash)),
          new StellarSdk.Address(recipientBase).toScVal(),
          StellarSdk.xdr.ScVal.scvBytes(hexToBuffer(amountField))
        )
      )
      .setTimeout(180)
      .build();

    const prepared = await rpc.prepareTransaction(sorobanTx);
    prepared.sign(relayerKeypair);

    const sendRes = await rpc.sendTransaction(prepared);
    if (sendRes.status === "ERROR") {
      throw new Error(
        `Soroban transaction rejected: ${JSON.stringify(sendRes.errorResult)}`
      );
    }

    console.log(`[Relayer] Soroban tx submitted: ${sendRes.hash}`);
    const confirmed = await pollSorobanTx(rpc, sendRes.hash);

    if (confirmed.status !== "SUCCESS") {
      throw new Error(
        `Contract withdraw call failed (status: ${confirmed.status})`
      );
    }
    console.log("[Relayer] Withdrawal confirmed — XLM sent to recipient by contract");

    const xlmAmount = (amountStroops / 10_000_000).toFixed(7);

    return c.json({
      success: true,
      verified: true,
      txHash: sendRes.hash,
      amount: xlmAmount,
      recipient,
      message: `Withdrawal of ${xlmAmount} XLM sent to ${recipient}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Withdrawal failed";
    console.error("[Relayer] Error:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
console.log(`Rotor Relayer on http://localhost:${RELAYER_PORT}`);
console.log(`  Contract: ${CONTRACT_ID || "(not set)"}`);
console.log(`  RPC:      ${STELLAR_RPC}`);

export default {
  port: RELAYER_PORT,
  fetch: app.fetch,
};
