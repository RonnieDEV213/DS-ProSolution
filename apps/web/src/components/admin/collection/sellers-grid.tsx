"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Grid, type GridImperativeAPI } from "react-window";
import type { CSSProperties, ReactElement } from "react";
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
import { useSyncSellers } from "@/hooks/sync/use-sync-sellers";
import { useFlagSeller } from "@/hooks/mutations/use-flag-seller";
import { useUpdateSeller } from "@/hooks/mutations/use-update-seller";
import { useDeleteSeller } from "@/hooks/mutations/use-delete-seller";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { db } from "@/lib/db";
import { sellerApi, getAccessToken } from "@/lib/api";
import type { SellerRecord } from "@/lib/db/schema";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Server-side streaming export threshold (sellers)
const LARGE_EXPORT_THRESHOLD = 10_000;

// Grid configuration
const MIN_CELL_WIDTH = 180; // Minimum cell width to determine column count
const CELL_HEIGHT = 32;
const GRID_GAP = 4;
const GRID_PADDING = 8;

interface SellersGridProps {
  refreshTrigger: number;
  onSellerChange: () => void;
  newSellerIds?: Set<string>;
}

// Undo type for delete operations (single-level per CONTEXT.md)
interface UndoEntry {
  sellers: (SellerRecord & { originalIndex: number })[];
  timestamp: number;
}

// Props passed to cell component via cellProps
interface CellProps {
  sellers: SellerRecord[];
  columnCount: number;
  cellWidth: number;
  selectedIds: Set<string>;
  newSellerIds: Set<string>;
  rightDragPreviewIds: Set<string>;
  rightDragMode: boolean | null;
  shiftPreviewIds: Set<string>;
  editingId: string | null;
  editValue: string;
  onSellerClick: (seller: SellerRecord, event: React.MouseEvent) => void;
  onSaveEdit: () => void;
  onEditValueChange: (value: string) => void;
  onHoverEnter: (seller: SellerRecord, rect: DOMRect, shiftKey: boolean) => void;
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
  const isFlagged = seller.flagged;
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
          "group relative w-full h-full px-2 flex items-center bg-muted rounded text-sm text-foreground",
          "hover:bg-accent transition-colors cursor-pointer select-none",
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
            className="w-full bg-accent px-1 rounded outline-none text-foreground text-sm"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            data-no-drag
          />
        ) : (
          <>
            <span className="text-muted-foreground mr-1 text-xs flex-shrink-0">{index + 1}.</span>
            <span className="truncate flex-1">{seller.display_name}</span>
          </>
        )}
      </div>
    </div>
  );
}

