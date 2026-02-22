/**
 * Integration test for the relayer's /verify and /withdraw endpoints.
 *
 * Generates a real UltraHonk proof using the Prover.toml test vectors,
 * then sends it to the running relayer for verification.
 *
 * Usage:
 *   1. Start the relayer:  bun run dev
 *   2. In another terminal: bun run test
 */

import { Noir, type CompiledCircuit } from "@noir-lang/noir_js";
import { UltraHonkBackend, type ProofData } from "@aztec/bb.js";
import circuit from "./circuit.json";

const RELAYER_URL = process.env.RELAYER_URL || "http://localhost:3001";

// Known-good circuit inputs (must match Prover.toml; amount = 10_000_000 stroops as field)
const PROVER_INPUTS = {
  root: "0x0321468fee1a17309a70ad249572549d2656623c1f01e1242ec1ff4a6366029a",
  nullifier_hash:
    "0x28c795ca7a6d4d5efe5270fa01df52939cbeedf48e3aa2d584f10babda65c6cc",
  recipient:
    "0x00c98557f5ea6f0bae0ed968dcd88709144938ba4dfaaaf66c63bef82d663ba3",
  amount: "0x0000000000000000000000000000000000000000000000000000000000989680",
  nullifier:
    "0x00f1ad8bace18966d778cb6f1486fe31ee0a192346e91aa07e44baa94e2c9b0f",
  secret:
    "0x0081090175082f4f33e2694f90ba79ef86a2a01719997678ccc00ea031355db6",
  merkleProof: [
    "0x0d823319708ab99ec915efd4f7e03d11ca1790918e8f04cd14100aceca2aa9ff",
    "0x170a9598425eb05eb8dc06986c6afc717811e874326a79576c02d338bdf14f13",
    "0x273b1a40397b618dac2fc66ceb71399a3e1a60341e546e053cbfa5995e824caf",
    "0x16bf9b1fb2dfa9d88cfb1752d6937a1594d257c2053dff3cb971016bfcffe2a1",
    "0x1288271e1f93a29fa6e748b7468a77a9b8fc3db6b216ce5fc2601fc3e9bd6b36",
    "0x1d47548adec1068354d163be4ffa348ca89f079b039c9191378584abd79edeca",
    "0x0b98a89e6827ef697b8fb2e280a2342d61db1eb5efc229f5f4a77fb333b80bef",
    "0x231555e37e6b206f43fdcd4d660c47442d76aab1ef552aef6db45f3f9cf2e955",
    "0x03d0dc8c92e2844abcc5fdefe8cb67d93034de0862943990b09c6b8e3fa27a86",
    "0x1d51ac275f47f10e592b8e690fd3b28a76106893ac3e60cd7b2a3a443f4e8355",
    "0x16b671eb844a8e4e463e820e26560357edee4ecfdbf5d7b0a28799911505088d",
    "0x115ea0c2f132c5914d5bb737af6eed04115a3896f0d65e12e761ca560083da15",
    "0x139a5b42099806c76efb52da0ec1dde06a836bf6f87ef7ab4bac7d00637e28f0",
    "0x0804853482335a6533eb6a4ddfc215a08026db413d247a7695e807e38debea8e",
    "0x2f0b264ab5f5630b591af93d93ec2dfed28eef017b251e40905cdf7983689803",
    "0x170fc161bf1b9610bf196c173bdae82c4adfd93888dc317f5010822a3ba9ebee",
    "0x0b2e7665b17622cc0243b6fa35110aa7dd0ee3cc9409650172aa786ca5971439",
    "0x12d5a033cbeff854c5ba0c5628ac4628104be6ab370699a1b2b4209e518b0ac5",
    "0x1bc59846eb7eafafc85ba9a99a89562763735322e4255b7c1788a8fe8b90bf5d",
    "0x1b9421fbd79f6972a348a3dd4721781ec25a5d8d27342942ae00aba80a3904d4",
  ],
  is_even: Array(20).fill(true),
};

let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`    PASS: ${name}`);
}
function fail(name: string, detail?: string) {
  failed++;
  console.error(`    FAIL: ${name}${detail ? " — " + detail : ""}`);
}

async function generateProof(): Promise<ProofData> {
  const noir = new Noir(circuit as CompiledCircuit);
  const { witness } = await noir.execute(PROVER_INPUTS);

  const backend = new UltraHonkBackend(
    (circuit as CompiledCircuit).bytecode
  );
  const proofData = await backend.generateProof(witness);
  await backend.destroy();
  return proofData;
}

