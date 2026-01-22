"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Grid, type GridImperativeAPI } from "react-window";
import type { CSSProperties, ReactElement } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Download, FileText, Braces, Plus, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Grid configuration
const MIN_CELL_WIDTH = 180; // Minimum cell width to determine column count
const CELL_HEIGHT = 32;
const GRID_GAP = 4;
const GRID_PADDING = 8;

interface Seller {
  id: string;
  display_name: string;
  normalized_name: string;
  platform: string;
  times_seen: number;
  feedback_percent?: number;
  feedback_count?: number;
  created_at?: string;
  flagged?: boolean;
}

interface SellersGridProps {
  refreshTrigger: number;
  onSellerChange: () => void;
  newSellerIds?: Set<string>;
}

// Undo/redo types for delete operations
interface DeletedSeller extends Seller {
  originalIndex: number;
}
interface UndoEntry {
  sellers: DeletedSeller[];
  timestamp: number;
}

// Props passed to cell component via cellProps
interface CellProps {
  sellers: Seller[];
  columnCount: number;
  cellWidth: number;
  selectedIds: Set<string>;
  newSellerIds: Set<string>;
  rightDragPreviewIds: Set<string>;
  rightDragMode: boolean | null;
  shiftPreviewIds: Set<string>;
  editingId: string | null;
  editValue: string;
  onSellerClick: (seller: Seller, event: React.MouseEvent) => void;
  onSaveEdit: () => void;
  onEditValueChange: (value: string) => void;
  onHoverEnter: (seller: Seller, rect: DOMRect, shiftKey: boolean) => void;
  onHoverLeave: () => void;
  isDragging: () => boolean;
}

// Cell component for virtualized grid (react-window v2 API)
function SellerCell({
  columnIndex,
  rowIndex,
  style,
  sellers,
  columnCount,
  cellWidth,
  selectedIds,
  newSellerIds,
  rightDragPreviewIds,
  rightDragMode,
  shiftPreviewIds,
  editingId,
  editValue,
  onSellerClick,
  onSaveEdit,
  onEditValueChange,
  onHoverEnter,
  onHoverLeave,
  isDragging,
}: {
  ariaAttributes: { "aria-colindex": number; role: "gridcell" };
  columnIndex: number;
  rowIndex: number;
  style: CSSProperties;
} & CellProps): ReactElement | null {
  const index = rowIndex * columnCount + columnIndex;
  if (index >= sellers.length) return null;

  const seller = sellers[index];
  const isSelected = selectedIds.has(seller.id);
  const isNew = newSellerIds.has(seller.id);
  const isEditing = editingId === seller.id;
  const isFlagged = seller.flagged === true;
  const isInShiftPreview = shiftPreviewIds.has(seller.id);

  // Check if this seller is in the right-drag preview
  const isInRightDragPreview = rightDragPreviewIds.has(seller.id);
  // Show preview flag state: if in preview, show what it WILL be; otherwise show current
  const showAsFlagged = isInRightDragPreview ? rightDragMode === true : isFlagged;

  // Parse style values safely (v2 may pass strings or numbers)
  const parseStyleValue = (value: string | number | undefined): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    return 0;
  };

  return (
    <div
      style={{
        ...style,
        left: parseStyleValue(style.left) + GRID_PADDING,
        top: parseStyleValue(style.top) + GRID_PADDING,
        width: cellWidth,
        height: CELL_HEIGHT,
        padding: 0,
      }}
    >
      <div
        className={cn(
          "group relative w-full h-full px-2 flex items-center bg-gray-800 rounded text-sm text-gray-200",
          "hover:bg-gray-700 transition-colors cursor-pointer select-none",
          showAsFlagged && "ring-1 ring-yellow-500 bg-yellow-900/20",
          isNew && !showAsFlagged && "ring-1 ring-green-500 bg-green-900/20",
          isInShiftPreview && !isSelected && "ring-1 ring-blue-400/50 bg-blue-900/20",
          isSelected && "ring-2 ring-blue-500 bg-blue-900/30"
        )}
        onClick={(e) => onSellerClick(seller, e)}
        onMouseEnter={(e) => {
          if (!isDragging()) {
            const rect = e.currentTarget.getBoundingClientRect();
            onHoverEnter(seller, rect, e.shiftKey);
          }
        }}
        onMouseLeave={onHoverLeave}
      >
        {isEditing ? (
          <input
            value={editValue ?? ""}
            onChange={(e) => onEditValueChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={(e) => e.key === "Enter" && onSaveEdit()}
            className="w-full bg-gray-700 px-1 rounded outline-none text-white text-sm"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            data-no-drag
          />
        ) : (
          <>
            <span className="text-gray-500 mr-1 text-xs flex-shrink-0">{index + 1}.</span>
            <span className="truncate flex-1">{seller.display_name}</span>
          </>
        )}
      </div>
    </div>
  );
}

// Hover detail panel component
function SellerDetailPanel({ seller }: { seller: Seller | null }) {
  if (!seller) return null;

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 p-3 bg-gray-800 border border-gray-700 rounded-lg shadow-xl pointer-events-none">
      <h4 className="text-sm font-semibold text-white truncate mb-2">
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
  );
}

