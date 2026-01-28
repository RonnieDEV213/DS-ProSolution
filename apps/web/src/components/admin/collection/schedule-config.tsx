/**
 * @deprecated This component has been merged into RunConfigModal in Phase 10.
 * Schedule configuration is now part of the run config two-panel layout.
 * See: run-config-modal.tsx
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorEmpty } from "@/components/empty-states/error-empty";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface Schedule {
  id?: string;
  preset_id?: string;
  preset_name?: string;
  cron_expression: string;
  enabled: boolean;
  notify_email: boolean;
  last_run_at?: string;
  next_run_at?: string;
}

interface Preset {
  id: string;
  name: string;
  category_ids: string[];
  is_builtin: boolean;
}

// Common cron presets for user-friendly selection
const CRON_PRESETS = [
  { label: "1st of month at midnight", value: "0 0 1 * *" },
  { label: "15th of month at midnight", value: "0 0 15 * *" },
  { label: "Every Sunday at midnight", value: "0 0 * * 0" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Custom", value: "custom" },
];

export function ScheduleConfig() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cronPreset, setCronPreset] = useState<string>("0 0 1 * *");
  const [customCron, setCustomCron] = useState("");
  const supabase = createClient();

  // Fetch schedule and presets
  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };

      // Fetch schedule
      const scheduleRes = await fetch(`${API_BASE}/collection/schedule`, { headers });
      if (scheduleRes.ok) {
        const data = await scheduleRes.json();
        setSchedule(data);

        // Set cron preset dropdown
        const matchingPreset = CRON_PRESETS.find(p => p.value === data.cron_expression);
        if (matchingPreset) {
          setCronPreset(data.cron_expression);
        } else {
          setCronPreset("custom");
          setCustomCron(data.cron_expression);
        }
      }

      // Fetch presets for dropdown
      const presetsRes = await fetch(`${API_BASE}/amazon/presets`, { headers });
      if (presetsRes.ok) {
        const data = await presetsRes.json();
        setPresets(data.presets || []);
      }
    } catch (e) {
      console.error("Failed to fetch schedule:", e);
    } finally {
      setLoading(false);
    }
  }, [supabase.auth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!schedule) return;

    const cronExpression = cronPreset === "custom" ? customCron : cronPreset;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE}/collection/schedule`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          preset_id: schedule.preset_id,
          cron_expression: cronExpression,
          enabled: schedule.enabled,
          notify_email: schedule.notify_email,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save schedule");
      }

      const updated = await response.json();
      setSchedule(updated);
      toast.success("Schedule saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border animate-fade-in">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!schedule) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8">
          <ErrorEmpty
            message="Unable to load schedule configuration. The server may be unavailable."
            onRetry={fetchData}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduled Collection
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Automatically run collection at a scheduled time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-foreground">Enable Schedule</Label>
            <p className="text-sm text-muted-foreground">
              Automatically run collection at scheduled time
            </p>
          </div>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={(checked) =>
              setSchedule({ ...schedule, enabled: checked })
            }
          />
        </div>

        {/* Preset selection */}
        <div className="space-y-2">
          <Label className="text-foreground">Category Preset</Label>
          <Select
            value={schedule.preset_id || ""}
            onValueChange={(value) =>
              setSchedule({ ...schedule, preset_id: value })
            }
          >
            <SelectTrigger className="bg-muted border-input text-foreground">
              <SelectValue placeholder="Select a preset..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {presets.map((preset) => (
                <SelectItem
                  key={preset.id}
                  value={preset.id}
                  className="text-foreground"
                >
                  {preset.name} ({preset.category_ids.length} categories)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!schedule.preset_id && (
            <p className="text-sm text-yellow-500">
              Select a preset to enable scheduled runs
            </p>
          )}
        </div>

        {/* Cron schedule */}
        <div className="space-y-2">
          <Label className="text-foreground">Schedule</Label>
          <Select value={cronPreset} onValueChange={setCronPreset}>
            <SelectTrigger className="bg-muted border-input text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {CRON_PRESETS.map((preset) => (
                <SelectItem
                  key={preset.value}
                  value={preset.value}
                  className="text-foreground"
                >
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {cronPreset === "custom" && (
            <div className="mt-2">
              <Input
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="0 0 1 * *"
                className="bg-muted border-input text-foreground font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cron format: minute hour day month weekday
              </p>
            </div>
          )}
        </div>

        {/* Next run time */}
        {schedule.next_run_at && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Clock className="h-4 w-4" />
            Next run: {new Date(schedule.next_run_at).toLocaleString()}
          </div>
        )}

        {/* Email notification toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-foreground">Email Notification</Label>
            <p className="text-sm text-muted-foreground">
              Send email when scheduled run completes
            </p>
          </div>
          <Switch
            checked={schedule.notify_email}
            onCheckedChange={(checked) =>
              setSchedule({ ...schedule, notify_email: checked })
            }
          />
        </div>

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={saving || !schedule.preset_id}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Schedule"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
