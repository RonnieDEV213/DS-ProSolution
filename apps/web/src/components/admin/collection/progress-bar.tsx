"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ProgressBarProps {
  progress: {
    departments_total: number;
    departments_completed: number;
    categories_total: number;
    categories_completed: number;
    products_total: number;
    products_searched: number;
    sellers_found: number;
    sellers_new: number;
    actual_cost_cents: number;
    budget_cap_cents: number;
    cost_status: "safe" | "warning" | "exceeded";
  } | null;
  onDetailsClick: () => void;
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ProgressBar({ progress, onDetailsClick }: ProgressBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (!progress) return null;

  const totalProgress = progress.products_total > 0
    ? (progress.products_searched / progress.products_total) * 100
    : 0;

  const costColorClass = {
    safe: "text-green-400",
    warning: "text-yellow-400",
    exceeded: "text-red-400",
  }[progress.cost_status];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      {/* Progress bar */}
      <div className="h-2 bg-gray-800">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${totalProgress}%` }}
        />
      </div>

      {/* Quick info */}
      <div className="px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Cost */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Cost:</span>
            <span className={costColorClass}>
              {formatCost(progress.actual_cost_cents)}
            </span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">
              {formatCost(progress.budget_cap_cents)}
            </span>
          </div>

          <span className="text-gray-700">|</span>

          {/* Departments */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Depts:</span>
            <span className="text-gray-300">
              {progress.departments_completed}/{progress.departments_total}
            </span>
          </div>

          <span className="text-gray-700">|</span>

          {/* Categories */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Cats:</span>
            <span className="text-gray-300">
              {progress.categories_completed}/{progress.categories_total}
            </span>
          </div>

          <span className="text-gray-700">|</span>

          {/* Products */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Products:</span>
            <span className="text-gray-300">
              {progress.products_searched}/{progress.products_total}
            </span>
          </div>

          <span className="text-gray-700">|</span>

          {/* New Sellers */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">+New Sellers:</span>
            <span className="text-green-400 font-medium">
              {progress.sellers_new}
            </span>
          </div>
        </div>

        {/* Details button */}
        <button
          onClick={() => {
            setExpanded(!expanded);
            onDetailsClick();
          }}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <span>Details</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
