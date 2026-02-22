import { Barretenberg, randomBytes } from "@aztec/bb.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CommitmentResult {
  /** The commitment hash (leaf) = Poseidon2(nullifier, secret, amount) — amount is bound */
  commitment: string;
  nullifier: string;
  secret: string;
  nullifierHash: string;
  /** Amount in stroops, encoded as field element for the circuit */
  amountField: string;
}

// ---------------------------------------------------------------------------
// Helpers — work with raw 32-byte Uint8Arrays since Fr isn't publicly exported
// ---------------------------------------------------------------------------

/** Convert a 32-byte Uint8Array to a 0x-prefixed hex string */
function toHex(buf: Uint8Array): string {
  return (
    "0x" +
    Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Generate a random 32-byte field element safe for BN254.
 * The BN254 field modulus is ~2^254, so we zero the top byte
 * to ensure values stay well below the modulus.
 */
function randomField(): Uint8Array {
  const buf = randomBytes(32);
  buf[0] = 0; // ensure < BN254 field modulus
  return buf;
}

// ---------------------------------------------------------------------------
// Encode amount (stroops) as a 32-byte field element for the circuit.
// BN254 field is ~2^254 so any realistic stroops value fits.
// ---------------------------------------------------------------------------
export function amountToFieldHex(amountStroops: number): string {
  const hex = BigInt(amountStroops).toString(16).padStart(64, "0");
  return "0x" + hex;
}

/** Parse field hex (from proof public inputs) back to stroops */
export function fieldHexToAmount(fieldHex: string): number {
  const hex = fieldHex.startsWith("0x") ? fieldHex : "0x" + fieldHex;
  const n = BigInt(hex);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount too large");
  return Number(n);
}

// ---------------------------------------------------------------------------
// Generate a commitment matching the Noir circuit:
//
//   commitment       = Poseidon2::hash([nullifier, secret, amount], 3)  — amount bound
//   nullifier_hash   = Poseidon2::hash([nullifier], 1)
//   _binding         = Poseidon2::hash([secret, recipient], 2)
//
// The amount is bound in the commitment so the note can only be spent for that amount.
// ---------------------------------------------------------------------------
export async function generateCommitment(amountStroops: number): Promise<CommitmentResult> {
  const bb = await Barretenberg.new();

  const nullifier = randomField();
  const secret = randomField();
  const amountField = hexToBytes(amountToFieldHex(amountStroops));

  const commitmentResult = await bb.poseidon2Hash({
    inputs: [nullifier, secret, amountField],
  });
  const nullifierHashResult = await bb.poseidon2Hash({ inputs: [nullifier] });

  await bb.destroy();

  return {
    commitment: toHex(commitmentResult.hash),
    nullifier: toHex(nullifier),
    secret: toHex(secret),
    nullifierHash: toHex(nullifierHashResult.hash),
    amountField: amountToFieldHex(amountStroops),
  };
}

// ---------------------------------------------------------------------------
// Compute the recipient binding hash (for verification purposes)
//
//   binding = Poseidon2::hash([secret, recipient], 2)
//
// The recipient uses this during withdrawal to prove they are the
// intended recipient without revealing the secret publicly.
// ---------------------------------------------------------------------------
export async function computeRecipientBinding(
  secretHex: string,
  recipientHex: string
): Promise<string> {
  const bb = await Barretenberg.new();

  const secretBuf = hexToBytes(secretHex);
  const recipientBuf = hexToBytes(recipientHex);

  const result = await bb.poseidon2Hash({ inputs: [secretBuf, recipientBuf] });
  await bb.destroy();

  return toHex(result.hash);
}

/** Convert a hex string (with or without 0x prefix) to a 32-byte Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = clean.padStart(64, "0"); // ensure 32 bytes
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.substr(i * 2, 2), 16);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// CLI entry point — run with: npx tsx lib/commitment.ts [amount_stroops]
// ---------------------------------------------------------------------------
if (typeof process !== "undefined" && process.argv[1]?.includes("commitment")) {
  (async () => {
    try {
      const stroops = Number(process.argv[2]) || 10_000_000;
      const result = await generateCommitment(stroops);
      console.log("=== Commitment Generated ===");
      console.log("commitment:    ", result.commitment);
      console.log("nullifier:     ", result.nullifier);
      console.log("secret:        ", result.secret);
      console.log("nullifierHash: ", result.nullifierHash);
      console.log("amountField:   ", result.amountField);
      console.log("amountStroops: ", stroops);
      process.exit(0);
    } catch (error) {
      console.error("Error generating commitment:", error);
      process.exit(1);
    }
  })();
}
