"use client";

import { useState, Fragment } from "react";
import { toast } from "sonner";
import { Check, X, RotateCcw, PackageX } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  api,
  displayValue,
  formatCents,
  normalizeForCompare,
  parseDollars,
  STATUS_LABELS,
  type BookkeepingRecord,
  type BookkeepingStatus,
  type UserRole,
} from "@/lib/api";
import { useUpdateRecord } from "@/hooks/mutations/use-update-record";
import { useDeleteRecord } from "@/hooks/mutations/use-delete-record";
import { usePendingMutations } from "@/hooks/sync/use-pending-mutations";
import { SyncRowBadge } from "@/components/sync/sync-row-badge";

const STATUS_OPTIONS: { value: BookkeepingStatus; label: string }[] = [
  { value: "SUCCESSFUL", label: "Successful" },
  { value: "RETURN_LABEL_PROVIDED", label: "Return Label" },
  { value: "RETURN_CLOSED", label: "Return Closed" },
  { value: "REFUND_NO_RETURN", label: "Refund" },
];

const STRIKE_CLASS = "line-through text-muted-foreground/70";

// Status icons for accessibility (aria-hidden, text label remains)
const STATUS_ICONS: Record<BookkeepingStatus, React.ReactNode> = {
  SUCCESSFUL: <Check className="w-4 h-4 mr-1 inline" aria-hidden="true" />,
  RETURN_LABEL_PROVIDED: <RotateCcw className="w-4 h-4 mr-1 inline" aria-hidden="true" />,
  RETURN_CLOSED: <X className="w-4 h-4 mr-1 inline" aria-hidden="true" />,
  REFUND_NO_RETURN: <PackageX className="w-4 h-4 mr-1 inline" aria-hidden="true" />,
};

// Field configuration for editing
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

interface RecordsTableProps {
  records: BookkeepingRecord[];
  userRole: UserRole;
  orgId: string;
  accountId: string;
  prefetchSentinelRef?: (node?: Element | null) => void;
}

