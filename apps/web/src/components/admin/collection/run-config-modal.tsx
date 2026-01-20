"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { AmazonCategorySelector } from "./amazon-category-selector";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface CostEstimate {
  total_cents: number;
  within_budget: boolean;
  budget_cap_cents: number;
}

interface RunConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunStarted: () => void;
}

export function RunConfigModal({
  open,
  onOpenChange,
  onRunStarted,
}: RunConfigModalProps) {
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [concurrency, setConcurrency] = useState(3);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);

  const supabase = createClient();

  // Fetch cost estimate when categories change
  useEffect(() => {
    if (!open || selectedCategoryIds.length === 0) {
      setEstimate(null);
      return;
    }

    const fetchEstimate = async () => {
      setEstimating(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(`${API_BASE}/collection/estimate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ category_ids: selectedCategoryIds }),
        });

        if (response.ok) {
          const data = await response.json();
          setEstimate(data);
        }
      } catch (e) {
        console.error("Failed to get estimate:", e);
      } finally {
        setEstimating(false);
      }
    };

    const timer = setTimeout(fetchEstimate, 300);
    return () => clearTimeout(timer);
  }, [open, selectedCategoryIds, supabase.auth]);

  // Start collection run
  const startRun = async () => {
    if (selectedCategoryIds.length === 0) {
      toast.error("Select at least one category");
      return;
    }

    if (estimate && !estimate.within_budget) {
      toast.error("Estimated cost exceeds budget");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      };

      // 1. Create run
      const createResponse = await fetch(`${API_BASE}/collection/runs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          category_ids: selectedCategoryIds,
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.detail || "Failed to create run");
      }

      const run = await createResponse.json();

      // 2. Start run (mark as running)
      const startResponse = await fetch(
        `${API_BASE}/collection/runs/${run.id}/start`,
        { method: "POST", headers }
      );

      if (!startResponse.ok) {
        throw new Error("Failed to start run");
      }

      // 3. Execute run (trigger background scraping)
      const executeResponse = await fetch(
        `${API_BASE}/collection/runs/${run.id}/execute`,
        { method: "POST", headers }
      );

      if (!executeResponse.ok) {
        throw new Error("Failed to execute run");
      }

      toast.success("Collection started");
      onRunStarted();
      onOpenChange(false);

      // Reset state
      setSelectedCategoryIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">Start Collection Run</DialogTitle>
          <DialogDescription className="text-gray-400">
            Select Amazon categories to search for potential dropshippers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Category selector */}
          <AmazonCategorySelector
            selectedCategoryIds={selectedCategoryIds}
            onSelectionChange={setSelectedCategoryIds}
          />

          {/* Concurrency slider */}
          <div className="space-y-2 pt-4 border-t border-gray-800">
            <div className="flex justify-between">
              <Label className="text-gray-300">Concurrency</Label>
              <span className="text-sm text-gray-400">{concurrency} workers</span>
            </div>
            <Slider
              value={[concurrency]}
              onValueChange={([v]) => setConcurrency(v)}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
          </div>

          {/* Cost estimate */}
          {selectedCategoryIds.length > 0 && (
            <div
              className={`p-3 rounded border ${
                estimate && !estimate.within_budget
                  ? "bg-red-900/20 border-red-500/50"
                  : "bg-gray-800 border-gray-700"
              }`}
            >
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Estimated cost:</span>
                {estimating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                ) : (
                  <span
                    className={
                      estimate && !estimate.within_budget
                        ? "text-red-400"
                        : "text-green-400"
                    }
                  >
                    {estimate ? formatCost(estimate.total_cents) : "-"}
                  </span>
                )}
              </div>
              {estimate && (
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>Budget:</span>
                  <span>{formatCost(estimate.budget_cap_cents)}</span>
                </div>
              )}
              {estimate && !estimate.within_budget && (
                <div className="text-red-400 text-sm mt-2">
                  Exceeds budget - reduce categories or increase budget
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-gray-800 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={startRun}
            disabled={
              loading ||
              selectedCategoryIds.length === 0 ||
              estimating ||
              (estimate !== null && !estimate.within_budget)
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Collection"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