async function main() {
  console.log("=== Rotor Relayer Integration Test ===\n");

  // ------------------------------------------------------------------
  // 0. Health check
  // ------------------------------------------------------------------
  console.log("[0] Health check…");
  try {
    const res = await fetch(`${RELAYER_URL}/`);
    const data = await res.json();
    if (data.status === "ok") pass("Relayer is running");
    else fail("Health check", JSON.stringify(data));
    console.log(`    configured: ${data.configured}\n`);
  } catch {
    fail(
      "Health check",
      `Could not reach ${RELAYER_URL}. Is the relayer running? (bun run dev)`
    );
    process.exit(1);
  }

  // ------------------------------------------------------------------
  // 1. Generate a real UltraHonk proof
  // ------------------------------------------------------------------
  console.log("[1] Generating UltraHonk proof from Prover.toml test vectors…");
  const t0 = Date.now();
  const proofData = await generateProof();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `    Proof: ${proofData.proof.length} bytes, ${proofData.publicInputs.length} public inputs (${elapsed}s)`
  );
  pass("Proof generated");
  console.log();

  // ------------------------------------------------------------------
  // 2. POST /verify — valid proof
  // ------------------------------------------------------------------
  console.log("[2] POST /verify with valid proof…");
  {
    const res = await fetch(`${RELAYER_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof: Array.from(proofData.proof),
        publicInputs: proofData.publicInputs,
      }),
    });
    const data = await res.json();
    if (data.valid) pass("Valid proof accepted");
    else fail("Valid proof rejected", JSON.stringify(data));
  }
  console.log();

  // ------------------------------------------------------------------
  // 3. POST /verify — tampered proof
  // ------------------------------------------------------------------
  console.log("[3] POST /verify with tampered proof (expect rejection)…");
  {
    const tampered = new Uint8Array(proofData.proof);
    tampered[0] ^= 0xff;
    const res = await fetch(`${RELAYER_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof: Array.from(tampered),
        publicInputs: proofData.publicInputs,
      }),
    });
    const data = await res.json();
    if (!data.valid) pass("Tampered proof rejected");
    else fail("Tampered proof accepted (should not happen)");
  }
  console.log();

  // ------------------------------------------------------------------
  // 4. POST /verify — wrong public inputs
  // ------------------------------------------------------------------
  console.log("[4] POST /verify with wrong public inputs (expect rejection)…");
  {
    const badInputs = [...proofData.publicInputs];
    badInputs[0] =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    const res = await fetch(`${RELAYER_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof: Array.from(proofData.proof),
        publicInputs: badInputs,
      }),
    });
    const data = await res.json();
    if (!data.valid) pass("Wrong public inputs rejected");
    else fail("Wrong public inputs accepted");
  }
  console.log();

  // ------------------------------------------------------------------
  // 5. POST /withdraw — validation: missing fields
  // ------------------------------------------------------------------
  console.log("[5] POST /withdraw input validation…");
  {
    const res = await fetch(`${RELAYER_URL}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof: [] }),
    });
    const data = await res.json();
    if (!data.success && data.error) pass("Missing fields rejected");
    else fail("Missing fields accepted");
  }

  // ------------------------------------------------------------------
  // 6. POST /withdraw — validation: bad recipient address
  // ------------------------------------------------------------------
  console.log("[6] POST /withdraw — invalid Stellar address…");
  {
    const res = await fetch(`${RELAYER_URL}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof: Array.from(proofData.proof),
        publicInputs: proofData.publicInputs,
        recipient: "NOT_A_VALID_ADDRESS",
      }),
    });
    const data = await res.json();
    if (!data.success && data.error?.includes("Invalid"))
      pass("Invalid address rejected");
    else fail("Invalid address accepted", JSON.stringify(data));
  }

  // ------------------------------------------------------------------
  // 7. POST /withdraw — validation: recipient mismatch
  // ------------------------------------------------------------------
  console.log(
    "[7] POST /withdraw — mismatched recipient (valid address, wrong proof)…"
  );
  {
    // Use the relayer's own public key — a known-valid Stellar address that
    // won't match the proof's recipient field.
    const res = await fetch(`${RELAYER_URL}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof: Array.from(proofData.proof),
        publicInputs: proofData.publicInputs,
        recipient: "GANSUID7EEBFIA5MOW6NXFJFQKSIWFMZVUQFCXYVZXN3PCWQ5NXERL4V",
      }),
    });
    const data = await res.json();
    if (!data.success && data.error?.includes("does not match"))
      pass("Recipient mismatch rejected");
    else fail("Recipient mismatch accepted", JSON.stringify(data));
  }

  // ------------------------------------------------------------------
  // 8. POST /withdraw — validation: wrong number of public inputs (no amount in proof)
  // ------------------------------------------------------------------
  console.log("[8] POST /withdraw — publicInputs with only 3 elements…");
  {
    const threeInputs = proofData.publicInputs.slice(0, 3);
    const res = await fetch(`${RELAYER_URL}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof: Array.from(proofData.proof),
        publicInputs: threeInputs,
        recipient: "GANSUID7EEBFIA5MOW6NXFJFQKSIWFMZVUQFCXYVZXN3PCWQ5NXERL4V",
      }),
    });
    const data = await res.json();
    if (!data.success && data.error?.includes("4 elements"))
      pass("Wrong public inputs length rejected");
    else fail("Wrong public inputs accepted", JSON.stringify(data));
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    console.log("\nSome tests failed.");
    process.exit(1);
  }

  console.log("\nAll verification tests passed!");
  console.log(
    "\nNote: Full /withdraw flow (contract + XLM payment) requires:"
  );
  console.log("  1. rotor-core deployed on Stellar testnet");
  console.log("  2. CONTRACT_ID and RELAYER_SECRET set in .env");
  console.log("  3. A real deposit made through the client UI");
  console.log("  4. Withdrawal note with matching Merkle root on-chain\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
