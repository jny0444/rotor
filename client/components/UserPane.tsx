"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FaRegCopy, FaCheck } from "react-icons/fa6";
import Image from "next/image";
import { useWallet } from "../utils/WalletProvider";

export default function UserPane() {
  const { address, balance, isConnected } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied
    }
  };

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-6)}`
    : "";

  if (!isConnected) {
    return (
      <div className="w-full self-stretch">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden h-full flex flex-col items-center justify-center">
          <div className="flex flex-col items-center py-12 px-5">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
              <Image src="/stellar.svg" alt="Stellar" width={32} height={32} />
            </div>
            <p className="text-sm text-gray-400 sora-font">
              Connect your wallet to view your profile
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Address section */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-xs text-gray-400 sora-font mb-2 uppercase tracking-wider">
            Account Address
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <span className="flex-1 text-sm text-gray-800 ibm-plex-mono-regular truncate">
                {truncatedAddress}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border transition-all cursor-pointer active:scale-90 ${
                copied
                  ? "bg-green-50 border-green-200 text-green-500"
                  : "bg-gray-50 border-gray-100 text-gray-400 hover:text-[#9EB8E9] hover:border-[#9EB8E9]/40"
              }`}
              title={copied ? "Copied!" : "Copy address"}
            >
              {copied ? <FaCheck size={16} /> : <FaRegCopy size={16} />}
            </button>
          </div>
        </div>

        {/* QR Code section */}
        <div className="flex flex-col items-center py-6 px-5">
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-gray-100">
            <QRCodeSVG
              value={address || ""}
              size={200}
              level="H"
              bgColor="#ffffff"
              fgColor="#1D2143"
              imageSettings={{
                src: "/stellar.svg",
                x: undefined,
                y: undefined,
                height: 36,
                width: 36,
                excavate: true,
              }}
            />
          </div>
          <p className="mt-3 text-xs text-gray-400 sora-font">
            Scan to get this address
          </p>
        </div>

        {/* Balance section */}
        <div className="mx-5 mb-5 flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
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
                XLM
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-gray-800 sora-font">
              {balance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 7,
              })}
            </span>
            <span className="text-xs text-gray-400 ibm-plex-mono-regular">
              ${(balance * 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
