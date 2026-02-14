"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  balance: number;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  balance: 0,
  connect: async () => {},
  disconnect: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

async function fetchXlmBalance(address: string): Promise<number> {
  try {
    const res = await fetch(
      `https://horizon-testnet.stellar.org/accounts/${address}`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const nativeBalance = data.balances?.find(
      (b: { asset_type: string; balance: string }) =>
        b.asset_type === "native"
    );
    return nativeBalance ? parseFloat(nativeBalance.balance) : 0;
  } catch {
    return 0;
  }
}

export default function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [kitReady, setKitReady] = useState(false);

  // Fetch balance whenever address changes
  useEffect(() => {
    if (address) {
      fetchXlmBalance(address).then(setBalance);
    } else {
      setBalance(0);
    }
  }, [address]);

  useEffect(() => {
    let sub1: (() => void) | undefined;
    let sub2: (() => void) | undefined;

    async function initKit() {
      const { StellarWalletsKit } = await import(
        "@creit-tech/stellar-wallets-kit/sdk"
      );
      const { defaultModules } = await import(
        "@creit-tech/stellar-wallets-kit/modules/utils"
      );
      const { KitEventType } = await import(
        "@creit-tech/stellar-wallets-kit/types"
      );

      StellarWalletsKit.init({
        modules: defaultModules(),
      });

      // Listen for state updates (address changes)
      sub1 = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
        setAddress(event.payload.address ?? null);
      });

      // Listen for disconnect
      sub2 = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
        setAddress(null);
      });

      // Check if already connected from a previous session
      try {
        const { address: existingAddress } =
          await StellarWalletsKit.getAddress();
        if (existingAddress) {
          setAddress(existingAddress);
        }
      } catch {
        // Not connected yet, that's fine
      }

      setKitReady(true);
    }

    initKit();

    return () => {
      sub1?.();
      sub2?.();
    };
  }, []);

  const connect = useCallback(async () => {
    if (!kitReady) return;
    const { StellarWalletsKit } = await import(
      "@creit-tech/stellar-wallets-kit/sdk"
    );
    try {
      const { address: newAddress } = await StellarWalletsKit.authModal();
      if (newAddress) {
        setAddress(newAddress);
      }
    } catch {
      // User closed the modal or rejected
    }
  }, [kitReady]);

  const disconnect = useCallback(async () => {
    if (!kitReady) return;
    const { StellarWalletsKit } = await import(
      "@creit-tech/stellar-wallets-kit/sdk"
    );
    try {
      await StellarWalletsKit.disconnect();
    } catch {
      // ignore
    }
    setAddress(null);
  }, [kitReady]);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        balance,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
