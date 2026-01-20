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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Save } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface Template {
  id: string;
  name: string;
  description: string | null;
  department_ids: string[];
  concurrency: number;
  is_default: boolean;
}

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

// Placeholder departments until Phase 7
const PLACEHOLDER_DEPARTMENTS = [
  { id: "electronics", name: "Electronics" },
  { id: "home-kitchen", name: "Home & Kitchen" },
  { id: "toys-games", name: "Toys & Games" },
  { id: "clothing", name: "Clothing" },
  { id: "sports", name: "Sports & Outdoors" },
  { id: "beauty", name: "Beauty & Personal Care" },
];

export function RunConfigModal({
  open,
  onOpenChange,
  onRunStarted,
}: RunConfigModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [concurrency, setConcurrency] = useState(3);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const supabase = createClient();

  // Fetch templates
  useEffect(() => {
    if (!open) return;

    const fetchTemplates = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(`${API_BASE}/collection/templates`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates || []);

          // Select default template
          const defaultTemplate = data.templates?.find((t: Template) => t.is_default);
          if (defaultTemplate) {
            setSelectedTemplateId(defaultTemplate.id);
            setDepartments(defaultTemplate.department_ids);
            setConcurrency(defaultTemplate.concurrency);
          }
        }
      } catch (e) {
        console.error("Failed to fetch templates:", e);
      }
    };

    fetchTemplates();
  }, [open, supabase.auth]);

  // Fetch estimate when departments change
  useEffect(() => {
    if (departments.length === 0) {
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
          body: JSON.stringify({ category_ids: departments }),
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
  }, [departments, supabase.auth]);

  // Apply template
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setDepartments(template.department_ids);
      setConcurrency(template.concurrency);
    }
  };

  // Toggle department
  const toggleDepartment = (deptId: string) => {
    setDepartments((prev) =>
      prev.includes(deptId)
        ? prev.filter((d) => d !== deptId)
        : [...prev, deptId]
    );
    setSelectedTemplateId(""); // Custom config
  };

  // Select all departments
  const selectAllDepartments = () => {
    setDepartments(PLACEHOLDER_DEPARTMENTS.map((d) => d.id));
    setSelectedTemplateId("");
  };

  // Save as template
  const saveAsTemplate = async () => {
    if (!saveTemplateName.trim()) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${API_BASE}/collection/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: saveTemplateName.trim(),
          department_ids: departments,
          concurrency,
        }),
      });

      setSaveTemplateName("");
      setShowSaveTemplate(false);

      // Refresh templates
      const response = await fetch(`${API_BASE}/collection/templates`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.error("Failed to save template:", e);
    }
  };

  // Start run
  const startRun = async () => {
    if (departments.length === 0) return;
    if (estimate && !estimate.within_budget) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE}/collection/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          category_ids: departments,
          // concurrency would be used by the actual run
        }),
      });

      if (response.ok) {
        const run = await response.json();
        // Start the run
        await fetch(`${API_BASE}/collection/runs/${run.id}/start`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        onRunStarted();
        onOpenChange(false);
      }
    } catch (e) {
      console.error("Failed to start run:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-white">Start Collection Run</DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure which Amazon departments to search and start the collection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template selector */}
          <div className="space-y-2">
            <Label className="text-gray-300">Template</Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue placeholder="Custom configuration" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.is_default && "(default)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Departments */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-gray-300">Departments</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllDepartments}
                className="text-xs"
              >
                Select All
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PLACEHOLDER_DEPARTMENTS.map((dept) => (
                <label
                  key={dept.id}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                    departments.includes(dept.id)
                      ? "bg-blue-900/30 border-blue-500"
                      : "bg-gray-800 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={departments.includes(dept.id)}
                    onChange={() => toggleDepartment(dept.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-200">{dept.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Concurrency */}
          <div className="space-y-2">
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
          {departments.length > 0 && (
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
                  Exceeds budget - reduce departments or increase budget
                </div>
              )}
            </div>
          )}

          {/* Save as template */}
          {showSaveTemplate ? (
            <div className="flex gap-2">
              <Input
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="Template name..."
                className="bg-gray-800 border-gray-700"
              />
              <Button size="sm" onClick={saveAsTemplate}>
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSaveTemplate(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSaveTemplate(true)}
              className="text-gray-400"
            >
              <Save className="h-4 w-4 mr-1" />
              Save as template
            </Button>
          )}
        </div>

        <DialogFooter>
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
              departments.length === 0 ||
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
