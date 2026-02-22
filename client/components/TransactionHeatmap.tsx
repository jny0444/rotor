"use client";

import { useMemo, useState } from "react";
import type { TransactionDay } from "../lib/stellar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const d = new Date(start);
  while (d <= end) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function intensityLevel(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const LEVEL_COLORS = [
  "bg-blue-950", // 0
  "bg-blue-900", // 1
  "bg-blue-700", // 2
  "bg-blue-500", // 3
  "bg-blue-400", // 4
];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TransactionHeatmapProps {
  days: TransactionDay[];
  loading: boolean;
  isConnected: boolean;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TransactionHeatmap({
  days,
  loading,
  isConnected,
  selectedDate,
  onSelectDate,
}: TransactionHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // Build heatmap grid
  const { weeks, monthMarkers, maxCount, totalTxns } = useMemo(() => {
    const dateMap: Record<string, number> = {};
    for (const d of days) {
      dateMap[d.date] = d.count;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    start.setDate(start.getDate() - start.getDay());

    const allDays = dateRange(start, today);
    const weeks: { date: Date; key: string; count: number }[][] = [];
    let currentWeek: { date: Date; key: string; count: number }[] = [];

    for (const d of allDays) {
      const key = fmt(d);
      currentWeek.push({ date: d, key, count: dateMap[key] || 0 });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const monthMarkers: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const m = weeks[w][0].date.getMonth();
      if (m !== lastMonth) {
        monthMarkers.push({ label: MONTH_LABELS[m], weekIndex: w });
        lastMonth = m;
      }
    }

    let maxCount = 0;
    let totalTxns = 0;
    for (const d of days) {
      totalTxns += d.count;
      if (d.count > maxCount) maxCount = d.count;
    }

    return { weeks, monthMarkers, maxCount, totalTxns };
  }, [days]);

  const handleCellClick = (dateKey: string) => {
    onSelectDate(selectedDate === dateKey ? null : dateKey);
  };

  if (!isConnected) {
    return (
      <div className="w-full">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="flex flex-col items-center py-10 px-5">
            <div className="w-full h-[120px] flex items-center justify-center">
              <p className="text-sm text-gray-400 sora-font">
                Connect your wallet to view activity
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 sora-font uppercase tracking-wider">
              Transaction Activity
            </p>
            {!loading && (
              <p className="text-[11px] text-gray-300 ibm-plex-mono-regular mt-0.5">
                {totalTxns} transaction{totalTxns !== 1 ? "s" : ""} in the last
                year
              </p>
            )}
          </div>
          {loading && (
            <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          )}
        </div>

        {/* Heatmap grid */}
        <div className="px-5 pb-2 overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Month labels */}
            <div
              className="flex ml-[30px] mb-1 relative"
              style={{ height: 14 }}
            >
              {monthMarkers.map((m, i) => (
                <span
                  key={i}
                  className="text-[10px] text-gray-400 sora-font absolute"
                  style={{ left: m.weekIndex * 12 }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div className="flex">
              {/* Day labels */}
              <div className="flex flex-col gap-[2px] mr-[6px] shrink-0">
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="h-[10px] text-[9px] text-gray-400 sora-font leading-[10px] w-[24px] text-right pr-1"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              <div className="flex gap-[2px]">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[2px]">
                    {week.map((day) => {
                      const level = intensityLevel(day.count, maxCount);
                      const isSelected = selectedDate === day.key;
                      return (
                        <div
                          key={day.key}
                          className={`w-[10px] h-[10px] rounded-[2px] ${LEVEL_COLORS[level]} transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? "ring-2 ring-blue-400 ring-offset-1"
                              : "hover:ring-1 hover:ring-gray-400 hover:ring-offset-1"
                          }`}
                          onClick={() => handleCellClick(day.key)}
                          onMouseEnter={(e) => {
                            const rect = (
                              e.target as HTMLElement
                            ).getBoundingClientRect();
                            setHoveredCell({
                              date: day.key,
                              count: day.count,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 pb-4 pt-2 flex items-center justify-end gap-1.5">
          <span className="text-[10px] text-gray-400 sora-font mr-1">
            Less
          </span>
          {LEVEL_COLORS.map((color, i) => (
            <div
              key={i}
              className={`w-[10px] h-[10px] rounded-[2px] ${color}`}
            />
          ))}
          <span className="text-[10px] text-gray-400 sora-font ml-1">
            More
          </span>
        </div>
      </div>

      {/* Floating tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: hoveredCell.x,
            top: hoveredCell.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-[#1D2143] text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-lg sora-font whitespace-nowrap">
            <span className="font-semibold">
              {hoveredCell.count} transaction
              {hoveredCell.count !== 1 ? "s" : ""}
            </span>{" "}
            on {hoveredCell.date}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#1D2143]" />
          </div>
        </div>
      )}
    </div>
  );
}
