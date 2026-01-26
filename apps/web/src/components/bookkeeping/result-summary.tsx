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
    <div className="text-sm text-muted-foreground">
      Showing <span className="font-mono">{formatNumber(start)}</span>-<span className="font-mono">{formatNumber(end)}</span> of <span className="font-mono">{formatNumber(total)}</span>
      {isFiltered ? " (filtered)" : ""}
    </div>
  );
}
