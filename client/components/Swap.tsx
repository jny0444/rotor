"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { IoIosSend } from "react-icons/io";
import { FaRegPaste } from "react-icons/fa6";
import { LuScanFace } from "react-icons/lu";
import { Html5Qrcode } from "html5-qrcode";
import { useWallet } from "../utils/WalletProvider";
import { buildPaymentTx, submitSignedTransaction } from "../lib/stellar";

type TxStatus =
  | { stage: "idle" }
  | { stage: "building" }
  | { stage: "signing" }
  | { stage: "submitting" }
  | { stage: "success"; hash: string }
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

  const isLoading = ["building", "signing", "submitting"].includes(
    txStatus.stage
  );

  // ---------------------------------------------------------------------------
  // QR Scanner helpers (unchanged)
  // ---------------------------------------------------------------------------
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
        }
      } catch {
        // scanner already stopped
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
        () => {}
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
          // ignore
        }
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Balance helpers
  // ---------------------------------------------------------------------------
  const handleUseHalf = () => {
    setAmount(String(balance / 2));
  };

  const handleUseMax = () => {
    setAmount(String(balance));
  };

  // ---------------------------------------------------------------------------
  // Send XLM — following the frontend-stellar-sdk skill TX UX checklist
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !isConnected) {
      setTxStatus({ stage: "error", message: "Please connect your wallet first" });
      return;
    }

    if (!recipient.trim()) {
      setTxStatus({ stage: "error", message: "Enter a destination address" });
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

    try {
      // 1. Build transaction
      setTxStatus({ stage: "building" });
      const unsignedXdr = await buildPaymentTx(address, recipient.trim(), amount);

      // 2. Request wallet signature
      setTxStatus({ stage: "signing" });
      const signedXdr = await signTransaction(unsignedXdr);

      // 3. Submit to network
      setTxStatus({ stage: "submitting" });
      const result = await submitSignedTransaction(signedXdr);

      if (result.success) {
        setTxStatus({ stage: "success", hash: result.hash });
        setRecipient("");
        setAmount("");
        // Refresh balance after successful send
        await refreshBalance();
      } else {
        setTxStatus({ stage: "error", message: result.message });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";

      // Handle user-rejected signing
      if (message.toLowerCase().includes("rejected") || message.toLowerCase().includes("cancel")) {
        setTxStatus({ stage: "error", message: "Transaction signing was cancelled" });
      } else {
        setTxStatus({ stage: "error", message });
      }
    }
  };

  // Auto-dismiss success/error after 8s
  useEffect(() => {
    if (txStatus.stage === "success" || txStatus.stage === "error") {
      const t = setTimeout(() => setTxStatus({ stage: "idle" }), 8000);
      return () => clearTimeout(t);
    }
  }, [txStatus]);

  // ---------------------------------------------------------------------------
  // Button label based on state
  // ---------------------------------------------------------------------------
  const buttonLabel = () => {
    switch (txStatus.stage) {
      case "building":
        return "Building…";
      case "signing":
        return "Sign in wallet…";
      case "submitting":
        return "Sending…";
      default:
        return (
          <>
            Send <IoIosSend />
          </>
        );
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
                  placeholder="GABC...XYZ"
                  className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-300 ibm-plex-mono-regular"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setRecipient(text.trim());
                    } catch {
                      // Clipboard access denied
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

          {/* Amount display */}
          <div className="flex flex-col items-center py-6 px-5">
            <div className="relative w-full flex justify-center">
              <div className="text-center text-4xl sm:text-6xl font-light text-gray-800 w-full sora-font flex items-center justify-center">
                {showUsd && <span className="text-gray-400">$</span>}
                <input
                  id="swap-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                      setAmount(val);
                    }
                  }}
                  placeholder="0"
                  className="text-center text-4xl sm:text-6xl font-light text-gray-800 bg-transparent outline-none sora-font placeholder-gray-300"
                  style={{ width: `${Math.max(1, (amount || "0").length)}ch` }}
                />
                {!showUsd && (
                  <span className="text-gray-400 text-2xl sm:text-4xl ml-2">
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
                  : `$${(Number(amount || 0) * 0).toFixed(2)}`}
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

          {/* Token selector row */}
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
                  {balance} XLM
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
            </div>
          </div>

          {/* Status banner */}
          {txStatus.stage === "success" && (
            <div className="mx-5 mb-4 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm sora-font animate-[fadeIn_0.3s_ease-out]">
              <p className="font-semibold">Transaction sent! ✓</p>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txStatus.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs ibm-plex-mono-regular underline underline-offset-2 break-all hover:text-emerald-900 transition-colors"
              >
                {txStatus.hash}
              </a>
            </div>
          )}

          {txStatus.stage === "error" && (
            <div className="mx-5 mb-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm sora-font animate-[fadeIn_0.3s_ease-out]">
              {txStatus.message}
            </div>
          )}

          {/* Confirm / Send button */}
          <div className="px-5 pb-5">
            <button
              id="swap-confirm"
              type="submit"
              disabled={isLoading || !isConnected}
              className="w-full py-4 rounded-2xl bg-linear-to-r from-[#1D2143] to-[#040215] text-white text-lg font-semibold sora-font shadow-[0_4px_20px_rgba(29,33,67,0.4)] hover:shadow-[0_6px_28px_rgba(29,33,67,0.6)] hover:from-[#161a38] hover:to-[#030110] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {buttonLabel()}
            </button>
          </div>
        </form>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            {/* Modal header */}
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

            {/* Scanner viewport */}
            <div className="p-4">
              <div
                id={scannerContainerId}
                className="w-full rounded-2xl overflow-hidden"
                style={{ minHeight: 280 }}
              />
            </div>

            {/* Footer hint */}
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
