"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Bot, FileQuestion, CalendarIcon, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { HistoryFilterChips } from "@/components/admin/collection/history-filter-chips";
import type { DateRange } from "react-day-picker";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const PAGE_SIZE = 30;

// Manual edit log entry (now includes export and flag action types)
interface ManualLogEntry {
  type: "manual_edit";
  id: string;
  action: "add" | "edit" | "remove" | "export" | "flag";
  seller_name: string;
  source: string;
  affected_count: number;
  created_at: string;
  new_value?: string;
}

// Collection run entry
interface CollectionRunEntry {
  type: "collection_run";
  id: string;
  name: string;
  started_at: string;
  completed_at: string | null;
  status: "completed" | "failed" | "cancelled";
  sellers_new: number;
  categories_count: number;
}

type HistoryEntry = ManualLogEntry | CollectionRunEntry;

// Changes type for diff display
interface SellerChanges {
  added: string[];
  removed: string[];
}

interface LogDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLogId: string | null;
  selectedRunId?: string | null;
}

const actionColors: Record<string, string> = {
  add: "text-green-400 bg-green-400/10",
  edit: "text-yellow-400 bg-yellow-400/10",
  remove: "text-red-400 bg-red-400/10",
  export: "text-purple-400 bg-purple-400/10",
  flag: "text-yellow-400 bg-yellow-400/10",
};

const statusStyles: Record<string, string> = {
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-yellow-500/20 text-yellow-400",
};

// Type badge colors for event rows
const eventBadgeStyles: Record<string, string> = {
  export: "bg-purple-500/20 text-purple-400",
  flag: "bg-yellow-500/20 text-yellow-400",
  add: "bg-green-500/20 text-green-400",
  edit: "bg-blue-500/20 text-blue-400",
  remove: "bg-red-500/20 text-red-400",
};

const eventLabels: Record<string, string> = {
  export: "Export",
  flag: "Flag",
  add: "Run",
  edit: "Edit",
  remove: "Remove",
};

// Day grouping helpers
function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
}

function groupByDay(entries: HistoryEntry[]): [string, HistoryEntry[]][] {
  const groups = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const time =
      entry.type === "collection_run"
        ? entry.completed_at || entry.started_at
        : entry.created_at;
    const label = getDayLabel(time);
    const group = groups.get(label) || [];
    group.push(entry);
    groups.set(label, group);
  }
  return Array.from(groups.entries());
}

// Get timestamp for an entry
function getEntryTime(entry: HistoryEntry): string {
  if (entry.type === "collection_run") {
    return entry.completed_at || entry.started_at;
  }
  return entry.created_at;
}

