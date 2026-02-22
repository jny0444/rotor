import { Noir, type CompiledCircuit } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import type { ProofData } from "@aztec/bb.js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const circuit = require("./circuit.json") as CompiledCircuit;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Inputs needed to generate a withdrawal proof */
export interface WithdrawProofInputs {
  root: string;
  nullifierHash: string;
  recipient: string;
  amount: string;           // Amount as field element (hex), same as in commitment

  nullifier: string;
  secret: string;
  merkleProof: string[];
  isEven: boolean[];
}

/** Result of proof generation. publicInputs = [root, nullifierHash, recipient, amount]. */
export interface WithdrawProofResult {
  proof: Uint8Array;
  publicInputs: string[];
}

// ---------------------------------------------------------------------------
// Proof generation
// ---------------------------------------------------------------------------

/**
 * Generate a ZK proof for withdrawal.
 *
 * This runs the Noir circuit with the given inputs:
 * 1. Executes the circuit to generate a witness (validates constraints)
 * 2. Generates an UltraHonk proof from the witness
 *
 * The proof demonstrates knowledge of (nullifier, secret, merkleProof, isEven)
 * such that:
 *   - commitment = Poseidon2(nullifier, secret) is a leaf in the Merkle tree
 *   - nullifierHash = Poseidon2(nullifier)
 *   - The tree root matches the provided root
 *
 * Without revealing WHICH leaf in the tree corresponds to the withdrawal.
 */
export async function generateWithdrawProof(
  inputs: WithdrawProofInputs
): Promise<WithdrawProofResult> {
  // Map our inputs to the circuit's expected format
  const circuitInputs = {
    root: inputs.root,
    nullifier_hash: inputs.nullifierHash,
    recipient: inputs.recipient,
    amount: inputs.amount,
    nullifier: inputs.nullifier,
    secret: inputs.secret,
    merkleProof: inputs.merkleProof,
    is_even: inputs.isEven,
  };

  // 1. Execute the circuit (generates witness + validates constraints)
  console.log("[Prover] Executing Noir circuit to generate witness...");
  const noir = new Noir(circuit);
  const { witness } = await noir.execute(circuitInputs);
  console.log("[Prover] Witness generation successful.");

  // 2. Generate the proof using Barretenberg (UltraHonkBackend)
  // Note: Powers of Tau / CRS (Common Reference String) is automatically
  // initialized, fetched, and cached by bb.js during backend construction/proving.
  console.log("[Prover] Initializing Barretenberg UltraHonkBackend (fetching Powers of Tau SRS if needed)...");
  const backend = new UltraHonkBackend(circuit.bytecode);
  
  console.log("[Prover] Generating ZK proof with Barretenberg...");
  const proofData: ProofData = await backend.generateProof(witness);
  console.log("[Prover] ZK Proof successfully generated! Proof length:", proofData.proof.length, "bytes.");

  // Clean up
  await backend.destroy();

  return {
    proof: proofData.proof,
    publicInputs: proofData.publicInputs,
  };
}

// ---------------------------------------------------------------------------
// Proof verification (client-side, for testing)
// ---------------------------------------------------------------------------

/**
 * Verify a withdrawal proof locally.
 * In production, this would happen on-chain or via a relayer.
 */
export async function verifyWithdrawProof(
  proof: Uint8Array,
  publicInputs: string[]
): Promise<boolean> {
  const backend = new UltraHonkBackend(circuit.bytecode);

  const verified = await backend.verifyProof({
    proof,
    publicInputs,
  });

  await backend.destroy();
  return verified;
}

// ---------------------------------------------------------------------------
// Verification key (for on-chain deployment)
// ---------------------------------------------------------------------------

/**
 * Get the verification key for the circuit.
 * This is needed for on-chain verification setup.
 */
export async function getVerificationKey(): Promise<Uint8Array> {
  const backend = new UltraHonkBackend(circuit.bytecode);
  const vk = await backend.getVerificationKey();
  await backend.destroy();
  return vk;
}
