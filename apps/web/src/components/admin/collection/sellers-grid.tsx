"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useSelectionContainer, Box } from "@air/react-drag-to-select";
import { X, Download, FileText, Braces, Plus, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface Seller {
  id: string;
  display_name: string;
  normalized_name: string;
  platform: string;
  times_seen: number;
  feedback_percent?: number;
  feedback_count?: number;
  created_at?: string;
}

interface SellersGridProps {
  refreshTrigger: number;
  onSellerChange: () => void;
  newSellerIds?: Set<string>; // IDs of sellers added in current run (for highlighting)
}

export function SellersGrid({ refreshTrigger, onSellerChange, newSellerIds = new Set() }: SellersGridProps) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSellerName, setNewSellerName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectableRefs = useRef<Map<string, HTMLElement>>(new Map());
  const isDraggingRef = useRef(false);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  const supabase = createClient();

  // Ref setter for selectable elements (drag selection)
  const setSelectableRef = (id: string, el: HTMLElement | null) => {
    if (el) {
      selectableRefs.current.set(id, el);
    } else {
      selectableRefs.current.delete(id);
    }
  };

  // Selection helpers
  const allSelected = sellers.length > 0 && sellers.every(s => selectedIds.has(s.id));
  const someSelected = selectedIds.size > 0 && !allSelected;
  const hasSelection = selectedIds.size > 0;

  const toggleSelectAll = () => {
    // If ANY sellers are selected (partial or all), unselect all
    // Only select all when nothing is selected
    if (hasSelection) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sellers.map(s => s.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Click handler: single click = toggle selection, double click = edit mode
  const handleSellerClick = (seller: Seller, event: React.MouseEvent) => {
    // Don't trigger if clicking delete button or during editing
    if ((event.target as HTMLElement).closest('button')) return;
    if (editingId === seller.id) return;

    if (clickTimeoutRef.current) {
      // Double-click detected
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      startEdit(seller);
    } else {
      // Potential single click - wait to confirm
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        toggleSelection(seller.id);
      }, 200);
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Delete each selected seller
    for (const id of selectedIds) {
      await fetch(`${API_BASE}/sellers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    }

    setSelectedIds(new Set());
    onSellerChange();
    fetchSellers();
  };

  // Ctrl+A keyboard shortcut for select all / deselect all toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        // Only handle if no input is focused
        const activeEl = document.activeElement;
        const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
        if (!isInputFocused && sellers.length > 0) {
          e.preventDefault();
          // Toggle: if all selected, deselect all; otherwise select all
          setSelectedIds(prev => {
            const allCurrentlySelected = sellers.every(s => prev.has(s.id));
            if (allCurrentlySelected) {
              return new Set();
            } else {
              return new Set(sellers.map(s => s.id));
            }
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sellers]);

  // Clear selection when seller list changes (keep only valid IDs)
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(sellers.map(s => s.id));
      const filtered = new Set([...prev].filter(id => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [sellers]);

  // Clear selection when clicking outside the grid
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const gridContainer = document.getElementById('sellers-grid-container');
      const target = e.target as HTMLElement;

      // Check if click is outside grid and not on header controls (checkbox, delete button, etc.)
      const isInsideGrid = gridContainer?.contains(target);
      const isHeaderControl = target.closest('[data-selection-control]');

      if (!isInsideGrid && !isHeaderControl && selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedIds.size]);

  // Auto-scroll during drag selection
  const SCROLL_INNER_THRESHOLD = 50; // pixels inside edge to start scrolling
  const SCROLL_OUTER_MAX = 150; // max pixels outside to track for speed increase
  const SCROLL_MIN_SPEED = 4; // minimum scroll speed
  const SCROLL_MAX_SPEED = 25; // maximum scroll speed

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  const handleDragMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !gridContainerRef.current) return;

    const container = gridContainerRef.current;
    const rect = container.getBoundingClientRect();
    const mouseY = e.clientY;

    // Clear existing scroll interval
    stopAutoScroll();

    // Calculate scroll zone boundaries
    const topScrollStart = rect.top + SCROLL_INNER_THRESHOLD; // 50px inside top
    const bottomScrollStart = rect.bottom - SCROLL_INNER_THRESHOLD; // 50px inside bottom

    let scrollSpeed = 0;
    let scrollDirection = 0;

    // Check if in top scroll zone (50px inside to 150px outside)
    if (mouseY < topScrollStart) {
      scrollDirection = -1; // scroll up
      // Distance from where scrolling starts (0 at threshold, increases as mouse goes up/out)
      const distance = topScrollStart - mouseY;
      // Calculate speed: starts at min, increases to max based on distance
      const maxDistance = SCROLL_INNER_THRESHOLD + SCROLL_OUTER_MAX;
      const speedFactor = Math.min(distance / maxDistance, 1);
      scrollSpeed = SCROLL_MIN_SPEED + (SCROLL_MAX_SPEED - SCROLL_MIN_SPEED) * speedFactor;
    }
    // Check if in bottom scroll zone (50px inside to 150px outside)
    else if (mouseY > bottomScrollStart) {
      scrollDirection = 1; // scroll down
      const distance = mouseY - bottomScrollStart;
      const maxDistance = SCROLL_INNER_THRESHOLD + SCROLL_OUTER_MAX;
      const speedFactor = Math.min(distance / maxDistance, 1);
      scrollSpeed = SCROLL_MIN_SPEED + (SCROLL_MAX_SPEED - SCROLL_MIN_SPEED) * speedFactor;
    }

    // Start scrolling if in a scroll zone
    if (scrollDirection !== 0) {
      scrollIntervalRef.current = setInterval(() => {
        container.scrollTop += scrollDirection * scrollSpeed;
      }, 16);
    }
  }, [stopAutoScroll]);

  // Set up drag mouse move listener
  useEffect(() => {
    document.addEventListener('mousemove', handleDragMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleDragMouseMove);
      stopAutoScroll();
    };
  }, [handleDragMouseMove, stopAutoScroll]);

  // Drag selection configuration
  const { DragSelection } = useSelectionContainer({
    onSelectionStart: () => {
      isDraggingRef.current = true;
    },
    onSelectionEnd: () => {
      isDraggingRef.current = false;
      stopAutoScroll();
    },
    onSelectionChange: (box: Box) => {
      const selected = new Set<string>();
      selectableRefs.current.forEach((element, id) => {
        const rect = element.getBoundingClientRect();
        // Check if element intersects with selection box
        if (
          rect.left < box.left + box.width &&
          rect.left + rect.width > box.left &&
          rect.top < box.top + box.height &&
          rect.top + rect.height > box.top
        ) {
          selected.add(id);
        }
      });
      setSelectedIds(selected);
    },
    selectionProps: {
      style: {
        border: '1px solid rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 4,
      },
    },
    eventsElement: typeof document !== 'undefined' ? document.getElementById('sellers-grid-container') : undefined,
  });

  // Fetch sellers
  const fetchSellers = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE}/sellers`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSellers(data.sellers || []);
      }
    } catch (e) {
      console.error("Failed to fetch sellers:", e);
    } finally {
      setLoading(false);
    }
  }, [supabase.auth]);

  useEffect(() => {
    fetchSellers();
  }, [refreshTrigger, fetchSellers]);

  // Add seller
  const handleAddSeller = async () => {
    if (!newSellerName.trim()) return;
    setAddError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE}/sellers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: newSellerName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        setAddError(data.detail || "Failed to add seller");
        return;
      }

      setNewSellerName("");
      onSellerChange();
      fetchSellers();
    } catch (e) {
      setAddError("Failed to add seller");
    }
  };

  // Edit seller
  const startEdit = (seller: Seller) => {
    setEditingId(seller.id);
    setEditValue(seller.display_name);
  };

  const saveEdit = async () => {
    if (!editingId || !editValue?.trim()) {
      setEditingId(null);
      setEditValue("");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${API_BASE}/sellers/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: editValue.trim() }),
      });

      setEditingId(null);
      onSellerChange();
      fetchSellers();
    } catch (e) {
      console.error("Failed to update seller:", e);
    }
  };

  // Delete seller
  const handleDelete = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${API_BASE}/sellers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      onSellerChange();
      fetchSellers();
    } catch (e) {
      console.error("Failed to delete seller:", e);
    }
  };

  // Export functions
  const downloadCSV = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`${API_BASE}/sellers/export?format=csv`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sellers.csv";
    a.click();
  };

  const downloadJSON = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`${API_BASE}/sellers/export?format=json`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sellers_${new Date().toISOString().split("T")[0]}_full.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyRawText = async () => {
    const text = sellers.map(s => s.display_name).join("\n");
    await navigator.clipboard.writeText(text);
  };

  if (loading) {
    return <div className="text-gray-400 p-4">Loading sellers...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with add + export */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={newSellerName}
            onChange={(e) => setNewSellerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSeller()}
            placeholder="Add seller..."
            className="bg-gray-800 border-gray-700 text-white max-w-xs"
          />
          <Button
            size="sm"
            onClick={handleAddSeller}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
          </Button>
          {addError && <span className="text-red-400 text-sm">{addError}</span>}
        </div>

        <div className="flex items-center gap-2" data-selection-control>
          {/* Select all checkbox */}
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={toggleSelectAll}
            className="border-gray-600 data-[state=checked]:bg-blue-600"
          />
          {/* Counter: shows selection or total */}
          <span className="text-gray-500 text-sm">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected / ${sellers.length} total`
              : `${sellers.length} sellers`}
          </span>
          {/* Bulk delete button - only visible when selection > 0 */}
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleBulkDelete}
              className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Export
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
              <DropdownMenuItem onClick={downloadCSV} className="text-gray-200 focus:bg-gray-700">
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadJSON} className="text-gray-200 focus:bg-gray-700">
                <Braces className="h-4 w-4 mr-2" />
                Download JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyRawText} className="text-gray-200 focus:bg-gray-700">
                <FileText className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid container with drag selection */}
      <div
        ref={gridContainerRef}
        id="sellers-grid-container"
        className="relative flex-1 min-h-0 overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg"
      >
        <DragSelection />
        {sellers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No sellers yet. Add one above or run a collection.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1 p-2">
            {sellers.map((seller, index) => (
              <HoverCard key={seller.id} openDelay={300} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div
                    ref={(el) => setSelectableRef(seller.id, el)}
                    className={cn(
                      "group relative px-2 py-1 bg-gray-800 rounded text-sm text-gray-200 truncate",
                      "hover:bg-gray-700 transition-colors cursor-pointer",
                      newSellerIds.has(seller.id) && "ring-1 ring-green-500 bg-green-900/20",
                      selectedIds.has(seller.id) && "ring-2 ring-blue-500 bg-blue-900/30"
                    )}
                    onClick={(e) => handleSellerClick(seller, e)}
                  >
                    {editingId === seller.id ? (
                      <input
                        value={editValue ?? ""}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        className="w-full bg-gray-700 px-1 rounded outline-none text-white"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span className="text-gray-500 mr-1">{index + 1}.</span>
                        <span className="truncate">{seller.display_name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(seller.id);
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </HoverCardTrigger>
                <HoverCardContent
                  className="w-56 bg-gray-800 border-gray-700"
                  side="top"
                  align="center"
                >
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {seller.display_name}
                    </h4>
                    <div className="text-xs text-gray-400 space-y-1">
                      {seller.feedback_percent !== undefined && (
                        <div className="flex justify-between">
                          <span>Feedback:</span>
                          <span className="text-gray-200">{seller.feedback_percent}%</span>
                        </div>
                      )}
                      {seller.feedback_count !== undefined && (
                        <div className="flex justify-between">
                          <span>Reviews:</span>
                          <span className="text-gray-200">{seller.feedback_count.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Times seen:</span>
                        <span className="text-gray-200">{seller.times_seen}</span>
                      </div>
                      {seller.created_at && (
                        <div className="flex justify-between">
                          <span>Discovered:</span>
                          <span className="text-gray-200">
                            {new Date(seller.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