export function RecordsTable({
  records,
  userRole,
  orgId,
  accountId,
  prefetchSentinelRef,
}: RecordsTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{
    id: string;
    status: BookkeepingStatus;
  } | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  // Mutation hooks
  const updateMutation = useUpdateRecord(orgId, accountId);
  const deleteMutation = useDeleteRecord(orgId, accountId);

  // Track pending mutations for row-level sync badges
  const pendingMutations = usePendingMutations('records');

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
    setError(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue("");
    setError(null);
  };

  const handleEditSave = async () => {
    if (!editingId || !editingField) return;

    const record = records.find((r) => r.id === editingId);
    if (!record) return;

    const config = FIELD_CONFIG[editingField];
    let convertedValue: unknown;
    const trimmedInput = editValue.trim();

    // Convert input value based on field type
    switch (config?.type) {
      case "cents":
        if (trimmedInput === "") {
          convertedValue = null;
        } else {
          const parsed = parseDollars(editValue);
          if (parsed === null) {
            toast.error("Invalid dollar amount");
            return; // Keep editing open
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
            return; // Keep editing open
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

    // Get original value and compare after normalizing
    const originalValue = record[editingField as keyof BookkeepingRecord];
    const normalizedNew = normalizeForCompare(convertedValue);
    const normalizedOld = normalizeForCompare(originalValue);

    // If no change, exit early (no API call)
    if (Object.is(normalizedNew, normalizedOld)) {
      handleEditCancel();
      return;
    }

    setSaving(true);

    try {
      // Handle remark updates separately (they use different endpoints)
      if (editingField === "order_remark") {
        await api.updateOrderRemark(editingId, convertedValue as string | null);
      } else if (editingField === "service_remark") {
        await api.updateServiceRemark(editingId, convertedValue as string | null);
      } else {
        // Use mutation for regular field updates
        await updateMutation.mutateAsync({
          id: editingId,
          data: { [editingField]: convertedValue },
        });
      }
      handleEditCancel();
    } catch (err) {
      // Only show toast for PATCH failures, no error banner
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (
    recordId: string,
    newStatus: BookkeepingStatus
  ) => {
    // Backend enforces permission via order_tracking.write.service_fields
    setPendingStatus({ id: recordId, status: newStatus });
    setSaving(true);
    setError(null);
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

  const getStatusBadgeVariant = (status: BookkeepingStatus) => {
    switch (status) {
      case "SUCCESSFUL":
        return "default";
      case "RETURN_LABEL_PROVIDED":
        return "secondary";
      case "RETURN_CLOSED":
      case "REFUND_NO_RETURN":
        return "destructive";
      default:
        return "default";
    }
  };

  const canEditField = (_field: string): boolean => {
    // Permission checks are enforced by the backend via permission_keys
    // Admins can edit everything, VAs can attempt edits (backend will reject if not allowed)
    return true;
  };

  const renderEditableCell = (
    record: BookkeepingRecord,
    field: string,
    displayValue: React.ReactNode,
    className?: string
  ) => {
    const config = FIELD_CONFIG[field];
    const isEditing = editingId === record.id && editingField === field;
    const canEdit = canEditField(field);

    // Special case: return_label_cost only editable when status is not REFUND_NO_RETURN
    if (field === "return_label_cost_cents" && record.status === "REFUND_NO_RETURN") {
      return <span className={className || "text-foreground"}>$0.00</span>;
    }

    if (isEditing) {
      return (
        <Input
          type={
            config?.type === "date"
              ? "date"
              : config?.type === "number"
                ? "number"
                : "text"
          }
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEditSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleEditSave();
            if (e.key === "Escape") handleEditCancel();
          }}
          className={`${config?.width || "w-24"} h-7 text-sm bg-muted border-border`}
          autoFocus
          disabled={saving}
          min={config?.type === "number" ? 1 : undefined}
        />
      );
    }

    if (!canEdit) {
      return <span className={className || "text-foreground"}>{displayValue}</span>;
    }

    return (
      <span
        className={`cursor-pointer hover:text-accent-foreground ${className || ""}`}
        onClick={() => handleEditStart(record.id, field)}
      >
        {displayValue}
      </span>
    );
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No records found for this account.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto scrollbar-thin">
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 text-red-200 px-4 py-2 text-sm">
          {error}
        </div>
      )}
      <Table aria-label="Order tracking records">
        <TableHeader>
          <TableRow className="border-border hover:bg-table-row-hover">
            <TableHead scope="col" className="text-muted-foreground w-8"><span className="sr-only">Expand</span></TableHead>
            <TableHead scope="col" className="text-muted-foreground font-mono">Date</TableHead>
            <TableHead scope="col" className="text-muted-foreground font-mono">eBay Order</TableHead>
            <TableHead scope="col" className="text-muted-foreground">Item</TableHead>
            <TableHead scope="col" className="text-muted-foreground text-center">Qty</TableHead>
            <TableHead scope="col" className="text-muted-foreground font-mono text-right">Earnings</TableHead>
            <TableHead scope="col" className="text-muted-foreground font-mono text-right">COGS</TableHead>
            <TableHead scope="col" className="text-muted-foreground font-mono text-right">Profit</TableHead>
            <TableHead scope="col" className="text-muted-foreground font-mono">Amazon Order</TableHead>
            <TableHead scope="col" className="text-muted-foreground">Status</TableHead>
            <TableHead scope="col" className="text-muted-foreground w-[50px]"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const isExpanded = expandedIds.has(record.id);
            const strikeAll = record.status === "RETURN_CLOSED";
            const strikeSalesFees = record.status === "REFUND_NO_RETURN";
            const displayProfit = strikeAll ? 0 : record.profit_cents;
            const canEditStatus = true; // Backend enforces via permission_keys
            const isDeleting = deleteMutation.isPending && recordToDelete === record.id;

            return (
              <Fragment key={record.id}>
                {/* Main Row */}
                <TableRow
                  className="border-border hover:bg-table-row-hover"
                >
                  {/* Expand Toggle + Sync Badge */}
                  <TableCell className="p-2">
                    <div className="flex items-center gap-1">
                      <SyncRowBadge mutation={pendingMutations.get(record.id)} />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground"
                        onClick={() => toggleExpanded(record.id)}
                        aria-label={isExpanded ? "Collapse row details" : "Expand row details"}
                        aria-expanded={isExpanded}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Button>
                    </div>
                  </TableCell>

                  {/* Date */}
                  <TableCell className="text-foreground">
                    {renderEditableCell(record, "sale_date", <span className="font-mono text-sm">{record.sale_date}</span>, "text-foreground")}
                  </TableCell>

                  {/* eBay Order */}
                  <TableCell>
                    {renderEditableCell(
                      record,
                      "ebay_order_id",
                      <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">{record.ebay_order_id}</span>,
                      "text-foreground"
                    )}
                  </TableCell>

                  {/* Item */}
                  <TableCell className="max-w-[200px]">
                    {renderEditableCell(
                      record,
                      "item_name",
                      <span className="truncate block" title={record.item_name}>
                        {record.item_name}
                      </span>,
                      "text-foreground"
                    )}
                  </TableCell>

                  {/* Qty */}
                  <TableCell className="text-center">
                    {renderEditableCell(record, "qty", <span className="font-mono text-sm">{record.qty}</span>, "text-foreground")}
                  </TableCell>

                  {/* Earnings (Net) */}
                  <TableCell className="text-right">
                    {(strikeSalesFees || strikeAll) ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={STRIKE_CLASS}>
                            <span className="font-mono text-sm">{formatCents(record.earnings_net_cents)}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {record.status === "RETURN_CLOSED"
                            ? "Return closed - excluded from totals"
                            : "Refunded - excluded from totals"}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-foreground font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">{formatCents(record.earnings_net_cents)}</span>
                    )}
                  </TableCell>

                  {/* COGS Total */}
                  <TableCell
                    className={`text-right ${strikeAll ? STRIKE_CLASS : "text-foreground"}`}
                  >
                    <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">{formatCents(record.cogs_total_cents)}</span>
                  </TableCell>

                  {/* Profit */}
                  <TableCell
                    className={`text-right font-semibold ${
                      strikeAll
                        ? STRIKE_CLASS
                        : displayProfit >= 0
                          ? "text-green-400"
                          : "text-red-400"
                    }`}
                  >
                    <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">{formatCents(displayProfit)}</span>
                  </TableCell>

                  {/* Amazon Order */}
                  <TableCell>
                    {renderEditableCell(
                      record,
                      "amazon_order_id",
                      <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">{displayValue(record.amazon_order_id)}</span>,
                      "text-foreground"
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {canEditStatus ? (
                      (() => {
                        const isPending = pendingStatus?.id === record.id;
                        const displayStatus = isPending
                          ? pendingStatus.status
                          : record.status;
                        return (
                          <Select
                            value={displayStatus}
                            onValueChange={(value) =>
                              handleStatusChange(record.id, value as BookkeepingStatus)
                            }
                            disabled={isPending || updateMutation.isPending}
                          >
                            <SelectTrigger className="min-w-[192px] h-7 text-xs bg-muted border-border" aria-label="Order status">
                              <SelectValue>
                                <Badge
                                  variant={getStatusBadgeVariant(displayStatus)}
                                  className="pointer-events-none"
                                >
                                  {STATUS_ICONS[displayStatus]}
                                  {STATUS_LABELS[displayStatus]}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              {STATUS_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-popover-foreground hover:bg-accent"
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()
                    ) : (
                      <Badge variant={getStatusBadgeVariant(record.status)}>
                        {STATUS_ICONS[record.status]}
                        {STATUS_LABELS[record.status]}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Delete Button (admins only) */}
                  <TableCell>
                    {userRole.isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-900/20"
                        onClick={() => handleDeleteClick(record.id)}
                        disabled={saving || isDeleting}
                        title="Delete record"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>

                {/* Expanded Details Row */}
                {isExpanded && (
                  <TableRow key={`${record.id}-details`} className="bg-muted/50">
                    <TableCell colSpan={11} className="p-4">
                      {/* Quantity info */}
                      <div className="mb-4 text-sm">
                        <span className="text-muted-foreground">Quantity: </span>
                        <span className="text-foreground font-medium font-mono">{record.qty}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Earnings Breakdown */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground mb-3">
                            Earnings Breakdown
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Sale Price:</span>
                              <span
                                className={strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-foreground"}
                              >
                                {renderEditableCell(
                                  record,
                                  "sale_price_cents",
                                  <span className="font-mono">{formatCents(record.sale_price_cents)}</span>,
                                  strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-foreground"
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">eBay Fees:</span>
                              <span
                                className={strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-foreground"}
                              >
                                {renderEditableCell(
                                  record,
                                  "ebay_fees_cents",
                                  <span className="font-mono">{`-${formatCents(record.ebay_fees_cents)}`}</span>,
                                  strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-foreground"
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-border pt-1">
                              <span className="text-foreground/80 font-medium">Earnings (Net):</span>
                              <span
                                className={`font-medium ${strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-foreground"}`}
                              >
                                <span className="font-mono">{formatCents(record.earnings_net_cents)}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* COGS Breakdown */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground mb-3">
                            COGS Breakdown
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Amazon Price:</span>
                              <span className={strikeAll ? STRIKE_CLASS : "text-foreground"}>
                                {renderEditableCell(
                                  record,
                                  "amazon_price_cents",
                                  <span className="font-mono">{formatCents(record.amazon_price_cents)}</span>,
                                  strikeAll ? STRIKE_CLASS : "text-foreground"
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Amazon Tax:</span>
                              <span className={strikeAll ? STRIKE_CLASS : "text-foreground"}>
                                {renderEditableCell(
                                  record,
                                  "amazon_tax_cents",
                                  <span className="font-mono">{formatCents(record.amazon_tax_cents ?? 0)}</span>,
                                  strikeAll ? STRIKE_CLASS : "text-foreground"
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Amazon Shipping:</span>
                              <span className={strikeAll ? STRIKE_CLASS : "text-foreground"}>
                                {renderEditableCell(
                                  record,
                                  "amazon_shipping_cents",
                                  <span className="font-mono">{formatCents(record.amazon_shipping_cents)}</span>,
                                  strikeAll ? STRIKE_CLASS : "text-foreground"
                                )}
                              </span>
                            </div>
                            {record.status !== "SUCCESSFUL" && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Return Label Cost:</span>
                                <span className={strikeAll ? STRIKE_CLASS : "text-foreground"}>
                                  {renderEditableCell(
                                    record,
                                    "return_label_cost_cents",
                                    <span className="font-mono">{formatCents(record.return_label_cost_cents)}</span>,
                                    strikeAll ? STRIKE_CLASS : "text-foreground"
                                  )}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-border pt-1">
                              <span className="text-foreground/80 font-medium">COGS (Total):</span>
                              <span
                                className={`font-medium ${strikeAll ? STRIKE_CLASS : "text-foreground"}`}
                              >
                                <span className="font-mono">{formatCents(record.cogs_total_cents)}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Remarks */}
                        <div className="space-y-3 text-sm">
                          {/* Order Remark - visibility controlled by backend permission_keys */}
                            <div>
                              <span className="text-muted-foreground block mb-1">Order Remark:</span>
                              {renderEditableCell(
                                record,
                                "order_remark",
                                record.order_remark || <span className="text-muted-foreground/70 italic">No remarks</span>,
                                "text-foreground/80 text-sm block"
                              )}
                            </div>

                            {/* Service Remark - visibility controlled by backend permission_keys */}
                            <div>
                              <span className="text-muted-foreground block mb-1">Service Remark:</span>
                              {renderEditableCell(
                                record,
                                "service_remark",
                                record.service_remark || <span className="text-muted-foreground/70 italic">No remarks</span>,
                                "text-foreground/80 text-sm block"
                              )}
                            </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      {/* Prefetch sentinel - triggers sync when scrolled into view */}
      {prefetchSentinelRef && (
        <div
          ref={prefetchSentinelRef}
          style={{ height: 1 }}
          aria-hidden="true"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
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
