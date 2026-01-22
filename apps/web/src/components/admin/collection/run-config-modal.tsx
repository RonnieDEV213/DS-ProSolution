"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Loader2 } from "lucide-react";
import { addWeeks, addMonths, startOfDay } from "date-fns";
import { AmazonCategorySelector } from "./amazon-category-selector";
import { CategoryPresetDropdown } from "./category-preset-dropdown";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface RunConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunStarted: () => void;
  initialCategories?: string[];
}

// Recurring schedule presets
const RECURRING_PRESETS = [
  { value: "once", label: "One-time", cron: null },
  { value: "weekly", label: "Weekly", cron: "0 0 * * {day}" },
  { value: "biweekly", label: "Bi-weekly", cron: "0 0 {dom}/14 * *" },
  { value: "monthly", label: "Monthly", cron: "0 0 {dom} * *" },
  { value: "quarterly", label: "Quarterly", cron: "0 0 {dom} */3 *" },
];

interface Preset {
  id: string;
  name: string;
  category_ids: string[];
  is_builtin: boolean;
}

export function RunConfigModal({
  open,
  onOpenChange,
  onRunStarted,
  initialCategories = [],
}: RunConfigModalProps) {
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialCategories);
  const [concurrency, setConcurrency] = useState(3);
  const [loading, setLoading] = useState(false);

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [recurringPreset, setRecurringPreset] = useState<string>("once");
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Presets state
  const [presets, setPresets] = useState<Preset[]>([]);
  const [allCategoryIds, setAllCategoryIds] = useState<string[]>([]);

  const supabase = createClient();

  // Sync selectedCategoryIds when initialCategories changes (e.g., from re-run)
  useEffect(() => {
    if (initialCategories.length > 0) {
      setSelectedCategoryIds(initialCategories);
    }
  }, [initialCategories]);

  // Fetch presets for dropdown in right panel
  const fetchPresets = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [presetsRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE}/amazon/presets`, { headers }),
        fetch(`${API_BASE}/amazon/categories`, { headers }),
      ]);

      if (presetsRes.ok) {
        const data = await presetsRes.json();
        setPresets(data.presets || []);
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        const allIds = (data.departments || []).flatMap((dept: { categories: { id: string }[] }) =>
          dept.categories.map((cat: { id: string }) => cat.id)
        );
        setAllCategoryIds(allIds);
      }
    } catch (err) {
      console.error("Failed to fetch presets:", err);
    }
  }, [supabase.auth]);

  useEffect(() => {
    if (open) {
      fetchPresets();
    }
  }, [open, fetchPresets]);

  // Calculate highlighted dates based on recurring preset
  const getHighlightedDates = useMemo(() => {
    if (!selectedDate || recurringPreset === "once") return [];

    const dates: Date[] = [];
    let current = startOfDay(selectedDate);
    const endDate = addMonths(current, 6); // Show 6 months ahead

    while (current <= endDate) {
      dates.push(new Date(current));
      switch (recurringPreset) {
        case "weekly":
          current = addWeeks(current, 1);
          break;
        case "biweekly":
          current = addWeeks(current, 2);
          break;
        case "monthly":
          current = addMonths(current, 1);
          break;
        case "quarterly":
          current = addMonths(current, 3);
          break;
        default:
          // exit loop
          current = new Date(endDate.getTime() + 1);
      }
    }
    return dates;
  }, [selectedDate, recurringPreset]);

  // Start collection run
  const startRun = async () => {
    if (selectedCategoryIds.length === 0) {
      toast.error("Select at least one category");
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

  // Save schedule handler
  const saveSchedule = async () => {
    if (!selectedDate || selectedCategoryIds.length === 0) return;

    setSavingSchedule(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const preset = RECURRING_PRESETS.find(p => p.value === recurringPreset);
      const cronExpression = preset?.cron
        ? preset.cron
            .replace("{day}", selectedDate.getDay().toString())
            .replace("{dom}", selectedDate.getDate().toString())
        : `${selectedDate.getMinutes()} ${selectedDate.getHours()} ${selectedDate.getDate()} ${selectedDate.getMonth() + 1} *`;

      await fetch(`${API_BASE}/collection/schedule`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cron_expression: cronExpression,
          enabled: true,
        }),
      });

      toast.success(recurringPreset === "once" ? "Run scheduled" : "Recurring schedule saved");
      setScheduleEnabled(false);
      setSelectedDate(undefined);
      setRecurringPreset("once");
    } catch (err) {
      toast.error("Failed to save schedule");
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">Configure Collection Run</DialogTitle>
          <DialogDescription className="text-gray-400">
            Select Amazon categories and configure run settings.
          </DialogDescription>
        </DialogHeader>

        {/* Two-panel layout */}
        <div className="flex-1 overflow-hidden min-h-0">
          <div className="grid grid-cols-[1fr_320px] gap-4 h-full min-h-0">
            {/* Left Panel: Category Selector */}
            <div className="overflow-y-auto pr-2 min-h-0">
              <AmazonCategorySelector
                selectedCategoryIds={selectedCategoryIds}
                onSelectionChange={setSelectedCategoryIds}
              />
            </div>

            {/* Right Panel: Run Controls */}
            <div className="border-l border-gray-800 pl-4 space-y-4 overflow-y-auto min-h-0">
              {/* Presets dropdown */}
              <div className="space-y-2">
                <Label className="text-gray-300">Quick Presets</Label>
                <CategoryPresetDropdown
                  presets={presets}
                  selectedCategoryIds={selectedCategoryIds}
                  allCategoryIds={allCategoryIds}
                  onPresetSelect={(categoryIds) => setSelectedCategoryIds(categoryIds)}
                  onPresetsChange={fetchPresets}
                />
              </div>

              {/* Concurrency slider */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-gray-300">Concurrency</Label>
                  <span className="text-sm text-gray-400">{concurrency} workers</span>
                </div>
                <div className="relative pt-1 pb-4">
                  <Slider
                    value={[concurrency]}
                    onValueChange={([v]) => setConcurrency(v)}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  {/* Tick marks and labels */}
                  <div className="flex justify-between px-1 mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="flex flex-col items-center">
                        <div className="w-px h-1.5 bg-gray-600" />
                        <span className={`text-xs mt-0.5 ${concurrency === n ? 'text-blue-400' : 'text-gray-500'}`}>
                          {n}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Higher values = faster collection, more API load
                </p>
              </div>

              {/* Schedule toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-gray-200">Schedule Run</Label>
                  <p className="text-xs text-gray-500">Set up recurring or one-time</p>
                </div>
                <Switch
                  checked={scheduleEnabled}
                  onCheckedChange={setScheduleEnabled}
                />
              </div>

              {/* Schedule section (shown when enabled) */}
              {scheduleEnabled && (
                <div className="space-y-4 border-t border-gray-800 pt-4">
                  {/* Recurring preset dropdown */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Recurrence</Label>
                    <Select value={recurringPreset} onValueChange={setRecurringPreset}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {RECURRING_PRESETS.map((preset) => (
                          <SelectItem
                            key={preset.value}
                            value={preset.value}
                            className="text-gray-200"
                          >
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Calendar */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">
                      {recurringPreset === "once" ? "Run Date" : "Starting Date"}
                    </Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < startOfDay(new Date())}
                      modifiers={{
                        scheduled: getHighlightedDates,
                      }}
                      modifiersStyles={{
                        scheduled: {
                          backgroundColor: "rgba(59, 130, 246, 0.2)",
                          borderRadius: "100%",
                        },
                      }}
                      className="rounded-md border border-gray-700 bg-gray-800"
                    />
                  </div>

                  {/* Save Schedule button */}
                  <Button
                    onClick={saveSchedule}
                    disabled={savingSchedule || !selectedDate || selectedCategoryIds.length === 0}
                    variant="outline"
                    className="w-full border-gray-700"
                  >
                    {savingSchedule ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Schedule"
                    )}
                  </Button>
                </div>
              )}

              {/* Start Collection button */}
              <Button
                onClick={startRun}
                disabled={loading || selectedCategoryIds.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Start Collection Now"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
