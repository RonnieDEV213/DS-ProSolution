"use client";

import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { List, type ListImperativeAPI } from "react-window";
import { useInfiniteLoader } from "react-window-infinite-loader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  api,
  STATUS_LABELS,
  normalizeForCompare,
  parseDollars,
  type BookkeepingRecord,
  type BookkeepingStatus,
  type UserRole,
} from "@/lib/api";
import { useUpdateRecord } from "@/hooks/mutations/use-update-record";
import { useDeleteRecord } from "@/hooks/mutations/use-delete-record";
import { usePendingMutations } from "@/hooks/sync/use-pending-mutations";
import type { RowDensity } from "@/hooks/use-row-density";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { RecordRow } from "@/components/bookkeeping/record-row";
import { SkeletonRow } from "@/components/bookkeeping/skeleton-row";
import { ResultSummary } from "@/components/bookkeeping/result-summary";

type FieldType = "text" | "date" | "number" | "cents";

const FIELD_CONFIG: Record<string, { type: FieldType; width: string }> = {
  sale_date: { type: "date", width: "w-32" },
  ebay_order_id: { type: "text", width: "w-32" },
  item_name: { type: "text", width: "w-48" },
  qty: { type: "number", width: "w-16" },
  sale_price_cents: { type: "cents", width: "w-24" },
  ebay_fees_cents: { type: "cents", width: "w-24" },
  amazon_price_cents: { type: "cents", width: "w-24" },
  amazon_tax_cents: { type: "cents", width: "w-24" },
  amazon_shipping_cents: { type: "cents", width: "w-24" },
  return_label_cost_cents: { type: "cents", width: "w-24" },
  amazon_order_id: { type: "text", width: "w-32" },
  order_remark: { type: "text", width: "w-full" },
  service_remark: { type: "text", width: "w-full" },
};

type VirtualRow = {
  type: "record" | "expanded";
  record: BookkeepingRecord;
  recordIndex: number;
};


interface VirtualizedRecordsListProps {
  records: BookkeepingRecord[];
  userRole: UserRole;
  orgId: string;
  accountId: string;
  height: number;
  density: RowDensity;
  rowHeight: number;
  isFiltered: boolean;
  hasMore: boolean;
  totalCount: number;
  loadMore: () => Promise<void> | void;
  isLoading: boolean;
  listRef?: RefObject<ListImperativeAPI | null>;
  prefetchSentinelRef?: (node?: Element | null) => void;
}

const flattenRecords = (
  records: BookkeepingRecord[],
  expandedIds: Set<string>
): VirtualRow[] => {
  const rows: VirtualRow[] = [];
  records.forEach((record, index) => {
    rows.push({ type: "record", record, recordIndex: index });
    if (expandedIds.has(record.id)) {
      rows.push({ type: "expanded", record, recordIndex: index });
    }
  });
  return rows;
};

