"use client";

import type { CSSProperties } from "react";
import type { RowDensity } from "@/hooks/use-row-density";

interface SkeletonRowProps {
  style: CSSProperties;
  density: RowDensity;
}

export function SkeletonRow({ style, density }: SkeletonRowProps) {
  const rowPadding = density === "compact" ? "py-1" : "py-2";

  return (
    <div
      style={style}
      className={`flex items-center border-b border-gray-800 px-2 ${rowPadding}`}
    >
      <div className="flex items-center gap-2 w-10 shrink-0">
        <div className="h-3 w-3 rounded bg-gray-700 animate-pulse" />
        <div className="h-3 w-3 rounded bg-gray-700 animate-pulse" />
      </div>
      <div className="h-3 w-20 bg-gray-700 rounded animate-pulse" />
      <div className="h-3 w-24 bg-gray-700 rounded animate-pulse ml-6" />
      <div className="h-3 w-32 bg-gray-700 rounded animate-pulse ml-6" />
      <div className="h-3 w-8 bg-gray-700 rounded animate-pulse ml-6" />
      <div className="h-3 w-20 bg-gray-700 rounded animate-pulse ml-6" />
      <div className="h-3 w-20 bg-gray-700 rounded animate-pulse ml-6" />
      <div className="h-3 w-20 bg-gray-700 rounded animate-pulse ml-6" />
      <div className="h-3 w-24 bg-gray-700 rounded animate-pulse ml-6" />
      <div className="h-3 w-24 bg-gray-700 rounded animate-pulse ml-6" />
      <div className="h-3 w-6 bg-gray-700 rounded animate-pulse ml-6" />
    </div>
  );
}