// Hover detail panel component
function SellerDetailPanel({ seller }: { seller: SellerRecord | null }) {
  if (!seller) return null;

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 p-3 bg-popover border border-border rounded-lg shadow-xl pointer-events-none">
      <h4 className="text-sm font-semibold text-foreground truncate mb-2">
        {seller.display_name}
      </h4>
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Times seen:</span>
          <span className="text-foreground font-mono">{seller.times_seen}</span>
        </div>
        <div className="flex justify-between">
          <span>Platform:</span>
          <span className="text-foreground font-mono">{seller.platform}</span>
        </div>
        {seller.updated_at && (
          <div className="flex justify-between">
            <span>Last updated:</span>
            <span className="text-foreground font-mono text-sm">
              {new Date(seller.updated_at).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Data flow architecture:
// - useSyncSellers (useLiveQuery on IndexedDB) is the single source of truth
// - All mutations go through hooks (useFlagSeller, useUpdateSeller, useDeleteSeller)
//   which update IndexedDB first, then sync to API. useLiveQuery reacts automatically.
// - No SSE handlers push seller data directly; parent refreshTrigger triggers re-sync
// - Export routes to server-side streaming for large datasets (>10k sellers)
export function SellersGrid({ refreshTrigger, onSellerChange, newSellerIds = new Set() }: SellersGridProps) {
  const [newSellerName, setNewSellerName] = useState("");

  // Debounce search term for IndexedDB query (300ms)
  const debouncedSearch = useDebouncedValue(
    newSellerName.includes('\n') ? '' : newSellerName.trim(),
    300
  );

  const {
    sellers,
    isLoading: loading,
    isSyncing,
    totalCount,
    flaggedCount,
    refetch,
  } = useSyncSellers({
    filters: {
      search: debouncedSearch || undefined,
    },
  });

  // Mutation hooks (IndexedDB + API, offline-capable)
  const flagMutation = useFlagSeller();
  const updateMutation = useUpdateSeller();
  const deleteMutation = useDeleteSeller();

  const [isAddInputFocused, setIsAddInputFocused] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 400 });
  const [hoveredSeller, setHoveredSeller] = useState<SellerRecord | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Shift+hover preview state
  const [shiftPreviewIds, setShiftPreviewIds] = useState<Set<string>>(new Set());

  // Single-level undo stack for delete operations (per CONTEXT.md)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

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
  const sellersRef = useRef<SellerRecord[]>([]);
  sellersRef.current = sellers;
  const filteredSellersRef = useRef<SellerRecord[]>([]);

  // Export options state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFlagOnExport, setExportFlagOnExport] = useState(true);
  const [exportFirstN, setExportFirstN] = useState("");
  const [exportRangeStart, setExportRangeStart] = useState("");
  const [exportRangeEnd, setExportRangeEnd] = useState("");

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

  // useSyncSellers already handles search filtering via debouncedSearch
  // No additional client-side filtering needed
  const filteredSellers = sellers;

  // Update ref for stable callback access
  filteredSellersRef.current = filteredSellers;

  const rowCount = useMemo(() => {
    return Math.ceil(filteredSellers.length / columnCount);
  }, [filteredSellers.length, columnCount]);

  // Selection helpers
  const allSelected = filteredSellers.length > 0 && filteredSellers.every(s => selectedIds.has(s.id));
  const someSelected = selectedIds.size > 0 && !allSelected;
  const hasSelection = selectedIds.size > 0;

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
  const handleSellerClick = useCallback((seller: SellerRecord, event: React.MouseEvent) => {
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

  // Undo last delete operation (single-level per CONTEXT.md)
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;

    const lastEntry = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    // Restore to IndexedDB immediately (useLiveQuery reacts)
    await db.sellers.bulkPut(lastEntry.sellers);

    // Re-add to server
    try {
      const names = lastEntry.sellers.map(s => s.display_name);
      if (names.length === 1) {
        await sellerApi.createSeller(names[0]);
      } else {
        await sellerApi.createSellersBulk(names);
      }
      toast.success(`Restored ${names.length} seller${names.length > 1 ? 's' : ''}`);
      onSellerChange();
      refetch(); // Re-sync to get correct server IDs
    } catch (e) {
      console.error("Undo failed:", e);
      toast.error("Failed to restore sellers");
    }
  }, [undoStack, onSellerChange, refetch]);

  // Bulk delete handler with undo support
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const idsArray = Array.from(selectedIds);

    // Capture deleted sellers from IndexedDB for undo (before deletion)
    const deletedSellers: (SellerRecord & { originalIndex: number })[] = [];
    for (const id of idsArray) {
      const seller = await db.sellers.get(id);
      if (seller) {
        const originalIndex = filteredSellers.findIndex(s => s.id === id);
        deletedSellers.push({ ...seller, originalIndex });
      }
    }

    // Push to undo stack (single-level: overwrite)
    setUndoStack([{ sellers: deletedSellers, timestamp: Date.now() }]);
    setSelectedIds(new Set());

    // Delete via mutation hook (handles IndexedDB removal + API)
    deleteMutation.mutate({ ids: idsArray });

    // Show toast with undo option
    toast.success(
      `Deleted ${idsArray.length} seller${idsArray.length > 1 ? 's' : ''}`,
      {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => handleUndo(),
        },
      }
    );
    onSellerChange();
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
  const handleRightDragEnd = useCallback(() => {
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
        // Toggle flag via mutation hook (updates IndexedDB + API, useLiveQuery reacts)
        flagMutation.mutate({ id: seller.id, flagged: !seller.flagged });
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

    // Flag each seller via mutation hook (updates IndexedDB + API, useLiveQuery reacts)
    for (const id of idsToToggle) {
      flagMutation.mutate({ id, flagged: mode });
    }
  }, [flagMutation, getGridPositionFromPixels, columnCount]);

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

  // Ctrl+Z for undo (single-level, no redo per CONTEXT.md)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input
      const activeEl = document.activeElement;
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (isInputFocused) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

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

  // Trigger re-sync when parent signals data change
  useEffect(() => {
    refetch();
  }, [refreshTrigger, refetch]);

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
      if (sellerNames.length === 1) {
        await sellerApi.createSeller(sellerNames[0]);
      } else {
        const result = await sellerApi.createSellersBulk(sellerNames);
        if (result.failed_count > 0) {
          if (result.success_count > 0) {
            setAddError(`Added ${result.success_count}, failed ${result.failed_count}: ${result.errors[0]}${result.errors.length > 1 ? '...' : ''}`);
          } else {
            setAddError(result.errors[0] || "Failed to add sellers");
            return;
          }
        }
      }
      setNewSellerName("");
      onSellerChange();
      // Trigger re-sync to pull new sellers into IndexedDB
      refetch();
    } catch {
      setAddError("Failed to add seller");
    }
  };

  // Save edit
  const saveEdit = useCallback(() => {
    if (!editingId || !editValue?.trim()) {
      setEditingId(null);
      setEditValue("");
      return;
    }

    updateMutation.mutate({ id: editingId, name: editValue.trim() });
    setEditingId(null);
    setEditValue("");
    onSellerChange();
  }, [editingId, editValue, updateMutation, onSellerChange]);

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
  const flagExportedSellers = useCallback((sellerIds: string[]) => {
    if (!exportFlagOnExport || sellerIds.length === 0) return;

    // Find sellers that aren't already flagged
    const currentSellers = sellersRef.current;
    const idsToFlag = sellerIds.filter(id => {
      const seller = currentSellers.find(s => s.id === id);
      return seller && !seller.flagged;
    });

    if (idsToFlag.length === 0) return;

    // Flag each via mutation hook (updates IndexedDB + API, useLiveQuery reacts)
    for (const id of idsToFlag) {
      flagMutation.mutate({ id, flagged: true });
    }
  }, [exportFlagOnExport, flagMutation]);

  // Export count preview
  const exportPreviewCount = useMemo(() => {
    return getFilteredSellersForExport().length;
  }, [getFilteredSellersForExport]);

  // Helper: trigger blob download
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Server-side streaming export (authenticated fetch + blob download)
  const serverSideExport = useCallback(async (format: 'csv' | 'json') => {
    const token = await getAccessToken();
    const params = new URLSearchParams();
    if (exportFlagOnExport) params.set('flagged', 'false'); // export unflagged to flag them
    const url = `${API_BASE}/export/sellers/${format}?${params}`;

    const res = await fetch(url, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!res.ok) {
      toast.error(`Export failed: ${res.statusText}`);
      return;
    }

    const blob = await res.blob();
    const dateStr = new Date().toISOString().split("T")[0];
    downloadBlob(blob, `sellers_${dateStr}.${format}`);
    setExportOpen(false);
  }, [exportFlagOnExport]);

  // Export functions with large dataset routing
  const downloadCSV = useCallback(async () => {
    const filtered = getFilteredSellersForExport();
    if (filtered.length === 0) return;

    // Route to server-side streaming for large datasets
    if (totalCount > LARGE_EXPORT_THRESHOLD) {
      await serverSideExport('csv');
      return;
    }

    // Client-side export for small datasets
    const headers = ["display_name", "platform", "times_seen", "updated_at"];
    const rows = filtered.map(s => [
      `"${s.display_name.replace(/"/g, '""')}"`,
      s.platform,
      s.times_seen,
      s.updated_at || "",
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    downloadBlob(blob, `sellers_${new Date().toISOString().split("T")[0]}.csv`);

    // Flag exported sellers
    flagExportedSellers(filtered.map(s => s.id));
    setExportOpen(false);
  }, [getFilteredSellersForExport, totalCount, serverSideExport, flagExportedSellers]);

  const downloadJSON = useCallback(async () => {
    const filtered = getFilteredSellersForExport();
    if (filtered.length === 0) return;

    // Route to server-side streaming for large datasets
    if (totalCount > LARGE_EXPORT_THRESHOLD) {
      await serverSideExport('json');
      return;
    }

    // Client-side export for small datasets
    const data = {
      exported_at: new Date().toISOString(),
      count: filtered.length,
      sellers: filtered.map(s => ({
        display_name: s.display_name,
        platform: s.platform,
        times_seen: s.times_seen,
        updated_at: s.updated_at,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, `sellers_${new Date().toISOString().split("T")[0]}.json`);

    // Flag exported sellers
    flagExportedSellers(filtered.map(s => s.id));
    setExportOpen(false);
  }, [getFilteredSellersForExport, totalCount, serverSideExport, flagExportedSellers]);

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
    onHoverEnter: (seller: SellerRecord, rect: DOMRect, shiftKey: boolean) => {
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
    return <div className="text-muted-foreground p-4">Loading sellers...</div>;
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
                className="bg-muted border border-border text-foreground w-96 px-3 py-2 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="border-border data-[state=checked]:bg-primary"
          />
          <span className="text-muted-foreground text-sm">
            {selectedIds.size > 0
              ? `${selectedIds.size.toLocaleString()} selected / `
              : ""}
            {filteredSellers.length !== totalCount
              ? `${filteredSellers.length.toLocaleString()} / ${totalCount.toLocaleString()}`
              : `${totalCount.toLocaleString()} sellers`}
            {flaggedCount > 0 && (
              <span className="text-yellow-500 ml-2">({flaggedCount} flagged)</span>
            )}
            {isSyncing && (
              <span className="text-muted-foreground/60 text-xs ml-1">(syncing...)</span>
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
            <PopoverContent align="end" className="w-72 bg-popover border-border p-4">
              <div className="space-y-4">
                {/* Flag on export checkbox */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="flag-on-export"
                    checked={exportFlagOnExport}
                    onCheckedChange={(checked) => setExportFlagOnExport(checked === true)}
                    className="border-border data-[state=checked]:bg-yellow-600"
                  />
                  <Label htmlFor="flag-on-export" className="text-foreground text-sm cursor-pointer">
                    Flag exported sellers
                  </Label>
                </div>

                {/* First N input */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">First N (optional)</Label>
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
                    className="bg-card border-border text-foreground h-8 text-sm"
                  />
                </div>

                {/* Range inputs */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Range (optional)</Label>
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
                      className="bg-card border-border text-foreground h-8 text-sm"
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input
                      type="number"
                      min="1"
                      placeholder="To"
                      value={exportRangeEnd}
                      onChange={(e) => {
                        setExportRangeEnd(e.target.value);
                        if (e.target.value) setExportFirstN("");
                      }}
                      className="bg-card border-border text-foreground h-8 text-sm"
                    />
                  </div>
                </div>

                {/* Preview count */}
                <div className="text-sm text-muted-foreground text-center py-1 bg-card rounded font-mono">
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
        className="relative flex-1 min-h-0 bg-card border border-border rounded-lg overflow-hidden"
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
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {totalCount === 0
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
            className="scrollbar-thin"
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
