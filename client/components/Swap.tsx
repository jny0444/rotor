"use client";

import { useState } from "react";
import Image from "next/image";
import { IoIosSend } from "react-icons/io";
import { FaRegPaste } from "react-icons/fa6";
import { useWallet } from "./WalletProvider";

export default function Swap() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [showUsd, setShowUsd] = useState(false);

  const { balance } = useWallet();

  const handleUseHalf = () => {
    setAmount(String(balance / 2));
  };

  const handleUseMax = () => {
    setAmount(String(balance));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: handle confirm
  };

  return (
    <div className="my-8 w-full max-w-md mx-auto px-4 sm:px-0">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* To field */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 focus-within:border-[#9EB8E9] focus-within:ring-2 focus-within:ring-[#9EB8E9]/30 transition-all">
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
                  <span className="text-gray-400 text-2xl sm:text-4xl ml-2">XLM</span>
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

          {/* Confirm button */}
          <div className="px-5 pb-5">
            <button
              id="swap-confirm"
              type="submit"
              className="w-full py-4 rounded-2xl bg-linear-to-r from-[#1D2143] to-[#040215] text-white text-lg font-semibold sora-font shadow-[0_4px_20px_rgba(29,33,67,0.4)] hover:shadow-[0_6px_28px_rgba(29,33,67,0.6)] hover:from-[#161a38] hover:to-[#030110] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              Send <IoIosSend />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
