"use client";

import { useState } from "react";
import { IoIosSend } from "react-icons/io";
import { FaRegPaste } from "react-icons/fa6";
import { useWallet } from "../utils/WalletProvider";
import { generateWithdrawProof, WithdrawProofInputs } from "../lib/prover";
import { amountToFieldHex } from "../lib/commitment";
import { Barretenberg } from "@aztec/bb.js";

type WithdrawStatus =
  | { stage: "idle" }
  | { stage: "parsing" }
  | { stage: "merkle" }
  | { stage: "proving" }
  | { stage: "submitting" }
  | { stage: "success"; message: string; txHash?: string }
  | { stage: "error"; message: string };

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || "http://localhost:3001";

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

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = clean.padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.substr(i * 2, 2), 16);
  }
  return bytes;
}

function toHex(buf: Uint8Array): string {
  return (
    "0x" +
    Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

import { StrKey } from "@stellar/stellar-sdk";

// Extract the 32-byte Ed25519 public key from either a G... or M... address
function decodeEd25519(address: string): Uint8Array {
  if (StrKey.isValidMed25519PublicKey(address)) {
    // M... muxed address: payload is ed25519 (32 bytes) + memo id (8 bytes)
    return new Uint8Array(StrKey.decodeMed25519PublicKey(address).slice(0, 32));
  }
  return StrKey.decodeEd25519PublicKey(address);
}

// Convert a G... or M... Stellar address to a BN254 field element
async function addressToField(address: string): Promise<string> {
  const decoded = decodeEd25519(address);
  // Zero out the first byte to keep the value below the BN254 field modulus (~2^254)
  decoded[0] = 0;
  return toHex(decoded);
}

// Convert M... to G... for Soroban contract calls (Soroban only accepts G... or C...)
function toBaseAddress(address: string): string {
  if (StrKey.isValidMed25519PublicKey(address)) {
    const ed25519 = StrKey.decodeMed25519PublicKey(address).slice(0, 32);
    return StrKey.encodeEd25519PublicKey(Buffer.from(ed25519));
  }
  return address;
}

export default function Withdraw() {
  const [noteJson, setNoteJson] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<WithdrawStatus>({ stage: "idle" });

  const { isConnected } = useWallet();

  const isLoading = ["parsing", "merkle", "proving", "submitting"].includes(
    status.stage
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      setStatus({ stage: "error", message: "Please connect your wallet first" });
      return;
    }

    if (!recipient.trim()) {
      setStatus({ stage: "error", message: "Enter a recipient address" });
      return;
    }

    if (!noteJson.trim()) {
      setStatus({ stage: "error", message: "Enter your withdrawal note" });
      return;
    }

    try {
      setStatus({ stage: "parsing" });
      let note;
      try {
        note = JSON.parse(noteJson);
      } catch {
        // Might be just pasting line by line, let's try a heuristic if simple JSON parse fails
        // but for now require JSON.
        throw new Error("Invalid note format. Please paste the JSON object exactly as saved.");
      }

      const { nullifier, secret, nullifierHash, amountStroops, amountField: noteAmountField } = note;
      if (!nullifier || !secret || !nullifierHash) {
        throw new Error("Note is missing required fields (nullifier, secret, nullifierHash)");
      }
      if (!amountStroops || Number(amountStroops) <= 0) {
        throw new Error("Note is missing amountStroops (positive number required)");
      }

      const amountField = noteAmountField || amountToFieldHex(Number(amountStroops));

      // Compute the commitment and Merkle root using Barretenberg.
      // This matches exactly what the Noir circuit will compute internally,
      // so the constraint `computed_root == root` will always pass.
      setStatus({ stage: "merkle" });
      console.log("[Withdraw] Computing commitment & Merkle root with Barretenberg…");

      const bb = await Barretenberg.new();
      const commitmentRes = await bb.poseidon2Hash({
        inputs: [hexToBytes(nullifier), hexToBytes(secret), hexToBytes(amountField)],
      });
      let currentHash = commitmentRes.hash;
      console.log("[Withdraw] commitment =", toHex(currentHash));

      const merkleProof: string[] = [];
      const isEven: boolean[] = [];

      for (let i = 0; i < TREE_DEPTH; i++) {
        isEven.push(true);
        merkleProof.push(ZERO_HASHES[i]);
        const sibling = hexToBytes(ZERO_HASHES[i]);
        const hashRes = await bb.poseidon2Hash({ inputs: [currentHash, sibling] });
        currentHash = hashRes.hash;
      }
      const root = toHex(currentHash);
      await bb.destroy();
      console.log("[Withdraw] Barretenberg root =", root);

      setStatus({ stage: "proving" });
      console.log("[Withdraw] Generating ZK proof…");

      const recipientField = await addressToField(recipient.trim());

      const inputs: WithdrawProofInputs = {
        root,
        nullifierHash,
        recipient: recipientField,
        amount: amountField,
        nullifier,
        secret,
        merkleProof,
        isEven,
      };

      const result = await generateWithdrawProof(inputs);
      console.log("✅ ZK proof generated.");
      const proofHex = Buffer.from(result.proof).toString("hex");
      console.log(`Proof Bytes (first 64 chars): ${proofHex.substring(0, 64)}...`);
      console.log("Public Inputs:", result.publicInputs);

      setStatus({ stage: "submitting" });
      console.log("🚀 Submitting to Relayer...");

      // Relayer gets amount from proof publicInputs[3], not from the request body.
      const res = await fetch(`${RELAYER_URL}/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proof: Array.from(result.proof),
          publicInputs: result.publicInputs,
          recipient: recipient.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Relayer error");
      }

      console.log("Withdrawal confirmed by relayer:", data.txHash);
      setStatus({ stage: "success", message: data.message, txHash: data.txHash });
      setNoteJson("");
      setRecipient("");

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      console.error("❌ Withdrawal Error:", message, err);
      setStatus({ stage: "error", message });
    }
  };

  const buttonLabel = () => {
    switch (status.stage) {
      case "parsing":
        return "Parsing note…";
      case "merkle":
        return "Computing Tree…";
      case "proving":
        return "Generating ZK Proof…";
      case "submitting":
        return "Notifying Relayer…";
      default:
        return "Avail Balance";
    }
  };

  return (
    <div className="my-8 w-full max-w-md mx-auto px-4 sm:px-0">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col">
          
          <div className="px-5 pt-6 pb-2">
            <h2 className="text-xl font-semibold text-gray-800 sora-font mb-4">Avail Balance (Withdraw)</h2>
            <div className="flex flex-col gap-4">
              
              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-500 sora-font">Withdrawal Note (JSON)</label>
                <textarea
                  value={noteJson}
                  onChange={(e) => setNoteJson(e.target.value)}
                  placeholder={'{"commitment":"0x...","nullifier":"0x...","secret":"0x...","nullifierHash":"0x...","amountStroops":10000000,"root":"0x..."}'}
                  rows={4}
                  className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 focus-within:border-[#9EB8E9] focus-within:ring-2 focus-within:ring-[#9EB8E9]/30 transition-all text-sm text-gray-800 placeholder-gray-300 ibm-plex-mono-regular outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 focus-within:border-[#9EB8E9] focus-within:ring-2 focus-within:ring-[#9EB8E9]/30 transition-all">
                <label className="text-sm text-gray-400 sora-font shrink-0">To</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="G... or M... address"
                  className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-300 ibm-plex-mono-regular"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setRecipient(text.trim());
                    } catch {}
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0"
                  title="Paste from clipboard"
                >
                  <FaRegPaste size={16} />
                </button>
              </div>

            </div>
          </div>

          {status.stage === "success" && (
            <div className="mx-5 my-4 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm sora-font animate-[fadeIn_0.3s_ease-out]">
              <p className="font-semibold text-center">{status.message || "Withdrawal successful! ✓"}</p>
              {status.txHash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${status.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-xs text-center break-all text-emerald-600 underline underline-offset-2 hover:text-emerald-800 transition-colors"
                >
                  {status.txHash}
                </a>
              )}
            </div>
          )}

          {status.stage === "error" && (
            <div className="mx-5 my-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm sora-font animate-[fadeIn_0.3s_ease-out]">
              {status.message}
            </div>
          )}

          <div className="px-5 pb-5 pt-3">
            <button
              type="submit"
              disabled={isLoading || !isConnected}
              className="w-full py-4 rounded-2xl bg-linear-to-r from-[#1D2143] to-[#040215] text-white text-lg font-semibold sora-font shadow-[0_4px_20px_rgba(29,33,67,0.4)] hover:shadow-[0_6px_28px_rgba(29,33,67,0.6)] hover:from-[#161a38] hover:to-[#030110] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {buttonLabel()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
