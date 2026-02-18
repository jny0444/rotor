"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import UserPane from "@/components/UserPane";
import TransactionHeatmap from "@/components/TransactionHeatmap";
import TransactionList from "@/components/TransactionList";
import { useWallet } from "@/utils/WalletProvider";
import {
  fetchTransactionHistory,
  type TransactionDay,
  type TransactionRecord,
} from "@/lib/stellar";

export default function Profile() {
  const { address, isConnected } = useWallet();
  const [days, setDays] = useState<TransactionDay[]>([]);
  const [records, setRecords] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch tx history when wallet connects
  useEffect(() => {
    if (!address) {
      setDays([]);
      setRecords([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchTransactionHistory(address).then((result) => {
      if (!cancelled) {
        setDays(result.days);
        setRecords(result.records);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div className="relative min-h-screen">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10"
      >
        <source src="/bg.webm" type="video/webm" />
      </video>
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 px-6 pt-8 pb-8">
          <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 items-start">
            <UserPane />
            <div className="flex flex-col gap-4">
              <TransactionHeatmap
                days={days}
                loading={loading}
                isConnected={isConnected}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
              <TransactionList
                records={records}
                selectedDate={selectedDate}
                onClearDate={() => setSelectedDate(null)}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
