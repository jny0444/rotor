import { Barretenberg, randomBytes } from "@aztec/bb.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CommitmentResult {
  /** The commitment hash (leaf for the Merkle tree) = Poseidon2(nullifier, secret) */
  commitment: string;
  /** Random nullifier (private — kept by depositor, shared with recipient) */
  nullifier: string;
  /** Random secret (private — shared with recipient for withdrawal) */
  secret: string;
  /** Hash of the nullifier (public — used to prevent double-spending) */
  nullifierHash: string;
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

/** Generate a random 32-byte field element */
function randomField(): Uint8Array {
  return randomBytes(32);
}

// ---------------------------------------------------------------------------
// Generate a commitment matching the Noir circuit:
//
//   commitment       = Poseidon2::hash([nullifier, secret], 2)
//   nullifier_hash   = Poseidon2::hash([nullifier], 1)
//   _binding         = Poseidon2::hash([secret, recipient], 2)
//
// The depositor generates (nullifier, secret) and stores the commitment
// on-chain in the Merkle tree. The nullifier + secret are shared with the
// recipient off-chain so they can later prove knowledge and withdraw.
// ---------------------------------------------------------------------------
export async function generateCommitment(): Promise<CommitmentResult> {
  const bb = await Barretenberg.new();

  // 1. Generate random nullifier and secret (32-byte field elements)
  const nullifier = randomField();
  const secret = randomField();

  // 2. Compute commitment = Poseidon2(nullifier, secret)
  //    This matches: let commitment: Field = Poseidon2::hash([nullifier, secret], 2);
  //    The API takes { inputs: Uint8Array[] } and returns { hash: Uint8Array }
  const commitmentResult = await bb.poseidon2Hash({ inputs: [nullifier, secret] });

  // 3. Compute nullifier hash = Poseidon2(nullifier)
  //    This matches: let computed_nullifier_hash: Field = Poseidon2::hash([nullifier], 1);
  const nullifierHashResult = await bb.poseidon2Hash({ inputs: [nullifier] });

  await bb.destroy();

  return {
    commitment: toHex(commitmentResult.hash),
    nullifier: toHex(nullifier),
    secret: toHex(secret),
    nullifierHash: toHex(nullifierHashResult.hash),
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
// CLI entry point — run with: npx ts-node lib/commitment.ts
// ---------------------------------------------------------------------------
if (typeof process !== "undefined" && process.argv[1]?.includes("commitment")) {
  (async () => {
    try {
      const result = await generateCommitment();
      console.log("=== Commitment Generated ===");
      console.log("commitment:    ", result.commitment);
      console.log("nullifier:     ", result.nullifier);
      console.log("secret:        ", result.secret);
      console.log("nullifierHash: ", result.nullifierHash);
      process.exit(0);
    } catch (error) {
      console.error("Error generating commitment:", error);
      process.exit(1);
    }
  })();
}
