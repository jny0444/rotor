"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { IoIosSend } from "react-icons/io";
import { FaRegPaste } from "react-icons/fa6";
import { LuScanFace } from "react-icons/lu";
import { Html5Qrcode } from "html5-qrcode";
import { StrKey } from "@stellar/stellar-sdk";
import { Barretenberg } from "@aztec/bb.js";
import { useWallet } from "../utils/WalletProvider";
import {
  buildFundContractTx,
  buildDepositTx,
  submitSorobanTx,
} from "../lib/stellar";
import { generateCommitment, amountToFieldHex } from "../lib/commitment";
import { generateWithdrawProof, type WithdrawProofInputs } from "../lib/prover";

const RELAYER_URL =
  process.env.NEXT_PUBLIC_RELAYER_URL || "http://localhost:3001";

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
// Helpers
// ---------------------------------------------------------------------------

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

function addressToField(address: string): string {
  let decoded: Uint8Array;
  if (StrKey.isValidMed25519PublicKey(address)) {
    decoded = new Uint8Array(
      StrKey.decodeMed25519PublicKey(address).slice(0, 32),
    );
  } else {
    decoded = StrKey.decodeEd25519PublicKey(address);
  }
  decoded[0] = 0;
  return toHex(decoded);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type TxStatus =
  | { stage: "idle" }
  | { stage: "generating" }
  | { stage: "funding" }
  | { stage: "signing-fund" }
  | { stage: "submitting-fund" }
  | { stage: "building" }
  | { stage: "signing" }
  | { stage: "depositing" }
  | { stage: "computing" }
  | { stage: "proving" }
  | { stage: "relaying" }
  | {
      stage: "success";
      fundHash: string;
      depositHash: string;
      withdrawHash: string;
      xlmAmount: string;
      elapsedSec: string;
    }
  | { stage: "error"; message: string };

export default function Swap() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [showUsd, setShowUsd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>({ stage: "idle" });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-scanner-container";

  const { address, balance, isConnected, signTransaction, refreshBalance } =
    useWallet();

  const isLoading = [
    "generating",
    "funding",
    "signing-fund",
    "submitting-fund",
    "building",
    "signing",
    "depositing",
    "computing",
    "proving",
    "relaying",
  ].includes(txStatus.stage);

  const intDigits = ((amount || "0").split(".")[0] || "0").length;
  const amountSizeClass =
    intDigits > 12
      ? "text-lg sm:text-xl"
      : intDigits > 9
        ? "text-xl sm:text-2xl"
        : intDigits > 7
          ? "text-2xl sm:text-3xl"
          : intDigits > 5
            ? "text-3xl sm:text-4xl"
            : "text-4xl sm:text-6xl";
  const suffixSizeClass =
    intDigits > 12
      ? "text-sm sm:text-base"
      : intDigits > 9
        ? "text-base sm:text-lg"
        : intDigits > 7
          ? "text-lg sm:text-xl"
          : intDigits > 5
            ? "text-xl sm:text-2xl"
            : "text-2xl sm:text-4xl";

  // ---------------------------------------------------------------------------
  // QR Scanner
  // ---------------------------------------------------------------------------
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
        }
      } catch {
        /* already stopped */
      }
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setShowScanner(false);
  }, []);

  const startScanner = useCallback(async () => {
    setShowScanner(true);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setRecipient(decodedText.trim());
          stopScanner();
        },
        () => {},
      );
    } catch (err) {
      console.error("Failed to start QR scanner:", err);
      stopScanner();
    }
  }, [stopScanner]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().then(() => scannerRef.current?.clear());
        } catch {
          /* */
        }
      }
    };
  }, []);

  const handleUseHalf = () => setAmount(String(balance / 2));
  const handleUseMax = () => setAmount(String(balance));

  // ---------------------------------------------------------------------------
  // Full send flow: deposit → Merkle root → ZK proof → relayer withdrawal
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !isConnected) {
      setTxStatus({
        stage: "error",
        message: "Please connect your wallet first",
      });
      return;
    }
    const recipientAddr = recipient.trim();
    if (!recipientAddr) {
      setTxStatus({ stage: "error", message: "Enter a destination address" });
      return;
    }
    if (
      !StrKey.isValidEd25519PublicKey(recipientAddr) &&
      !StrKey.isValidMed25519PublicKey(recipientAddr)
    ) {
      setTxStatus({ stage: "error", message: "Invalid Stellar address" });
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTxStatus({ stage: "error", message: "Enter a valid amount" });
      return;
    }
    if (parsedAmount > balance) {
      setTxStatus({ stage: "error", message: "Insufficient XLM balance" });
      return;
    }

    const stroops = Math.round(parsedAmount * 10_000_000);

    const t0 = Date.now();

    try {
      // ---- 1. Generate commitment: H(nullifier, secret, amount) ----
      setTxStatus({ stage: "generating" });
      const commitmentData = await generateCommitment(stroops);

      // ---- 2. Fund the contract (SAC transfer, separate from deposit) ----
      setTxStatus({ stage: "funding" });
      const fundXdr = await buildFundContractTx(address, stroops);

      setTxStatus({ stage: "signing-fund" });
      const signedFundXdr = await signTransaction(fundXdr);

      setTxStatus({ stage: "submitting-fund" });
      const fundResult = await submitSorobanTx(signedFundXdr);
      if (!fundResult.success) {
        throw new Error(fundResult.message);
      }
      const fundHash = fundResult.hash;
      console.log("[Send] Contract funded:", fundHash);

      // ---- 3. Store commitment on-chain (no amount in this call) ----
      setTxStatus({ stage: "building" });
      const depositXdr = await buildDepositTx(
        address,
        commitmentData.commitment,
      );

      setTxStatus({ stage: "signing" });
      const signedDepositXdr = await signTransaction(depositXdr);

      setTxStatus({ stage: "depositing" });
      const depositResult = await submitSorobanTx(signedDepositXdr);
      if (!depositResult.success) {
        throw new Error(depositResult.message);
      }
      const depositHash = depositResult.hash;
      console.log("[Send] Commitment stored:", depositHash);

      // ---- 5. Compute Merkle root with Barretenberg ----
      setTxStatus({ stage: "computing" });
      const amountField = amountToFieldHex(stroops);
      const bb = await Barretenberg.new();

      const commitmentRes = await bb.poseidon2Hash({
        inputs: [
          hexToBytes(commitmentData.nullifier),
          hexToBytes(commitmentData.secret),
          hexToBytes(amountField),
        ],
      });
      let currentHash = commitmentRes.hash;

      const merkleProof: string[] = [];
      const isEven: boolean[] = [];
      for (let i = 0; i < TREE_DEPTH; i++) {
        isEven.push(true);
        merkleProof.push(ZERO_HASHES[i]);
        const sibling = hexToBytes(ZERO_HASHES[i]);
        const hashRes = await bb.poseidon2Hash({
          inputs: [currentHash, sibling],
        });
        currentHash = hashRes.hash;
      }
      const root = toHex(currentHash);
      await bb.destroy();

      // ---- 6. Generate ZK proof ----
      setTxStatus({ stage: "proving" });
      const recipientField = addressToField(recipientAddr);

      const proofInputs: WithdrawProofInputs = {
        root,
        nullifierHash: commitmentData.nullifierHash,
        recipient: recipientField,
        amount: amountField,
        nullifier: commitmentData.nullifier,
        secret: commitmentData.secret,
        merkleProof,
        isEven,
      };

      const proofResult = await generateWithdrawProof(proofInputs);
      console.log(
        "[Send] ZK proof generated, size:",
        proofResult.proof.length,
        "bytes",
      );

      // ---- 7. Send proof to relayer for on-chain withdrawal ----
      setTxStatus({ stage: "relaying" });
      const res = await fetch(`${RELAYER_URL}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof: Array.from(proofResult.proof),
          publicInputs: proofResult.publicInputs,
          recipient: recipientAddr,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Relayer error");
      }

      const xlmAmount = (stroops / 10_000_000).toFixed(7);
      const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        "[Send] Withdrawal confirmed:",
        data.txHash,
        `(~${elapsedSec}s)`,
      );

      setTxStatus({
        stage: "success",
        fundHash,
        depositHash,
        withdrawHash: data.txHash,
        xlmAmount,
        elapsedSec,
      });
      setRecipient("");
      setAmount("");
      await refreshBalance();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      console.error("[Send] Error:", message, err);
      if (
        message.toLowerCase().includes("rejected") ||
        message.toLowerCase().includes("cancel")
      ) {
        setTxStatus({
          stage: "error",
          message: "Transaction signing was cancelled",
        });
      } else {
        setTxStatus({ stage: "error", message });
      }
    }
  };

  useEffect(() => {
    if (txStatus.stage === "error") {
      const t = setTimeout(() => setTxStatus({ stage: "idle" }), 12000);
      return () => clearTimeout(t);
    }
  }, [txStatus]);

  const buttonLabel = () => {
    switch (txStatus.stage) {
      case "generating":
        return "Generating commitment…";
      case "funding":
        return "Building transfer…";
      case "signing-fund":
        return "Sign transfer in wallet…";
      case "submitting-fund":
        return "Transferring XLM…";
      case "building":
        return "Building deposit…";
      case "signing":
        return "Sign deposit in wallet…";
      case "depositing":
        return "Storing commitment…";
      case "computing":
        return "Computing Merkle root…";
      case "proving":
        return "Generating ZK proof…";
      case "relaying":
        return "Sending to recipient…";
      default:
        return (
          <>
            Send <IoIosSend />
          </>
        );
    }
  };

  return (
    <div className="my-8 w-full max-w-md mx-auto px-4 sm:px-0">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* To field */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startScanner}
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-100 text-gray-400 hover:text-[#9EB8E9] hover:border-[#9EB8E9]/40 transition-all cursor-pointer active:scale-90"
                title="Scan QR code"
              >
                <LuScanFace size={20} />
              </button>
              <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 focus-within:border-[#9EB8E9] focus-within:ring-2 focus-within:ring-[#9EB8E9]/30 transition-all">
                <label
                  htmlFor="swap-recipient"
                  className="text-sm text-gray-400 sora-font shrink-0"
                >
                  To
                </label>
                <input
                  id="swap-recipient"
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
                    } catch {
                      /* clipboard denied */
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0"
                  title="Paste from clipboard"
                >
                  <FaRegPaste size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="flex flex-col items-center py-6 px-5">
            <div className="relative w-full flex justify-center">
              <div
                className={`text-center ${amountSizeClass} font-light text-gray-800 w-full sora-font flex items-center justify-center min-w-0 overflow-hidden transition-all duration-200`}
              >
                {showUsd && <span className="text-gray-400">$</span>}
                <input
                  id="swap-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9]*\.?[0-9]*$/.test(val)) setAmount(val);
                  }}
                  placeholder="0"
                  className={`text-center ${amountSizeClass} font-light text-gray-800 bg-transparent outline-none sora-font placeholder-gray-300 transition-all duration-200`}
                  style={{
                    width: `${Math.max(1, (amount || "0").length + 1)}ch`,
                    maxWidth: "80%",
                  }}
                />
                {!showUsd && (
                  <span
                    className={`text-gray-400 ${suffixSizeClass} ml-2 shrink-0 transition-all duration-200`}
                  >
                    XLM
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowUsd(!showUsd)}
              className="mt-3 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors sora-font cursor-pointer"
            >
              <span>
                {showUsd
                  ? `${Number(amount || 0).toFixed(2)} XLM`
                  : `$${(Number(amount || 0) * 0.16).toFixed(2)}`}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* Token selector */}
          <div className="mx-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="rounded-xl flex items-center justify-center overflow-hidden shadow-sm">
                <Image
                  src="/stellar.svg"
                  alt="Stellar"
                  width={28}
                  height={28}
                  className="w-10 h-10"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-800 sora-font">
                  Stellar
                </span>
                <span className="text-xs text-gray-400 ibm-plex-mono-regular">
                  {balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}{" "}
                  XLM
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUseHalf}
                className="px-3.5 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:border-gray-300 active:scale-95 transition-all sora-font cursor-pointer shadow-sm"
              >
                1/2
              </button>
              <button
                type="button"
                onClick={handleUseMax}
                className="px-3.5 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:border-gray-300 active:scale-95 transition-all sora-font cursor-pointer shadow-sm"
              >
                MAX
              </button>
              <button
                type="button"
                onClick={() => setAmount("")}
                className="px-3.5 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-500 hover:border-red-200 active:scale-95 transition-all sora-font cursor-pointer shadow-sm"
              >
                CLR
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {isLoading && (
            <div className="mx-5 mb-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 sora-font mb-2">
                <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                <span>{buttonLabel()}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-[#1D2143] to-[#040215] rounded-full transition-all duration-500"
                  style={{
                    width:
                      txStatus.stage === "generating"
                        ? "5%"
                        : txStatus.stage === "funding"
                          ? "10%"
                          : txStatus.stage === "signing-fund"
                            ? "15%"
                            : txStatus.stage === "submitting-fund"
                              ? "25%"
                              : txStatus.stage === "building"
                                ? "30%"
                                : txStatus.stage === "signing"
                                  ? "35%"
                                  : txStatus.stage === "depositing"
                                    ? "45%"
                                    : txStatus.stage === "computing"
                                      ? "55%"
                                      : txStatus.stage === "proving"
                                        ? "75%"
                                        : txStatus.stage === "relaying"
                                          ? "90%"
                                          : "0%",
                  }}
                />
              </div>
            </div>
          )}

          {/* Success */}
          {txStatus.stage === "success" && (
            <div className="mx-5 mb-4 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm sora-font animate-[fadeIn_0.3s_ease-out] relative">
              <button
                onClick={() => setTxStatus({ stage: "idle" })}
                className="absolute top-2 right-2 text-emerald-400 hover:text-emerald-700 transition-colors cursor-pointer"
                aria-label="Dismiss"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <p className="font-semibold text-center">
                {txStatus.xlmAmount} XLM sent privately in{" "}
                <span className="font-normal text-emerald-500">
                  ~{txStatus.elapsedSec}s
                </span>
              </p>
              <div className="mt-2 space-y-1">
                {[
                  { label: "Fund", hash: txStatus.fundHash },
                  { label: "Commit", hash: txStatus.depositHash },
                  { label: "Withdraw", hash: txStatus.withdrawHash },
                ].map(({ label, hash }) => (
                  <a
                    key={label}
                    href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[11px] ibm-plex-mono-regular text-center break-all text-emerald-600 underline underline-offset-2 hover:text-emerald-800 transition-colors"
                  >
                    {label}: {hash.slice(0, 12)}…{hash.slice(-8)}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {txStatus.stage === "error" && (
            <div className="mx-5 mb-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm sora-font animate-[fadeIn_0.3s_ease-out]">
              {txStatus.message}
            </div>
          )}

          {/* Submit button */}
          <div className="px-5 pb-5">
            <button
              id="swap-confirm"
              type="submit"
              disabled={isLoading || !isConnected}
              className="w-full py-4 rounded-2xl bg-linear-to-r from-[#1D2143] to-[#040215] text-white text-lg font-semibold sora-font shadow-[0_4px_20px_rgba(29,33,67,0.4)] hover:shadow-[0_6px_28px_rgba(29,33,67,0.6)] hover:from-[#161a38] hover:to-[#030110] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {!isLoading && buttonLabel()}
              {isLoading && "Processing…"}
            </button>
          </div>
        </form>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <LuScanFace size={20} className="text-[#1D2143]" />
                <span className="text-sm font-semibold text-gray-800 sora-font">
                  Scan QR Code
                </span>
              </div>
              <button
                type="button"
                onClick={stopScanner}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer text-xl leading-none p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div
                id={scannerContainerId}
                className="w-full rounded-2xl overflow-hidden"
                style={{ minHeight: 280 }}
              />
            </div>
            <div className="px-5 pb-4 text-center">
              <p className="text-xs text-gray-400 sora-font">
                Point your camera at a Stellar address QR code
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
