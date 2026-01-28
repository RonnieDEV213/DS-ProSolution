"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

interface AmazonCategorySelectorProps {
  selectedCategoryIds: string[];
  onSelectionChange: (categoryIds: string[]) => void;
}

export function AmazonCategorySelector({
  selectedCategoryIds,
  onSelectionChange,
}: AmazonCategorySelectorProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const supabase = createClient();

  // Fetch departments
  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const categoriesRes = await fetch(`${API_BASE}/amazon/categories`, { headers });

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setDepartments(data.departments || []);
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
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selection count */}
      <div className="flex items-center justify-end">
        <Badge variant="secondary" className="bg-muted text-foreground">
          {selectedCategoryIds.length} selected
        </Badge>
      </div>

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories..."
          className="pl-9 bg-muted border-input"
        />
      </div>

      {/* Department list */}
      <div className="space-y-2">
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
              className="bg-card rounded-lg overflow-hidden"
            >
              {/* Department header */}
              <div
                className="flex items-center gap-2 p-3 cursor-pointer hover:bg-accent"
                onClick={() => toggleExpanded(dept.id)}
              >
                {/* Expand/collapse icon */}
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
                <span className="flex-1 font-medium text-foreground">
                  {dept.name}
                </span>
                <span className="text-sm text-muted-foreground font-mono">
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
                          "hover:bg-accent",
                          isSelected && "bg-accent/50"
                        )}
                        onClick={() => toggleCategory(cat.id)}
                      >
                        <Checkbox checked={isSelected} />
                        <span className="text-sm text-foreground">{cat.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredDepartments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No categories match your search.
          </div>
        )}
      </div>
    </div>
  );
}
