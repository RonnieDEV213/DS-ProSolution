"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { CategoryPresetDropdown } from "./category-preset-dropdown";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface Category {
  id: string;
  name: string;
  node_id: string;
}

interface Department {
  id: string;
  name: string;
  node_id: string;
  categories: Category[];
}

interface Preset {
  id: string;
  name: string;
  category_ids: string[];
  is_builtin: boolean;
}

interface AmazonCategorySelectorProps {
  selectedCategoryIds: string[];
  onSelectionChange: (categoryIds: string[]) => void;
}

export function AmazonCategorySelector({
  selectedCategoryIds,
  onSelectionChange,
}: AmazonCategorySelectorProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const supabase = createClient();

  // Fetch departments and presets
  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };

      // Fetch in parallel
      const [categoriesRes, presetsRes] = await Promise.all([
        fetch(`${API_BASE}/amazon/categories`, { headers }),
        fetch(`${API_BASE}/amazon/presets`, { headers }),
      ]);

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setDepartments(data.departments || []);
      }

      if (presetsRes.ok) {
        const data = await presetsRes.json();
        setPresets(data.presets || []);
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase.auth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get all category IDs for "Select All"
  const allCategoryIds = useMemo(() => {
    return departments.flatMap((dept) =>
      dept.categories.map((cat) => cat.id)
    );
  }, [departments]);

  // Filter departments based on search
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departments;

    const query = searchQuery.toLowerCase();
    return departments
      .map((dept) => {
        const deptMatches = dept.name.toLowerCase().includes(query);
        const matchingCats = dept.categories.filter((cat) =>
          cat.name.toLowerCase().includes(query)
        );

        // Include department if it matches or has matching categories
        if (deptMatches || matchingCats.length > 0) {
          return {
            ...dept,
            // If department matches, show all categories; otherwise show only matching
            categories: deptMatches ? dept.categories : matchingCats,
          };
        }
        return null;
      })
      .filter((dept): dept is Department => dept !== null);
  }, [departments, searchQuery]);

  // Toggle department expansion
  const toggleExpanded = (deptId: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  // Toggle all categories in a department
  const toggleDepartment = (dept: Department) => {
    const deptCategoryIds = dept.categories.map((c) => c.id);
    const allSelected = deptCategoryIds.every((id) =>
      selectedCategoryIds.includes(id)
    );

    if (allSelected) {
      // Deselect all in department
      onSelectionChange(
        selectedCategoryIds.filter((id) => !deptCategoryIds.includes(id))
      );
    } else {
      // Select all in department
      const newSelection = new Set([...selectedCategoryIds, ...deptCategoryIds]);
      onSelectionChange(Array.from(newSelection));
    }
  };

  // Toggle single category
  const toggleCategory = (categoryId: string) => {
    if (selectedCategoryIds.includes(categoryId)) {
      onSelectionChange(selectedCategoryIds.filter((id) => id !== categoryId));
    } else {
      onSelectionChange([...selectedCategoryIds, categoryId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        Loading categories...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with preset dropdown and selection count */}
      <div className="flex items-center justify-between">
        <CategoryPresetDropdown
          presets={presets}
          selectedCategoryIds={selectedCategoryIds}
          allCategoryIds={allCategoryIds}
          onPresetSelect={onSelectionChange}
          onPresetsChange={fetchData}
        />
        <Badge variant="secondary" className="bg-gray-700 text-gray-200">
          {selectedCategoryIds.length} selected
        </Badge>
      </div>

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories..."
          className="pl-9 bg-gray-800 border-gray-700"
        />
      </div>

      {/* Department list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {filteredDepartments.map((dept) => {
          const deptCategoryIds = dept.categories.map((c) => c.id);
          const selectedInDept = deptCategoryIds.filter((id) =>
            selectedCategoryIds.includes(id)
          ).length;
          const allSelected = selectedInDept === deptCategoryIds.length;
          const someSelected = selectedInDept > 0 && !allSelected;
          const isExpanded = expandedDepts.has(dept.id);

          return (
            <div
              key={dept.id}
              className="bg-gray-800 rounded-lg overflow-hidden"
            >
              {/* Department header */}
              <div
                className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-750"
                onClick={() => toggleExpanded(dept.id)}
              >
                {/* Expand/collapse icon */}
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}

                {/* Department checkbox */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDepartment(dept);
                  }}
                >
                  <Checkbox
                    checked={allSelected}
                    className={cn(
                      someSelected && "opacity-50 data-[state=checked]:opacity-100"
                    )}
                  />
                </div>

                {/* Department name and count */}
                <span className="flex-1 font-medium text-white">
                  {dept.name}
                </span>
                <span className="text-sm text-gray-500">
                  {selectedInDept}/{deptCategoryIds.length}
                </span>
              </div>

              {/* Category list (collapsible) */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-1 ml-6">
                  {dept.categories.map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <div
                        key={cat.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded cursor-pointer",
                          "hover:bg-gray-700",
                          isSelected && "bg-gray-700/50"
                        )}
                        onClick={() => toggleCategory(cat.id)}
                      >
                        <Checkbox checked={isSelected} />
                        <span className="text-sm text-gray-300">{cat.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredDepartments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No categories match your search.
          </div>
        )}
      </div>
    </div>
  );
}
