"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, DollarSign, Loader2 } from "lucide-react";

interface CostEstimate {
  total_cents: number;
  breakdown: Record<string, number>;
  within_budget: boolean;
  budget_cap_cents: number;
  warning_threshold_cents: number;
}

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

// Placeholder categories until Phase 7 adds real Amazon category selection
const PLACEHOLDER_CATEGORIES = [
  { id: "electronics", name: "Electronics" },
  { id: "home-kitchen", name: "Home & Kitchen" },
  { id: "toys-games", name: "Toys & Games" },
  { id: "clothing", name: "Clothing" },
  { id: "sports", name: "Sports & Outdoors" },
];

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateCollectionDialogProps) {
  const [name, setName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch estimate when categories change
  useEffect(() => {
    if (selectedCategories.length === 0) {
      setEstimate(null);
      return;
    }

    const fetchEstimate = async () => {
      setEstimateLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/collection/estimate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ category_ids: selectedCategories }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to get estimate");
        }

        const data = await response.json();
        setEstimate(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to get estimate");
      } finally {
        setEstimateLoading(false);
      }
    };

    // Debounce
    const timer = setTimeout(fetchEstimate, 300);
    return () => clearTimeout(timer);
  }, [selectedCategories]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSelectAll = () => {
    setSelectedCategories(PLACEHOLDER_CATEGORIES.map((c) => c.id));
  };

  const handleClearAll = () => {
    setSelectedCategories([]);
  };

  const handleCreate = async () => {
    if (selectedCategories.length === 0) {
      setError("Select at least one category");
      return;
    }

    if (estimate && !estimate.within_budget) {
      setError("Cannot create: estimated cost exceeds budget cap");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/collection/runs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            name: name || null,
            category_ids: selectedCategories,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to create collection");
      }

      // Success - reset and close
      setName("");
      setSelectedCategories([]);
      setEstimate(null);
      onCreated();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create collection");
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating) {
      setName("");
      setSelectedCategories([]);
      setEstimate(null);
      setError(null);
      onOpenChange(false);
    }
  };

  const exceedsWarning = estimate && estimate.total_cents > estimate.warning_threshold_cents;
  const exceedsBudget = estimate && !estimate.within_budget;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-white">New Collection Run</DialogTitle>
          <DialogDescription className="text-gray-400">
            Select Amazon categories to collect sellers from. Review the cost
            estimate before starting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-300">
              Run Name (optional)
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-generated if blank"
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Category selection */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-gray-300">Categories</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs text-gray-400 hover:text-gray-200"
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-xs text-gray-400 hover:text-gray-200"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PLACEHOLDER_CATEGORIES.map((category) => (
                <label
                  key={category.id}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                    selectedCategories.includes(category.id)
                      ? "bg-blue-900/30 border-blue-500"
                      : "bg-gray-800 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.id)}
                    onChange={() => handleCategoryToggle(category.id)}
                    className="rounded border-gray-600 bg-gray-800"
                  />
                  <span className="text-sm text-gray-200">{category.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Note: Real Amazon categories will be available in Phase 7
            </p>
          </div>

          {/* Cost estimate */}
          {selectedCategories.length > 0 && (
            <div
              className={`p-4 rounded-lg border ${
                exceedsBudget
                  ? "bg-red-900/20 border-red-500/50"
                  : exceedsWarning
                  ? "bg-yellow-900/20 border-yellow-500/50"
                  : "bg-gray-800 border-gray-700"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-200">
                  Cost Estimate
                </span>
                {estimateLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>

              {estimate && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Estimated total:</span>
                    <span
                      className={
                        exceedsBudget
                          ? "text-red-400 font-medium"
                          : exceedsWarning
                          ? "text-yellow-400 font-medium"
                          : "text-green-400 font-medium"
                      }
                    >
                      {formatCents(estimate.total_cents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Budget cap:</span>
                    <span className="text-gray-300">
                      {formatCents(estimate.budget_cap_cents)}
                    </span>
                  </div>

                  {exceedsBudget && (
                    <div className="flex items-center gap-2 mt-2 text-red-400 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Exceeds budget cap - cannot create</span>
                    </div>
                  )}
                  {exceedsWarning && !exceedsBudget && (
                    <div className="flex items-center gap-2 mt-2 text-yellow-400 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Approaching budget cap (80%+)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 rounded bg-red-900/20 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={creating}
            className="border-gray-700 text-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              creating ||
              selectedCategories.length === 0 ||
              estimateLoading ||
              exceedsBudget
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Collection"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