export function LogDetailModal({
  open,
  onOpenChange,
  selectedLogId,
  selectedRunId,
}: LogDetailModalProps) {
  const [changes, setChanges] = useState<SellerChanges>({ added: [], removed: [] });
  const [allEntries, setAllEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [changesLoading, setChangesLoading] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<{ type: "log" | "run"; id: string } | null>(null);

  // Filter state
  const [activeFilter, setActiveFilter] = useState("all");
  const [filterActionTypes, setFilterActionTypes] = useState<string[] | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Pagination state for infinite scroll
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch version counter to invalidate stale requests
  const fetchVersionRef = useRef(0);

  const supabase = createClient();

  // Fetch changes for a specific audit log entry
  const fetchChangesForEntry = useCallback(async (logId: string) => {
    setChangesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${API_BASE}/sellers/audit-log/${logId}/sellers`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        // New response shape: { sellers, count, added, removed }
        setChanges({
          added: data.added || [],
          removed: data.removed || [],
        });
      }
    } catch (e) {
      console.error("Failed to fetch changes:", e);
    } finally {
      setChangesLoading(false);
    }
  }, [supabase.auth]);

  // Fetch changes for a specific collection run
  const fetchChangesForRun = useCallback(async (runId: string) => {
    setChangesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${API_BASE}/sellers/export?run_id=${runId}&format=json`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        // Collection runs only add sellers, never remove
        setChanges({
          added: (data.sellers || []).map((s: { display_name: string }) => s.display_name),
          removed: [],
        });
      }
    } catch (e) {
      console.error("Failed to fetch changes for run:", e);
    } finally {
      setChangesLoading(false);
    }
  }, [supabase.auth]);

  // Fetch entries from the audit log API with filters and pagination
  const fetchEntries = useCallback(async (
    offset: number,
    actionTypes: string[] | null,
    range: DateRange | undefined,
    version: number,
  ): Promise<HistoryEntry[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (actionTypes) params.set("action_types", actionTypes.join(","));
    if (range?.from) params.set("date_from", range.from.toISOString());
    if (range?.to) params.set("date_to", range.to.toISOString());

    const headers = { Authorization: `Bearer ${session.access_token}` };
    const mergedEntries: HistoryEntry[] = [];

    // Fetch audit log entries
    const logsRes = await fetch(
      `${API_BASE}/sellers/audit-log?${params}`,
      { headers }
    );
    if (logsRes.ok) {
      const data = await logsRes.json();
      for (const log of data.entries || []) {
        mergedEntries.push({
          type: "manual_edit",
          id: log.id,
          action: log.action,
          seller_name: log.seller_name,
          source: log.source,
          affected_count: log.affected_count || 1,
          created_at: log.created_at,
          new_value: log.new_value,
        });
      }
    }

    // Fetch collection runs only when filter is "all" or "runs" (action type "add")
    const shouldFetchRuns =
      !actionTypes || actionTypes.includes("add");
    if (shouldFetchRuns && offset === 0) {
      // Only fetch runs on first page to avoid duplication
      const runsParams = new URLSearchParams();
      runsParams.set("limit", "50");
      if (range?.from) runsParams.set("date_from", range.from.toISOString());
      if (range?.to) runsParams.set("date_to", range.to.toISOString());

      const runsRes = await fetch(
        `${API_BASE}/collection/runs/history?${runsParams}`,
        { headers }
      );
      if (runsRes.ok) {
        const data = await runsRes.json();
        for (const run of data.runs || []) {
          mergedEntries.push({
            type: "collection_run",
            id: run.id,
            name: run.name,
            started_at: run.started_at,
            completed_at: run.completed_at,
            status: run.status,
            sellers_new: run.sellers_new || 0,
            categories_count: run.categories_count || 0,
          });
        }
      }
    }

    // Sort by timestamp descending
    mergedEntries.sort((a, b) => {
      const aTime = getEntryTime(a);
      const bTime = getEntryTime(b);
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    return mergedEntries;
  }, [supabase.auth]);

  // Load more entries (infinite scroll)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const version = fetchVersionRef.current;
      const entries = await fetchEntries(
        allEntries.length,
        filterActionTypes,
        dateRange,
        version,
      );
      // Stale request check
      if (version !== fetchVersionRef.current) return;
      if (entries.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setAllEntries((prev) => [...prev, ...entries]);
    } catch (e) {
      console.error("Failed to load more entries:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, allEntries.length, filterActionTypes, dateRange, fetchEntries]);

  // IntersectionObserver sentinel for infinite scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (!node || !hasMore) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadMore();
          }
        },
        { threshold: 0.1 }
      );
      observerRef.current.observe(node);
    },
    [loadMore, hasMore]
  );

  // Initial fetch and refetch on filter/date changes
  useEffect(() => {
    if (!open) return;

    const version = ++fetchVersionRef.current;

    const fetchInitial = async () => {
      setLoading(true);
      setAllEntries([]);
      setHasMore(true);
      try {
        const entries = await fetchEntries(0, filterActionTypes, dateRange, version);
        // Stale request check
        if (version !== fetchVersionRef.current) return;
        if (entries.length < PAGE_SIZE) {
          setHasMore(false);
        }
        setAllEntries(entries);

        // Fetch changes for initial selection (only on first open, not on filter changes)
        if (selectedRunId && !viewingEntry) {
          setViewingEntry({ type: "run", id: selectedRunId });
          await fetchChangesForRun(selectedRunId);
        } else if (selectedLogId && !viewingEntry) {
          setViewingEntry({ type: "log", id: selectedLogId });
          await fetchChangesForEntry(selectedLogId);
        }
      } catch (e) {
        console.error("Failed to fetch log data:", e);
      } finally {
        if (version === fetchVersionRef.current) {
          setLoading(false);
        }
      }
    };

    fetchInitial();
  }, [open, filterActionTypes, dateRange, fetchEntries, selectedLogId, selectedRunId, fetchChangesForEntry, fetchChangesForRun, viewingEntry]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setActiveFilter("all");
      setFilterActionTypes(null);
      setDateRange(undefined);
      setAllEntries([]);
      setHasMore(true);
      setViewingEntry(null);
      setChanges({ added: [], removed: [] });
    }
  }, [open]);

  // Unified click handler for all entry types
  const handleEntryClick = (entry: HistoryEntry) => {
    if (entry.type === "manual_edit") {
      setViewingEntry({ type: "log", id: entry.id });
      fetchChangesForEntry(entry.id);
    } else if (entry.type === "collection_run") {
      setViewingEntry({ type: "run", id: entry.id });
      fetchChangesForRun(entry.id);
    }
  };

  const isViewing = (entry: HistoryEntry) => {
    if (!viewingEntry) return false;
    if (entry.type === "manual_edit" && viewingEntry.type === "log") {
      return entry.id === viewingEntry.id;
    }
    if (entry.type === "collection_run" && viewingEntry.type === "run") {
      return entry.id === viewingEntry.id;
    }
    return false;
  };

  const hasChanges = changes.added.length > 0 || changes.removed.length > 0;

  // Group entries by day
  const groupedEntries = groupByDay(allEntries);

  // Whether to show the history list loading skeleton (initial load or filter change)
  const historyLoading = loading && allEntries.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-5xl h-[80vh] flex flex-col" showCloseButton={false}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-foreground">
            History Entry
          </DialogTitle>
        </DialogHeader>

        {historyLoading ? (
          <div className="grid grid-cols-5 gap-4 flex-1 min-h-0 animate-fade-in">
            {/* Left panel skeleton - changes list (col-span-2) */}
            <div className="col-span-2 flex flex-col min-h-0">
              <Skeleton className="h-4 w-16 mb-2" />
              <div className="flex-1 rounded border border-border p-2 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                    <Skeleton className="h-3.5 w-3.5" />
                    <Skeleton className="h-3 flex-1" />
                  </div>
                ))}
              </div>
            </div>
            {/* Right panel skeleton - history list (col-span-3) */}
            <div className="col-span-3 flex flex-col min-h-0">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-48 mb-2" />
              <div className="flex-1 rounded border border-border space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="px-3 py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-3 flex-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-4 flex-1 min-h-0">
            {/* Left: Changes panel (col-span-2) */}
            <div className="col-span-2 flex flex-col min-h-0">
              <h4 className="text-sm font-medium text-foreground mb-2 flex-shrink-0">
                Changes
              </h4>
              <div className="flex-1 overflow-y-auto scrollbar-thin bg-muted rounded border border-border p-2 min-h-0">
                {changesLoading ? (
                  <div className="space-y-2 animate-fade-in">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded border-l-2 border-border">
                        <Skeleton className="h-3.5 w-3.5" />
                        <Skeleton className="h-3 flex-1" />
                      </div>
                    ))}
                  </div>
                ) : !hasChanges ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <FileQuestion className="h-12 w-12 mb-2 text-muted-foreground/60" />
                    <span className="text-sm">No changes in this entry</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Added section - only if items exist */}
                    {changes.added.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">
                          Added ({changes.added.length})
                        </h4>
                        <div className="space-y-1">
                          {changes.added.map((name, i) => (
                            <div
                              key={`added-${name}-${i}`}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded",
                                "border-l-2 border-green-500",
                                i % 2 === 0 ? "bg-green-500/10" : "bg-green-500/5"
                              )}
                            >
                              <Plus className="h-3.5 w-3.5 text-green-400" />
                              <span className="text-sm text-green-300">{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Removed section - only if items exist */}
                    {changes.removed.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">
                          Removed ({changes.removed.length})
                        </h4>
                        <div className="space-y-1">
                          {changes.removed.map((name, i) => (
                            <div
                              key={`removed-${name}-${i}`}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded",
                                "border-l-2 border-red-500",
                                i % 2 === 0 ? "bg-red-500/10" : "bg-red-500/5"
                              )}
                            >
                              <Minus className="h-3.5 w-3.5 text-red-400" />
                              <span className="text-sm text-red-300">{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Full history (col-span-3) */}
            <div className="col-span-3 flex flex-col min-h-0">
              <h4 className="text-sm font-medium text-foreground mb-2 flex-shrink-0">
                Full History
              </h4>

              {/* Filter UI */}
              <div className="flex items-center gap-2 mb-2 flex-shrink-0 flex-wrap">
                <HistoryFilterChips
                  activeFilter={activeFilter}
                  onFilterChange={(id, types) => {
                    setActiveFilter(id);
                    setFilterActionTypes(types);
                    // Reset entries and refetch (handled by useEffect)
                    setAllEntries([]);
                    setHasMore(true);
                  }}
                />
                {/* Date range picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 text-xs">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {dateRange?.from ? (
                        dateRange.to
                          ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
                          : format(dateRange.from, "MMM d")
                      ) : "Date range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range);
                        setAllEntries([]);
                        setHasMore(true);
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Scrollable entry list with day grouping */}
              <div className="flex-1 overflow-y-auto scrollbar-thin bg-muted rounded border border-border min-h-0">
                {loading && allEntries.length === 0 ? (
                  <div className="space-y-0">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="px-3 py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-12" />
                          <Skeleton className="h-3 flex-1" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : allEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                    <FileQuestion className="h-10 w-10 mb-2 text-muted-foreground/60" />
                    <span className="text-sm">No history entries found</span>
                  </div>
                ) : (
                  <>
                    {groupedEntries.map(([dayLabel, entries]) => (
                      <div key={dayLabel}>
                        {/* Sticky day header */}
                        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-1 text-xs text-muted-foreground font-medium border-b border-border z-10">
                          {dayLabel}
                        </div>
                        {entries.map((entry) => {
                          if (entry.type === "manual_edit") {
                            // Manual edit / export / flag entry with type badge
                            return (
                              <button
                                key={`edit-${entry.id}`}
                                onClick={() => handleEntryClick(entry)}
                                className={cn(
                                  "w-full text-left px-3 py-2 border-b border-border last:border-0",
                                  "hover:bg-accent transition-colors",
                                  isViewing(entry) && "bg-blue-500/20 ring-1 ring-blue-500/50"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge className={cn("text-xs", eventBadgeStyles[entry.action] || actionColors[entry.action])}>
                                    {eventLabels[entry.action] || entry.action}
                                  </Badge>
                                  <span className="text-foreground text-sm truncate flex-1">
                                    {entry.affected_count > 1
                                      ? entry.seller_name
                                      : entry.seller_name}
                                  </span>
                                  <span className="text-muted-foreground text-xs font-mono flex-shrink-0">
                                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                              </button>
                            );
                          } else {
                            // Collection run entry
                            return (
                              <button
                                key={`run-${entry.id}`}
                                onClick={() => handleEntryClick(entry)}
                                className={cn(
                                  "w-full text-left px-3 py-2 border-b border-border last:border-0",
                                  "hover:bg-accent transition-colors",
                                  isViewing(entry) && "bg-blue-500/20 ring-1 ring-blue-500/50"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Bot className="h-4 w-4 text-blue-400 flex-shrink-0" />
                                  <span className="text-foreground text-sm truncate flex-1">
                                    {entry.name}
                                  </span>
                                  <Badge className={cn("text-xs", statusStyles[entry.status])}>
                                    {entry.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  {entry.sellers_new > 0 && (
                                    <span className="text-green-400 text-xs">
                                      +{entry.sellers_new}
                                    </span>
                                  )}
                                  <span className="text-muted-foreground text-xs font-mono">
                                    {formatDistanceToNow(new Date(getEntryTime(entry)), { addSuffix: true })}
                                  </span>
                                </div>
                              </button>
                            );
                          }
                        })}
                      </div>
                    ))}
                    {/* Loading more spinner */}
                    {loadingMore && (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground ml-2">Loading more...</span>
                      </div>
                    )}
                    {/* Infinite scroll sentinel */}
                    {hasMore && <div ref={sentinelRef} className="h-8" />}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
