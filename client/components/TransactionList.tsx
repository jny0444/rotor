"use client";

import type { TransactionRecord } from "../lib/stellar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

function formatFee(stroops: string): string {
  const xlm = parseInt(stroops, 10) / 10_000_000;
  return xlm.toFixed(7);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TransactionListProps {
  records: TransactionRecord[];
  selectedDate: string | null;
  onClearDate: () => void;
  loading: boolean;
}

const RECENT_TX_COUNT = 10;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TransactionList({
  records,
  selectedDate,
  onClearDate,
  loading,
}: TransactionListProps) {
  const displayedTxns = selectedDate
    ? records.filter((tx) => tx.date === selectedDate)
    : records.slice(0, RECENT_TX_COUNT);

  return (
    <div className="w-full">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <p className="text-xs text-gray-400 sora-font uppercase tracking-wider">
            {selectedDate
              ? `Transactions on ${selectedDate}`
              : "Recent Transactions"}
          </p>
          <div className="flex items-center gap-2">
            {selectedDate && (
              <button
                type="button"
                onClick={onClearDate}
                className="text-[11px] text-blue-500 hover:text-blue-600 sora-font cursor-pointer transition-colors"
              >
                Show all recent
              </button>
            )}
            {loading && (
              <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            )}
          </div>
        </div>

        {/* Transaction rows */}
        <div className="px-5 pb-5">
          {displayedTxns.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-300 sora-font">
                {loading
                  ? "Loading transactions…"
                  : selectedDate
                    ? "No transactions on this day"
                    : "No transactions yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {displayedTxns.map((tx) => (
                <a
                  key={tx.hash}
                  href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50/80 hover:bg-blue-50/80 border border-gray-100 hover:border-blue-200 transition-all duration-150"
                >
                  {/* Status dot */}
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      tx.successful ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  />

                  {/* Hash + time */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 ibm-plex-mono-regular truncate group-hover:text-blue-600 transition-colors">
                      {truncateHash(tx.hash)}
                    </p>
                    <p className="text-[10px] text-gray-400 sora-font mt-0.5">
                      {tx.date} · {tx.time.slice(0, 8)}
                    </p>
                  </div>

                  {/* Ops + fee */}
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-gray-500 sora-font">
                      {tx.operationCount} op
                      {tx.operationCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-[10px] text-gray-400 ibm-plex-mono-regular">
                      {formatFee(tx.fee)} XLM
                    </p>
                  </div>

                  {/* External link icon */}
                  <svg
                    className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 shrink-0 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
