/**
 * Standalone test: commitment → proof generation → verification
 *
 * Run with:  npx tsx lib/test-prover.ts
 */

import { Barretenberg, randomBytes } from "@aztec/bb.js";
import { Noir, type CompiledCircuit } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const circuit = require("./circuit.json") as CompiledCircuit;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toHex(buf: Uint8Array): string {
  return (
    "0x" +
    Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function randomField(): Uint8Array {
  return randomBytes(32);
}

/**
 * Generate a random 32-byte value that is safe for BN254 field.
 * The BN254 field modulus is ~2^254, so we zero the top byte
 * to ensure values stay well below the modulus.
 */
function randomFieldSafe(): Uint8Array {
  const buf = randomBytes(32);
  buf[0] = 0; // ensure < field modulus (~2^254)
  return buf;
}

// ---------------------------------------------------------------------------
// Precomputed zero hashes (must match the contract + circuit)
// ---------------------------------------------------------------------------
const ZERO_HASHES = [
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
];

const TREE_DEPTH = 20;

// ---------------------------------------------------------------------------
// Main test
// ---------------------------------------------------------------------------
async function main() {
  console.log("🔐 Rotor Prover Test — Full Lifecycle\n");

  // 1. Generate commitment (circuit uses commitment = H(nullifier, secret, amount))
  const AMOUNT_STROOPS = 10_000_000; // 1 XLM
  const amountFieldHex = "0x" + BigInt(AMOUNT_STROOPS).toString(16).padStart(64, "0");
  const amountBytes = hexToBytes(amountFieldHex);

  console.log("1️⃣  Generating commitment (amount bound)...");
  const bb = await Barretenberg.new();

  const nullifier = randomFieldSafe();
  const secret = randomFieldSafe();

  const commitmentResult = await bb.poseidon2Hash({
    inputs: [nullifier, secret, amountBytes],
  });
  const commitment = commitmentResult.hash;

  const nullifierHashResult = await bb.poseidon2Hash({ inputs: [nullifier] });
  const nullifierHash = nullifierHashResult.hash;

  console.log("   ✅ Commitment:", toHex(commitment));
  console.log("   ✅ Nullifier Hash:", toHex(nullifierHash));
  console.log("   ✅ Amount (stroops):", AMOUNT_STROOPS);

  // 2. Build a Merkle tree with this single leaf at index 0
  // For a single leaf at index 0, all siblings are the zero hashes.
  // At each level, the leaf is the left child (is_even = true),
  // and the sibling is the zero hash at that level.
  console.log("\n2️⃣  Computing Merkle root for single-leaf tree...");

  let currentHash = commitment;
  const merkleProof: string[] = [];
  const isEven: boolean[] = [];

  for (let i = 0; i < TREE_DEPTH; i++) {
    // Leaf index 0 → always even (left child), sibling is zero hash
    isEven.push(true);
    merkleProof.push(ZERO_HASHES[i]);

    // Hash: Poseidon2(currentHash, zeroHash)
    const siblingHex = ZERO_HASHES[i];
    const siblingBytes = hexToBytes(siblingHex);
    const hashResult = await bb.poseidon2Hash({
      inputs: [currentHash, siblingBytes],
    });
    currentHash = hashResult.hash;
  }

  const root = toHex(currentHash);
  console.log("   ✅ Computed root:", root);

  await bb.destroy();

  // 3. Generate the ZK proof
  console.log("\n3️⃣  Generating ZK proof (this may take a moment)...");
  const startTime = Date.now();

  const recipient = toHex(randomFieldSafe()); // random recipient address as field

  const circuitInputs = {
    root,
    nullifier_hash: toHex(nullifierHash),
    recipient,
    amount: amountFieldHex,
    nullifier: toHex(nullifier),
    secret: toHex(secret),
    merkleProof,
    is_even: isEven,
  };

  console.log("   Circuit inputs:", JSON.stringify(circuitInputs, null, 2));

  const noir = new Noir(circuit);
  const { witness } = await noir.execute(circuitInputs);
  console.log(
    `   ✅ Witness generated (${((Date.now() - startTime) / 1000).toFixed(2)}s)`
  );

  const backend = new UltraHonkBackend(circuit.bytecode);
  const proofData = await backend.generateProof(witness);
  const proofTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   ✅ Proof generated (${proofTime}s total)`);
  console.log(`   Proof size: ${proofData.proof.length} bytes`);
  console.log(`   Public inputs: ${JSON.stringify(proofData.publicInputs)}`);

  // 4. Verify the proof
  console.log("\n4️⃣  Verifying proof...");
  const valid = await backend.verifyProof({
    proof: proofData.proof,
    publicInputs: proofData.publicInputs,
  });

  await backend.destroy();

  if (valid) {
    console.log("   ✅ Proof is VALID! ✅");
  } else {
    console.error("   ❌ Proof is INVALID! ❌");
    process.exit(1);
  }

  console.log("\n🎉 Full lifecycle test passed!");
  console.log("   Commitment → Merkle Root → ZK Proof → Verification ✓\n");
  process.exit(0);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = clean.padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.substr(i * 2, 2), 16);
  }
  return bytes;
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
