"use client";

interface ResultSummaryProps {
  visibleStart: number;
  visibleEnd: number;
  total: number;
  isFiltered: boolean;
}

const formatNumber = (value: number) => value.toLocaleString();

export function ResultSummary({
  visibleStart,
  visibleEnd,
  total,
  isFiltered,
}: ResultSummaryProps) {
  if (total <= 0) return null;

  const start = Math.min(visibleStart + 1, total);
  const end = Math.min(Math.max(visibleEnd, start), total);

  return (
    <div className="text-sm text-gray-400">
      Showing {formatNumber(start)}-{formatNumber(end)} of {formatNumber(total)}
      {isFiltered ? " (filtered)" : ""}
    </div>
  );
}