export function SellersGrid({ refreshTrigger, onSellerChange, newSellerIds = new Set() }: SellersGridProps) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSellerName, setNewSellerName] = useState("");
  const [isAddInputFocused, setIsAddInputFocused] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 400 });
  const [hoveredSeller, setHoveredSeller] = useState<Seller | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Shift+hover preview state
  const [shiftPreviewIds, setShiftPreviewIds] = useState<Set<string>>(new Set());

  // Undo/redo stacks for delete operations
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  // Drag selection state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; scrollTop: number } | null>(null);
  const dragCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const [dragBox, setDragBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  // Scroll state for auto-scroll during drag
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gridRef = useRef<GridImperativeAPI | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Right-click drag for flag painting (rectangle selection)
  const isRightDraggingRef = useRef(false);
  const rightDragModeRef = useRef<boolean | null>(null); // true = flagging, false = unflagging
  const rightDragStartRef = useRef<{ x: number; y: number; scrollTop: number } | null>(null);
  const rightDragCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const rightDragPreviewIdsRef = useRef<Set<string>>(new Set()); // ref for callback access
  const [rightDragBox, setRightDragBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [rightDragPreviewIds, setRightDragPreviewIds] = useState<Set<string>>(new Set()); // state for UI reactivity
  const [rightDragMode, setRightDragMode] = useState<boolean | null>(null);

  // Refs to access current sellers in stable callbacks
  const sellersRef = useRef<Seller[]>([]);
  sellersRef.current = sellers;
  const filteredSellersRef = useRef<Seller[]>([]);

  // Export options state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFlagOnExport, setExportFlagOnExport] = useState(true);
  const [exportFirstN, setExportFirstN] = useState("");
  const [exportRangeStart, setExportRangeStart] = useState("");
  const [exportRangeEnd, setExportRangeEnd] = useState("");

  const supabase = createClient();

  // Fetch sellers - defined early so other callbacks can reference it
  const fetchSellers = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE}/sellers?limit=100000`, {
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

  // Calculate grid dimensions
  const { columnCount, cellWidth } = useMemo(() => {
    const availableWidth = containerSize.width - GRID_PADDING * 2;
    // Determine column count based on minimum cell width
    const cols = Math.max(1, Math.floor((availableWidth + GRID_GAP) / (MIN_CELL_WIDTH + GRID_GAP)));
    // Calculate exact cell width to perfectly fill available space
    // Formula: cols * cellWidth + (cols - 1) * GRID_GAP = availableWidth
    // So: cellWidth = (availableWidth - (cols - 1) * GRID_GAP) / cols
    const width = (availableWidth - (cols - 1) * GRID_GAP) / cols;
    return { columnCount: cols, cellWidth: Math.floor(width) };
  }, [containerSize.width]);

  // Filter sellers based on search input (only when single line - not bulk add mode)
  const filteredSellers = useMemo(() => {
    const searchTerm = newSellerName.trim().toLowerCase();
    const isMultiLine = newSellerName.includes('\n');

    if (!searchTerm || isMultiLine) {
      return sellers;
    }

    return sellers.filter(s =>
      s.display_name.toLowerCase().includes(searchTerm)
    );
  }, [sellers, newSellerName]);

  // Update ref for stable callback access
  filteredSellersRef.current = filteredSellers;

  const rowCount = useMemo(() => {
    return Math.ceil(filteredSellers.length / columnCount);
  }, [filteredSellers.length, columnCount]);

  // Selection helpers
  const allSelected = filteredSellers.length > 0 && filteredSellers.every(s => selectedIds.has(s.id));
  const someSelected = selectedIds.size > 0 && !allSelected;
  const hasSelection = selectedIds.size > 0;
  const flaggedCount = useMemo(() => sellers.filter(s => s.flagged).length, [sellers]);

  const toggleSelectAll = useCallback(() => {
    if (hasSelection) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSellers.map(s => s.id)));
    }
  }, [hasSelection, filteredSellers]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Get seller index from grid position
  const getSellerIndex = useCallback((row: number, col: number) => {
    return row * columnCount + col;
  }, [columnCount]);

  // Get grid position from pixel coordinates (relative to grid content)
  const getGridPositionFromPixels = useCallback((x: number, y: number, scrollTop: number) => {
    const col = Math.floor((x - GRID_PADDING) / (cellWidth + GRID_GAP));
    const row = Math.floor((y + scrollTop - GRID_PADDING) / (CELL_HEIGHT + GRID_GAP));
    return { row: Math.max(0, row), col: Math.max(0, Math.min(col, columnCount - 1)) };
  }, [columnCount, cellWidth]);

  // Calculate which sellers are in the drag selection box
  const getSelectedSellersInBox = useCallback((box: { left: number; top: number; width: number; height: number }, scrollTop: number) => {
    const selected = new Set<string>();

    // Get grid positions for box corners
    const startPos = getGridPositionFromPixels(box.left, box.top, scrollTop);
    const endPos = getGridPositionFromPixels(box.left + box.width, box.top + box.height, scrollTop);

    // Select all sellers in the rectangular region
    for (let row = startPos.row; row <= endPos.row; row++) {
      for (let col = startPos.col; col <= endPos.col; col++) {
        const index = getSellerIndex(row, col);
        if (index < filteredSellers.length) {
          selected.add(filteredSellers[index].id);
        }
      }
    }

    return selected;
  }, [getGridPositionFromPixels, getSellerIndex, filteredSellers]);

  // Click handler for seller cells
  const handleSellerClick = useCallback((seller: Seller, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) return;
    if (editingId === seller.id) return;

    const index = filteredSellers.findIndex(s => s.id === seller.id);

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      setEditingId(seller.id);
      setEditValue(seller.display_name);
      return;
    }

    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;

      if (event.shiftKey && selectionAnchor !== null) {
        // Range select: from anchor to current
        const start = Math.min(selectionAnchor, index);
        const end = Math.max(selectionAnchor, index);
        const rangeIds = new Set(
          filteredSellers.slice(start, end + 1).map(s => s.id)
        );
        setSelectedIds(rangeIds);
      } else if (event.ctrlKey || event.metaKey) {
        // Toggle individual item, keep anchor
        toggleSelection(seller.id);
        setSelectionAnchor(index);
      } else {
        // Normal click: select single, set as anchor
        setSelectedIds(new Set([seller.id]));
        setSelectionAnchor(index);
      }

      // Clear shift preview
      setShiftPreviewIds(new Set());
    }, 200);
  }, [editingId, filteredSellers, selectionAnchor, toggleSelection]);

  // Undo last delete operation
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;

    const lastEntry = undoStack[undoStack.length - 1];

    // Move to redo stack
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastEntry]);

    // Restore sellers to UI (optimistic)
    setSellers(prev => {
      const restored = [...prev];
      // Sort by original index to insert in correct positions
      const sorted = [...lastEntry.sellers].sort((a, b) => a.originalIndex - b.originalIndex);
      for (const seller of sorted) {
        // Insert at original position or at end if position is beyond current length
        const idx = Math.min(seller.originalIndex, restored.length);
        restored.splice(idx, 0, seller);
      }
      return restored;
    });

    // Re-add to backend
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const names = lastEntry.sellers.map(s => s.display_name);
      if (names.length === 1) {
        await fetch(`${API_BASE}/sellers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name: names[0] }),
        });
      } else {
        await fetch(`${API_BASE}/sellers/bulk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ names }),
        });
      }
      toast.success(`Restored ${names.length} seller${names.length > 1 ? 's' : ''}`);
      onSellerChange();
      fetchSellers(); // Refresh to get new IDs
    } catch (e) {
      console.error("Undo failed:", e);
      toast.error("Failed to restore sellers");
    }
  }, [undoStack, supabase.auth, onSellerChange, fetchSellers]);

  // Redo last undone delete operation
  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0) return;

    const lastEntry = redoStack[redoStack.length - 1];

    // Move to undo stack
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, lastEntry]);

    // Remove from UI
    const idsToRemove = new Set(lastEntry.sellers.map(s => s.id));
    setSellers(prev => prev.filter(s => !idsToRemove.has(s.id)));

    // Delete from backend
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const ids = lastEntry.sellers.map(s => s.id);
      await fetch(`${API_BASE}/sellers/bulk/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ids }),
      });
      toast.success(`Re-deleted ${ids.length} seller${ids.length > 1 ? 's' : ''}`);
      onSellerChange();
    } catch (e) {
      console.error("Redo failed:", e);
      toast.error("Failed to re-delete sellers");
    }
  }, [redoStack, supabase.auth, onSellerChange]);

  // Bulk delete handler with undo support
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const idsArray = Array.from(selectedIds);

    // Capture deleted sellers with their original positions for undo
    const deletedSellers: DeletedSeller[] = idsArray.map(id => {
      const originalIndex = filteredSellers.findIndex(s => s.id === id);
      const seller = sellers.find(s => s.id === id)!;
      return { ...seller, originalIndex };
    });

    // Push to undo stack
    setUndoStack(prev => [...prev, { sellers: deletedSellers, timestamp: Date.now() }]);
    setRedoStack([]); // Clear redo stack on new action

    // Optimistically remove from UI
    setSellers(prev => prev.filter(s => !selectedIds.has(s.id)));
    setSelectedIds(new Set());

    // Show toast with undo option
    toast.success(
      `Deleted ${deletedSellers.length} seller${deletedSellers.length > 1 ? 's' : ''}`,
      {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => handleUndo(),
        },
      }
    );

    // Perform actual delete
    try {
      if (idsArray.length === 1) {
        await fetch(`${API_BASE}/sellers/${idsArray[0]}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } else {
        await fetch(`${API_BASE}/sellers/bulk/delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ ids: idsArray }),
        });
      }
      onSellerChange();
    } catch (e) {
      console.error("Delete failed:", e);
      // Restore on failure
      setSellers(prev => [...prev, ...deletedSellers]);
      setUndoStack(prev => prev.slice(0, -1));
      toast.error("Failed to delete sellers");
    }
  };

  // Auto-scroll during drag
  const SCROLL_INNER_THRESHOLD = 125;
  const SCROLL_OUTER_MAX = 150;
  const SCROLL_MIN_SPEED = 4;
  const SCROLL_MAX_SPEED = 25;

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  // Drag selection handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') ||
        (e.target as HTMLElement).closest('input') ||
        (e.target as HTMLElement).closest('[data-no-drag]')) {
      return;
    }

    const container = gridContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scrollTop = gridRef.current?.element?.scrollTop || 0;

    // Check if click is on a seller cell
    const pos = getGridPositionFromPixels(x, y, scrollTop);
    const index = pos.row * columnCount + pos.col;
    const clickedOnSeller = index < filteredSellers.length;

    if (e.button === 2) {
      // Right-click: start flag painting rectangle
      isRightDraggingRef.current = true;
      rightDragStartRef.current = { x, y, scrollTop };
      rightDragCurrentRef.current = { x, y };

      // Determine mode from first seller under cursor
      let mode = true; // Default to flagging
      if (clickedOnSeller) {
        const firstSeller = filteredSellers[index];
        mode = !firstSeller.flagged; // Toggle: if flagged, unflag; if not, flag
      }
      rightDragModeRef.current = mode;
      setRightDragMode(mode);
    } else {
      // Left-click
      if (!clickedOnSeller) {
        // Clicked empty space - deselect all
        setSelectedIds(new Set());
        setSelectionAnchor(null);
        return; // Don't start drag selection
      }

      // Start selection rectangle
      isDraggingRef.current = true;
      dragStartRef.current = { x, y, scrollTop };
      dragCurrentRef.current = { x, y };
    }
  }, [getGridPositionFromPixels, columnCount, filteredSellers]);

  // Calculate and update drag box and selection
  const updateDragSelection = useCallback(() => {
    if (!isDraggingRef.current || !dragStartRef.current || !dragCurrentRef.current) return;

    const currentScrollTop = gridRef.current?.element?.scrollTop || 0;
    const { x: startX, y: startY, scrollTop: initialScrollTop } = dragStartRef.current;
    const { x: currentX, y: currentY } = dragCurrentRef.current;

    // Convert start position to current scroll context
    // If we scrolled down, the start point should appear higher (subtract scroll delta)
    const scrollDelta = currentScrollTop - initialScrollTop;
    const adjustedStartY = startY - scrollDelta;

    // Calculate visual drag box (what user sees on screen)
    const visualLeft = Math.min(startX, currentX);
    const visualTop = Math.min(adjustedStartY, currentY);
    const visualWidth = Math.abs(currentX - startX);
    const visualHeight = Math.abs(currentY - adjustedStartY);

    // Calculate content-space coordinates for selection (accounting for scroll)
    const contentStartY = startY + initialScrollTop;
    const contentCurrentY = currentY + currentScrollTop;
    const contentTop = Math.min(contentStartY, contentCurrentY);
    const contentBottom = Math.max(contentStartY, contentCurrentY);
    const contentLeft = Math.min(startX, currentX);
    const contentRight = Math.max(startX, currentX);

    // Only show drag box if dragged more than 5 pixels
    if (visualWidth > 5 || visualHeight > 5) {
      setDragBox({ left: visualLeft, top: visualTop, width: visualWidth, height: visualHeight });

      // Calculate selected sellers using content-space coordinates
      const selected = getSelectedSellersInBox(
        { left: contentLeft, top: contentTop - currentScrollTop, width: contentRight - contentLeft, height: contentBottom - contentTop },
        currentScrollTop
      );
      setSelectedIds(selected);
    }
  }, [getSelectedSellersInBox]);

  // Calculate and update right-drag box and flag preview
  const updateRightDragSelection = useCallback(() => {
    if (!isRightDraggingRef.current || !rightDragStartRef.current || !rightDragCurrentRef.current) return;

    const currentScrollTop = gridRef.current?.element?.scrollTop || 0;
    const { x: startX, y: startY, scrollTop: initialScrollTop } = rightDragStartRef.current;
    const { x: currentX, y: currentY } = rightDragCurrentRef.current;

    const scrollDelta = currentScrollTop - initialScrollTop;
    const adjustedStartY = startY - scrollDelta;

    const visualLeft = Math.min(startX, currentX);
    const visualTop = Math.min(adjustedStartY, currentY);
    const visualWidth = Math.abs(currentX - startX);
    const visualHeight = Math.abs(currentY - adjustedStartY);

    const contentStartY = startY + initialScrollTop;
    const contentCurrentY = currentY + currentScrollTop;
    const contentTop = Math.min(contentStartY, contentCurrentY);
    const contentBottom = Math.max(contentStartY, contentCurrentY);
    const contentLeft = Math.min(startX, currentX);
    const contentRight = Math.max(startX, currentX);

    // Only show drag box if dragged more than 5 pixels
    if (visualWidth > 5 || visualHeight > 5) {
      setRightDragBox({ left: visualLeft, top: visualTop, width: visualWidth, height: visualHeight });

      // Calculate sellers in the rectangle for preview
      const previewIds = getSelectedSellersInBox(
        { left: contentLeft, top: contentTop - currentScrollTop, width: contentRight - contentLeft, height: contentBottom - contentTop },
        currentScrollTop
      );
      rightDragPreviewIdsRef.current = previewIds; // Update ref for callback
      setRightDragPreviewIds(previewIds); // Update state for UI
    } else {
      // Single click (no drag yet) - show preview for just the one seller
      const pos = getGridPositionFromPixels(startX, startY, initialScrollTop);
      const index = pos.row * columnCount + pos.col;
      if (index < filteredSellers.length) {
        const previewIds = new Set([filteredSellers[index].id]);
        rightDragPreviewIdsRef.current = previewIds;
        setRightDragPreviewIds(previewIds);
      }
    }
  }, [getSelectedSellersInBox, getGridPositionFromPixels, columnCount, filteredSellers]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = gridContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Handle left-click drag selection
    if (isDraggingRef.current && dragStartRef.current) {
      dragCurrentRef.current = { x, y };
      updateDragSelection();
    }

    // Handle right-click drag flag painting
    if (isRightDraggingRef.current && rightDragStartRef.current) {
      rightDragCurrentRef.current = { x, y };
      updateRightDragSelection();
    }

    // Skip auto-scroll if not dragging
    if (!isDraggingRef.current && !isRightDraggingRef.current) return;

    // Auto-scroll
    stopAutoScroll();
    const mouseY = e.clientY;
    const topScrollStart = rect.top + SCROLL_INNER_THRESHOLD;
    const bottomScrollStart = rect.bottom - SCROLL_INNER_THRESHOLD;

    let scrollSpeed = 0;
    let scrollDirection = 0;

    if (mouseY < topScrollStart) {
      scrollDirection = -1;
      const distance = topScrollStart - mouseY;
      const maxDistance = SCROLL_INNER_THRESHOLD + SCROLL_OUTER_MAX;
      const speedFactor = Math.min(distance / maxDistance, 1);
      scrollSpeed = SCROLL_MIN_SPEED + (SCROLL_MAX_SPEED - SCROLL_MIN_SPEED) * speedFactor;
    } else if (mouseY > bottomScrollStart) {
      scrollDirection = 1;
      const distance = mouseY - bottomScrollStart;
      const maxDistance = SCROLL_INNER_THRESHOLD + SCROLL_OUTER_MAX;
      const speedFactor = Math.min(distance / maxDistance, 1);
      scrollSpeed = SCROLL_MIN_SPEED + (SCROLL_MAX_SPEED - SCROLL_MIN_SPEED) * speedFactor;
    }

    if (scrollDirection !== 0 && gridRef.current?.element) {
      scrollIntervalRef.current = setInterval(() => {
        const element = gridRef.current?.element;
        if (element) {
          element.scrollTop += scrollDirection * scrollSpeed;
          // Update selection while scrolling
          if (isDraggingRef.current) updateDragSelection();
          if (isRightDraggingRef.current) updateRightDragSelection();
        }
      }, 16);
    }
  }, [updateDragSelection, updateRightDragSelection, stopAutoScroll]);

  // Right-click drag end - apply flags to all sellers in rectangle
  // Defined here so handleMouseUp can reference it
  const handleRightDragEnd = useCallback(async () => {
    if (!isRightDraggingRef.current) return;

    const previewIds = Array.from(rightDragPreviewIdsRef.current);
    const mode = rightDragModeRef.current;
    const startPos = rightDragStartRef.current;

    // Reset state immediately
    isRightDraggingRef.current = false;
    rightDragStartRef.current = null;
    rightDragCurrentRef.current = null;
    rightDragModeRef.current = null;
    rightDragPreviewIdsRef.current = new Set();
    setRightDragPreviewIds(new Set());
    setRightDragMode(null);
    setRightDragBox(null);

    // If no drag movement, toggle the single seller under the cursor
    if (previewIds.length === 0 && startPos) {
      const pos = getGridPositionFromPixels(startPos.x, startPos.y, startPos.scrollTop);
      const index = pos.row * columnCount + pos.col;
      const currentFilteredSellers = filteredSellersRef.current;
      if (index < currentFilteredSellers.length) {
        const seller = currentFilteredSellers[index];
        const newFlagged = !seller.flagged;

        // Update UI immediately
        setSellers(prev => prev.map(s =>
          s.id === seller.id ? { ...s, flagged: newFlagged } : s
        ));

        // Sync to API
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await fetch(`${API_BASE}/sellers/${seller.id}/flag`, {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          }
        } catch (e) {
          console.error("Failed to sync flag:", e);
          fetchSellers();
        }
      }
      return;
    }

    if (previewIds.length === 0 || mode === null) return;

    // Find which sellers actually need to be toggled (state differs from target)
    const currentSellers = sellersRef.current;
    const idsToToggle = previewIds.filter(id => {
      const seller = currentSellers.find(s => s.id === id);
      return seller && seller.flagged !== mode;
    });

    if (idsToToggle.length === 0) return;

    // Update UI immediately
    setSellers(prev => prev.map(s =>
      previewIds.includes(s.id) ? { ...s, flagged: mode } : s
    ));

    // Batch API calls for sellers that need toggling
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await Promise.all(idsToToggle.map(id =>
        fetch(`${API_BASE}/sellers/${id}/flag`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      ));
    } catch (e) {
      console.error("Failed to sync flags:", e);
      fetchSellers();
    }
  }, [supabase.auth, fetchSellers, getGridPositionFromPixels, columnCount]);

  const handleMouseUp = useCallback(() => {
    // End left-click drag selection
    isDraggingRef.current = false;
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    setDragBox(null);
    stopAutoScroll();

    // End right-click drag flag painting
    if (isRightDraggingRef.current) {
      handleRightDragEnd();
    }
  }, [stopAutoScroll, handleRightDragEnd]);

  // Set up mouse event listeners
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      stopAutoScroll();
    };
  }, [handleMouseMove, handleMouseUp, stopAutoScroll]);

  // Ctrl+A handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const activeEl = document.activeElement;
        const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
        if (!isInputFocused && filteredSellers.length > 0) {
          e.preventDefault();
          setSelectedIds(prev => {
            const allCurrentlySelected = filteredSellers.every(s => prev.has(s.id));
            return allCurrentlySelected ? new Set() : new Set(filteredSellers.map(s => s.id));
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredSellers]);

  // Ctrl+C handler - copy selected sellers (or all filtered if none selected)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const activeEl = document.activeElement;
        const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
        const hasTextSelection = window.getSelection()?.toString();

        // Only handle if not in input and no text is selected
        if (!isInputFocused && !hasTextSelection && filteredSellers.length > 0) {
          e.preventDefault();
          // Copy selected sellers, or all filtered if none selected
          const sellersToCopy = selectedIds.size > 0
            ? filteredSellers.filter(s => selectedIds.has(s.id))
            : filteredSellers;
          const text = sellersToCopy.map(s => s.display_name).join('\n');
          navigator.clipboard.writeText(text);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredSellers, selectedIds]);

  // Ctrl+Z for undo, Ctrl+Shift+Z for redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input
      const activeEl = document.activeElement;
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (isInputFocused) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          // Ctrl+Shift+Z = Redo
          e.preventDefault();
          handleRedo();
        } else {
          // Ctrl+Z = Undo
          e.preventDefault();
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Clear selection when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const gridContainer = document.getElementById('sellers-grid-container');
      const target = e.target as HTMLElement;
      const isInsideGrid = gridContainer?.contains(target);
      const isHeaderControl = target.closest('[data-selection-control]');

      if (!isInsideGrid && !isHeaderControl && selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedIds.size]);

  // Clear invalid selection IDs when sellers change
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(sellers.map(s => s.id));
      const filtered = new Set([...prev].filter(id => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [sellers]);

  useEffect(() => {
    fetchSellers();
  }, [refreshTrigger, fetchSellers]);

  // Add seller(s) - supports pasting multiple sellers (one per line)
  const handleAddSeller = async () => {
    if (!newSellerName.trim()) return;
    setAddError(null);

    // Split by newlines and filter empty lines
    const sellerNames = newSellerName
      .split(/[\r\n]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (sellerNames.length === 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Use bulk endpoint for multiple sellers, single endpoint for one
      if (sellerNames.length === 1) {
        const response = await fetch(`${API_BASE}/sellers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name: sellerNames[0] }),
        });

        if (!response.ok) {
          const data = await response.json();
          setAddError(data.detail || "Failed to add seller");
          return;
        }
      } else {
        // Use bulk endpoint
        const response = await fetch(`${API_BASE}/sellers/bulk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ names: sellerNames }),
        });

        if (!response.ok) {
          const data = await response.json();
          setAddError(data.detail || "Failed to add sellers");
          return;
        }

        const result = await response.json();
        if (result.failed_count > 0) {
          if (result.success_count > 0) {
            setAddError(`Added ${result.success_count}, failed ${result.failed_count}: ${result.errors[0]}${result.errors.length > 1 ? '...' : ''}`);
          } else {
            setAddError(result.errors[0] || "Failed to add sellers");
          }
        }
      }

      setNewSellerName("");
      onSellerChange();
      fetchSellers();
    } catch (e) {
      setAddError("Failed to add seller");
    }
  };

  // Save edit
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

  // Get filtered sellers based on export options (uses current search filter as base)
  const getFilteredSellersForExport = useCallback(() => {
    let filtered = [...filteredSellers];

    // Apply limit - First N takes priority over range
    const n = parseInt(exportFirstN, 10);
    const start = parseInt(exportRangeStart, 10);
    const end = parseInt(exportRangeEnd, 10);

    if (!isNaN(n) && n > 0) {
      filtered = filtered.slice(0, n);
    } else if (!isNaN(start) && !isNaN(end) && start >= 1 && end >= start) {
      filtered = filtered.slice(start - 1, end); // Convert to 0-indexed
    }

    return filtered;
  }, [filteredSellers, exportFirstN, exportRangeStart, exportRangeEnd]);

  // Flag exported sellers
  const flagExportedSellers = useCallback(async (sellerIds: string[]) => {
    if (!exportFlagOnExport || sellerIds.length === 0) return;

    // Find sellers that aren't already flagged
    const currentSellers = sellersRef.current;
    const idsToFlag = sellerIds.filter(id => {
      const seller = currentSellers.find(s => s.id === id);
      return seller && !seller.flagged;
    });

    if (idsToFlag.length === 0) return;

    // Update UI immediately
    setSellers(prev => prev.map(s =>
      sellerIds.includes(s.id) ? { ...s, flagged: true } : s
    ));

    // Sync to API
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await Promise.all(idsToFlag.map(id =>
        fetch(`${API_BASE}/sellers/${id}/flag`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      ));
    } catch (e) {
      console.error("Failed to flag exported sellers:", e);
    }
  }, [exportFlagOnExport, supabase.auth]);

  // Export count preview
  const exportPreviewCount = useMemo(() => {
    return getFilteredSellersForExport().length;
  }, [getFilteredSellersForExport]);

  // Export functions
  const downloadCSV = () => {
    const filtered = getFilteredSellersForExport();
    if (filtered.length === 0) return;

    const headers = ["display_name", "platform", "times_seen", "created_at"];
    const rows = filtered.map(s => [
      `"${s.display_name.replace(/"/g, '""')}"`,
      s.platform,
      s.times_seen,
      s.created_at || "",
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sellers_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // Flag exported sellers
    flagExportedSellers(filtered.map(s => s.id));
    setExportOpen(false);
  };

  const downloadJSON = () => {
    const filtered = getFilteredSellersForExport();
    if (filtered.length === 0) return;

    const data = {
      exported_at: new Date().toISOString(),
      count: filtered.length,
      sellers: filtered.map(s => ({
        display_name: s.display_name,
        platform: s.platform,
        times_seen: s.times_seen,
        created_at: s.created_at,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sellers_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Flag exported sellers
    flagExportedSellers(filtered.map(s => s.id));
    setExportOpen(false);
  };

  const copyRawText = async () => {
    const filtered = getFilteredSellersForExport();
    if (filtered.length === 0) return;

    const text = filtered.map(s => s.display_name).join("\n");
    await navigator.clipboard.writeText(text);

    // Flag exported sellers
    flagExportedSellers(filtered.map(s => s.id));
    setExportOpen(false);
  };

  // Cell props for react-window v2
  const cellProps = useMemo<CellProps>(() => ({
    sellers: filteredSellers,
    columnCount,
    cellWidth,
    selectedIds,
    newSellerIds,
    rightDragPreviewIds,
    rightDragMode,
    shiftPreviewIds,
    editingId,
    editValue,
    onSellerClick: handleSellerClick,
    onSaveEdit: saveEdit,
    onEditValueChange: setEditValue,
    onHoverEnter: (seller: Seller, rect: DOMRect, shiftKey: boolean) => {
      setHoveredSeller(seller);
      setHoverPosition({ x: rect.left + rect.width / 2, y: rect.top });

      // Calculate shift preview range
      if (shiftKey && selectionAnchor !== null) {
        const hoverIndex = filteredSellers.findIndex(s => s.id === seller.id);
        if (hoverIndex !== -1) {
          const start = Math.min(selectionAnchor, hoverIndex);
          const end = Math.max(selectionAnchor, hoverIndex);
          const previewIds = new Set(
            filteredSellers.slice(start, end + 1).map(s => s.id)
          );
          setShiftPreviewIds(previewIds);
        }
      } else {
        setShiftPreviewIds(new Set());
      }
    },
    onHoverLeave: () => {
      setHoveredSeller(null);
      setShiftPreviewIds(new Set());
    },
    isDragging: () => isDraggingRef.current,
  }), [filteredSellers, columnCount, cellWidth, selectedIds, newSellerIds, rightDragPreviewIds, rightDragMode, shiftPreviewIds, selectionAnchor, editingId, editValue, handleSellerClick, saveEdit]);

  if (loading) {
    return <div className="text-gray-400 p-4">Loading sellers...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-1">
          {(() => {
            // Calculate display value for when textarea is blurred
            const lines = newSellerName.split(/[\r\n]+/).filter(l => l.trim());
            const showSummary = !isAddInputFocused && lines.length > 1;
            const displayValue = showSummary
              ? `${lines[0].trim()} +${lines.length - 1}`
              : newSellerName;

            return (
              <textarea
                value={displayValue}
                onChange={(e) => {
                  // Only allow changes when focused (showing full value)
                  if (isAddInputFocused) {
                    setNewSellerName(e.target.value);
                  }
                }}
                onFocus={() => setIsAddInputFocused(true)}
                onBlur={() => setIsAddInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddSeller();
                  }
                }}
                placeholder="Search or add seller(s)..."
                rows={1}
                className="bg-gray-800 border border-gray-700 text-white w-96 px-3 py-2 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ minHeight: '38px', maxHeight: '100px' }}
              />
            );
          })()}
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
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={toggleSelectAll}
            className="border-gray-600 data-[state=checked]:bg-blue-600"
          />
          <span className="text-gray-500 text-sm">
            {selectedIds.size > 0
              ? `${selectedIds.size.toLocaleString()} selected / `
              : ""}
            {filteredSellers.length !== sellers.length
              ? `${filteredSellers.length.toLocaleString()} / ${sellers.length.toLocaleString()}`
              : `${sellers.length.toLocaleString()} sellers`}
            {flaggedCount > 0 && (
              <span className="text-yellow-500 ml-2">({flaggedCount} flagged)</span>
            )}
          </span>
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
          <Popover open={exportOpen} onOpenChange={setExportOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Export
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 bg-gray-800 border-gray-700 p-4">
              <div className="space-y-4">
                {/* Flag on export checkbox */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="flag-on-export"
                    checked={exportFlagOnExport}
                    onCheckedChange={(checked) => setExportFlagOnExport(checked === true)}
                    className="border-gray-600 data-[state=checked]:bg-yellow-600"
                  />
                  <Label htmlFor="flag-on-export" className="text-gray-300 text-sm cursor-pointer">
                    Flag exported sellers
                  </Label>
                </div>

                {/* First N input */}
                <div className="space-y-1">
                  <Label className="text-gray-400 text-xs">First N (optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Export first N sellers"
                    value={exportFirstN}
                    onChange={(e) => {
                      setExportFirstN(e.target.value);
                      if (e.target.value) {
                        setExportRangeStart("");
                        setExportRangeEnd("");
                      }
                    }}
                    className="bg-gray-900 border-gray-600 text-white h-8 text-sm"
                  />
                </div>

                {/* Range inputs */}
                <div className="space-y-1">
                  <Label className="text-gray-400 text-xs">Range (optional)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      min="1"
                      placeholder="From"
                      value={exportRangeStart}
                      onChange={(e) => {
                        setExportRangeStart(e.target.value);
                        if (e.target.value) setExportFirstN("");
                      }}
                      className="bg-gray-900 border-gray-600 text-white h-8 text-sm"
                    />
                    <span className="text-gray-500 text-sm">to</span>
                    <Input
                      type="number"
                      min="1"
                      placeholder="To"
                      value={exportRangeEnd}
                      onChange={(e) => {
                        setExportRangeEnd(e.target.value);
                        if (e.target.value) setExportFirstN("");
                      }}
                      className="bg-gray-900 border-gray-600 text-white h-8 text-sm"
                    />
                  </div>
                </div>

                {/* Preview count */}
                <div className="text-sm text-gray-400 text-center py-1 bg-gray-900 rounded">
                  {exportPreviewCount.toLocaleString()} sellers
                </div>

                {/* Export buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={downloadCSV}
                    disabled={exportPreviewCount === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    onClick={downloadJSON}
                    disabled={exportPreviewCount === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Braces className="h-3 w-3 mr-1" />
                    JSON
                  </Button>
                  <Button
                    size="sm"
                    onClick={copyRawText}
                    disabled={exportPreviewCount === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Virtualized grid container */}
      <div
        ref={gridContainerRef}
        id="sellers-grid-container"
        className="relative flex-1 min-h-0 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Drag selection box (blue - left click) */}
        {dragBox && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: dragBox.left,
              top: dragBox.top,
              width: dragBox.width,
              height: dragBox.height,
              border: '1px solid rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: 4,
            }}
          />
        )}

        {/* Flag painting box (yellow - right click) */}
        {rightDragBox && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: rightDragBox.left,
              top: rightDragBox.top,
              width: rightDragBox.width,
              height: rightDragBox.height,
              border: '1px solid rgb(234, 179, 8)',
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              borderRadius: 4,
            }}
          />
        )}

        {filteredSellers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {sellers.length === 0
              ? "No sellers yet. Add one above or run a collection."
              : "No sellers match your search."}
          </div>
        ) : (
          <Grid<CellProps>
            gridRef={gridRef}
            cellComponent={SellerCell}
            cellProps={cellProps}
            columnCount={columnCount}
            columnWidth={cellWidth + GRID_GAP}
            rowCount={rowCount}
            rowHeight={CELL_HEIGHT + GRID_GAP}
            defaultWidth={800}
            defaultHeight={400}
            overscanCount={5}
            onResize={(size) => {
              setContainerSize(size);
            }}
            style={{ width: '100%', height: '100%' }}
            className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
          />
        )}

        {/* Hover detail panel */}
        {hoveredSeller && !isDraggingRef.current && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: hoverPosition.x,
              top: hoverPosition.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <SellerDetailPanel seller={hoveredSeller} />
          </div>
        )}
      </div>
    </div>
  );
}
