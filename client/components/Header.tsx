"use client";

import Image from "next/image";
import Link from "next/link";
import { useWallet } from "../utils/WalletProvider";
import { LuWalletCards } from "react-icons/lu";

export default function Header() {
  const { address, isConnected, connect, disconnect } = useWallet();

  const truncatedAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "";

  return (
    <div className="pt-3 sm:pt-1">
      <div className="flex flex-row rounded-xl p-2 pt-0 sm:p-4 justify-between items-center">
        <Link href="/" className="flex flex-row gap-2 items-center">
          <Image
            src="/favicon.svg"
            alt="Rotor Logo"
            width={1}
            height={1}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-xl"
          />
          <p className="text-2xl sm:text-4xl sora-font">Rotor</p>
        </Link>
        {isConnected ? (
          <div className="flex items-center gap-3">
            <Link href="/profile">
              <Image
                src="/user.svg"
                alt="User"
                width={1}
                height={1}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-md sm:rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>
            <button
              onClick={disconnect}
              className="group rounded-xl py-1 px-3 bg-white active:shadow-[inset_0_0_0_3px_#9EB8E9] transition-all cursor-pointer flex items-center gap-2"
            >
              <LuWalletCards className="text-black text-lg sm:text-xl" />
              <p className="text-base sm:text-xl bricolage-grotesque-font text-black relative">
                <span className="transition-opacity duration-200 group-hover:opacity-0">
                  {truncatedAddress}
                </span>
                <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  Disconnect
                </span>
              </p>
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            className="rounded-xl py-1 px-3 bg-white active:shadow-[inset_0_0_0_3px_#9EB8E9] transition-all cursor-pointer flex items-center gap-2"
          >
            <LuWalletCards className="text-black text-lg sm:text-xl" />
            <p className="text-base sm:text-xl bricolage-grotesque-font text-black">
              Connect Wallet
            </p>
          </button>
        )}
      </div>
    </div>
  );
}