export function VirtualizedRecordsList({
  records,
  userRole,
  orgId,
  accountId,
  height,
  density,
  rowHeight,
  isFiltered,
  hasMore,
  totalCount,
  loadMore,
  isLoading,
  listRef: listRefProp,
  prefetchSentinelRef,
}: VirtualizedRecordsListProps) {
  const internalListRef = useRef<ListImperativeAPI | null>(null);
  const listRef = listRefProp ?? internalListRef;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<{
    id: string;
    status: BookkeepingStatus;
  } | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [visibleStopIndex, setVisibleStopIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const updateMutation = useUpdateRecord(orgId, accountId);
  const deleteMutation = useDeleteRecord(orgId, accountId);
  const pendingMutations = usePendingMutations("records");

  useScrollRestoration(listRef, accountId);

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const getDisplayValue = (record: BookkeepingRecord, field: string): string => {
    const value = record[field as keyof BookkeepingRecord];
    const config = FIELD_CONFIG[field];

    if (config?.type === "cents") {
      return value != null ? ((value as number) / 100).toFixed(2) : "";
    }
    return value?.toString() ?? "";
  };

  const handleEditStart = (recordId: string, field: string) => {
    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    setEditingId(recordId);
    setEditingField(field);
    setEditValue(getDisplayValue(record, field));
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue("");
  };

  const handleEditSave = async () => {
    if (!editingId || !editingField) return;

    const record = records.find((r) => r.id === editingId);
    if (!record) return;

    const config = FIELD_CONFIG[editingField];
    let convertedValue: unknown;
    const trimmedInput = editValue.trim();

    switch (config?.type) {
      case "cents":
        if (trimmedInput === "") {
          convertedValue = null;
        } else {
          const parsed = parseDollars(editValue);
          if (parsed === null) {
            toast.error("Invalid dollar amount");
            return;
          }
          convertedValue = parsed;
        }
        break;
      case "number":
        if (trimmedInput === "") {
          convertedValue = null;
        } else {
          const parsed = parseInt(trimmedInput, 10);
          if (isNaN(parsed)) {
            toast.error("Invalid number");
            return;
          }
          convertedValue = parsed;
        }
        break;
      case "date":
        convertedValue = trimmedInput === "" ? null : trimmedInput;
        break;
      default:
        convertedValue = trimmedInput === "" ? null : trimmedInput;
    }

    const originalValue = record[editingField as keyof BookkeepingRecord];
    const normalizedNew = normalizeForCompare(convertedValue);
    const normalizedOld = normalizeForCompare(originalValue);

    if (Object.is(normalizedNew, normalizedOld)) {
      handleEditCancel();
      return;
    }

    setSaving(true);

    try {
      if (editingField === "order_remark") {
        await api.updateOrderRemark(editingId, convertedValue as string | null);
      } else if (editingField === "service_remark") {
        await api.updateServiceRemark(editingId, convertedValue as string | null);
      } else {
        await updateMutation.mutateAsync({
          id: editingId,
          data: { [editingField]: convertedValue },
        });
      }
      handleEditCancel();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (
    recordId: string,
    newStatus: BookkeepingStatus
  ) => {
    setPendingStatus({ id: recordId, status: newStatus });
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: recordId,
        data: { status: newStatus },
      });
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
      setPendingStatus(null);
    }
  };

  const handleDeleteClick = (recordId: string) => {
    setRecordToDelete(recordId);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteMutation.mutateAsync(recordToDelete);
      toast.success("Record deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setRecordToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setRecordToDelete(null);
  };

  const virtualRows = useMemo(
    () => flattenRecords(records, expandedIds),
    [records, expandedIds]
  );

  const handleSelect = useCallback(
    (index: number) => {
      const row = virtualRows[index];
      if (!row) return;
      toggleExpanded(row.record.id);
    },
    [virtualRows, toggleExpanded]
  );

  const { focusedIndex, setFocusedIndex } = useKeyboardNavigation(
    listRef,
    virtualRows.length,
    handleSelect,
    containerRef
  );

  const itemCount = hasMore ? virtualRows.length + 1 : virtualRows.length;
  const loadMoreRows = useCallback(
    async (_startIndex: number, _stopIndex: number) => {
      if (isLoading || isLoadingMore || !hasMore) return;
      setIsLoadingMore(true);
      try {
        await Promise.resolve(loadMore());
      } finally {
        setIsLoadingMore(false);
      }
    },
    [hasMore, isLoading, isLoadingMore, loadMore]
  );

  const onRowsRendered = useInfiniteLoader({
    isRowLoaded: (index) => !hasMore || index < virtualRows.length,
    loadMoreRows,
    rowCount: itemCount,
    minimumBatchSize: 50,
    threshold: 15,
  });

  const handleRowsRendered = useCallback(
    (
      visibleRows: { startIndex: number; stopIndex: number },
      _allRows: { startIndex: number; stopIndex: number }
    ) => {
      onRowsRendered(visibleRows);
      setVisibleStartIndex(visibleRows.startIndex);
      setVisibleStopIndex(visibleRows.stopIndex);
    },
    [onRowsRendered]
  );

  const getRowHeight = useCallback(
    (index: number) => {
      const row = virtualRows[index];
      if (!row) return rowHeight;
      return row.type === "expanded" ? 180 : rowHeight;
    },
    [virtualRows, rowHeight]
  );

  const totalRecords = totalCount || records.length;
  const startRecordIndex = virtualRows[visibleStartIndex]?.recordIndex ?? 0;
  const endRecordIndex = virtualRows[visibleStopIndex]?.recordIndex ?? startRecordIndex;
  const summaryStart = totalRecords > 0 ? Math.min(startRecordIndex, totalRecords - 1) : 0;
  const summaryEnd = totalRecords > 0 ? Math.min(endRecordIndex + 1, totalRecords) : 0;

  if (isLoading) {
    return (
      <div className="rounded-md border border-gray-800 overflow-hidden">
        {Array.from({ length: 10 }).map((_, index) => (
          <SkeletonRow
            key={index}
            style={{ height: rowHeight, width: "100%" }}
            density={density}
          />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No records found for this account.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <ResultSummary
          visibleStart={summaryStart}
          visibleEnd={summaryEnd}
          total={totalRecords}
          isFiltered={isFiltered}
        />
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={containerRef}
            tabIndex={0}
            className="rounded-md border border-gray-800 overflow-hidden focus:outline-none"
            aria-label="Records list"
            onFocus={() => setFocusedIndex((prev) => (prev < 0 ? 0 : prev))}
          >
            <div className="flex items-center border-b border-gray-800 bg-gray-900/60 text-gray-400 text-xs uppercase tracking-wide px-2 py-2">
              <div className="w-10 shrink-0">
                <span className="sr-only">Expand</span>
              </div>
              <div className="w-32 shrink-0">Date</div>
              <div className="w-32 shrink-0">eBay Order</div>
              <div className="w-48 shrink-0">Item</div>
              <div className="w-16 shrink-0 text-center">Qty</div>
              <div className="w-24 shrink-0 text-right">Earnings</div>
              <div className="w-24 shrink-0 text-right">COGS</div>
              <div className="w-24 shrink-0 text-right">Profit</div>
              <div className="w-32 shrink-0">Amazon Order</div>
              <div className="w-40 shrink-0">Status</div>
              <div className="w-12 shrink-0">
                <span className="sr-only">Actions</span>
              </div>
            </div>

            <List
              listRef={listRef}
              rowCount={itemCount}
              rowHeight={getRowHeight}
              rowComponent={RecordRow}
              rowProps={{
                records: virtualRows,
                expandedIds,
                onToggleExpand: toggleExpanded,
                density,
                rowHeight,
                isLoadingMore,
                userRole,
                orgId,
                accountId,
                editingState: {
                  id: editingId,
                  field: editingField,
                  value: editValue,
                  saving,
                },
                onEditStart: handleEditStart,
                onEditSave: handleEditSave,
                onEditCancel: handleEditCancel,
                onEditValueChange: setEditValue,
                pendingMutations,
                pendingStatus,
                isUpdating: updateMutation.isPending || saving,
                deleteState: {
                  id: recordToDelete,
                  isPending: deleteMutation.isPending,
                },
                onStatusChange: handleStatusChange,
                onDeleteClick: handleDeleteClick,
                focusedIndex,
              }}
              defaultHeight={height}
              overscanCount={5}
              style={{ width: "100%", height }}
              onRowsRendered={handleRowsRendered}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          Press j/k to navigate, Enter to expand, ? for help
        </TooltipContent>
      </Tooltip>

      {prefetchSentinelRef && (
        <div ref={prefetchSentinelRef} style={{ height: 1 }} aria-hidden="true" />
      )}

      <AlertDialog
        open={!!recordToDelete}
        onOpenChange={(open) => !open && handleCancelDelete()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
