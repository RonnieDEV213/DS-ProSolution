"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Save, Trash2, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface Preset {
  id: string;
  name: string;
  category_ids: string[];
  is_builtin: boolean;
}

interface CategoryPresetDropdownProps {
  presets: Preset[];
  selectedCategoryIds: string[];
  allCategoryIds: string[];
  onPresetSelect: (categoryIds: string[]) => void;
  onPresetsChange: () => void;
}

export function CategoryPresetDropdown({
  presets,
  selectedCategoryIds,
  allCategoryIds,
  onPresetSelect,
  onPresetsChange,
}: CategoryPresetDropdownProps) {
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = createClient();

  const handleSelectAll = () => {
    onPresetSelect(allCategoryIds);
  };

  const handlePresetClick = (preset: Preset) => {
    if (preset.name === "Select All") {
      handleSelectAll();
    } else {
      onPresetSelect(preset.category_ids);
    }
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    if (selectedCategoryIds.length === 0) {
      toast.error("Select at least one category first");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(`${API_BASE}/amazon/presets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: newPresetName.trim(),
          category_ids: selectedCategoryIds,
        }),
      });

      if (response.status === 409) {
        toast.error("A preset with this name already exists");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to save preset");
      }

      toast.success(`Preset "${newPresetName}" saved`);
      setNewPresetName("");
      setShowSaveInput(false);
      onPresetsChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save preset");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePreset = async (preset: Preset, e: React.MouseEvent) => {
    e.stopPropagation();

    if (preset.is_builtin) return;

    setDeletingId(preset.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE}/amazon/presets/${preset.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete preset");
      }

      toast.success(`Preset "${preset.name}" deleted`);
      onPresetsChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete preset");
    } finally {
      setDeletingId(null);
    }
  };

  // Find current selection in presets
  const currentPreset = presets.find(
    (p) =>
      p.category_ids.length === selectedCategoryIds.length &&
      p.category_ids.every((id) => selectedCategoryIds.includes(id))
  );

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-border bg-card">
            {currentPreset?.name || "Select preset..."}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-card border-border">
          {/* Select All (always first) */}
          <DropdownMenuItem
            onClick={handleSelectAll}
            className="cursor-pointer"
          >
            Select All
          </DropdownMenuItem>

          {/* Custom presets */}
          {presets.filter((p) => !p.is_builtin && p.name !== "Select All").length > 0 && (
            <>
              <DropdownMenuSeparator className="bg-border" />
              {presets
                .filter((p) => !p.is_builtin && p.name !== "Select All")
                .map((preset) => (
                  <DropdownMenuItem
                    key={preset.id}
                    onClick={() => handlePresetClick(preset)}
                    className="cursor-pointer flex justify-between"
                  >
                    <span>{preset.name}</span>
                    <button
                      onClick={(e) => handleDeletePreset(preset, e)}
                      className="text-muted-foreground hover:text-red-400 ml-2"
                      disabled={deletingId === preset.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </DropdownMenuItem>
                ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save as preset */}
      {showSaveInput ? (
        <div className="flex items-center gap-2">
          <Input
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder="Preset name..."
            className="w-40 h-9 bg-muted border-input"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSavePreset();
              if (e.key === "Escape") {
                setShowSaveInput(false);
                setNewPresetName("");
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleSavePreset}
            disabled={saving}
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowSaveInput(false);
              setNewPresetName("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSaveInput(true)}
          className="text-muted-foreground"
        >
          <Save className="h-4 w-4 mr-1" />
          Save preset
        </Button>
      )}
    </div>
  );
}
