"use client";

import { useState, Fragment } from "react";
import { toast } from "sonner";
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

const STATUS_OPTIONS: { value: BookkeepingStatus; label: string }[] = [
  { value: "SUCCESSFUL", label: "Successful" },
  { value: "RETURN_LABEL_PROVIDED", label: "Return Label" },
  { value: "RETURN_CLOSED", label: "Return Closed" },
  { value: "REFUND_NO_RETURN", label: "Refund (No Return)" },
];

const STRIKE_CLASS = "line-through text-gray-500";

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
  onRecordUpdated: (record: BookkeepingRecord) => void;
  onRecordDeleted: (recordId: string) => void;
  userRole: UserRole;
}

export function RecordsTable({
  records,
  onRecordUpdated,
  onRecordDeleted,
  userRole,
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
      // Handle remark updates separately
      if (editingField === "order_remark") {
        await api.updateOrderRemark(editingId, convertedValue as string | null);
        onRecordUpdated({
          ...record,
          order_remark: convertedValue as string | null,
        });
      } else if (editingField === "service_remark") {
        await api.updateServiceRemark(editingId, convertedValue as string | null);
        onRecordUpdated({
          ...record,
          service_remark: convertedValue as string | null,
        });
      } else {
        const updated = await api.updateRecord(editingId, {
          [editingField]: convertedValue,
        });
        onRecordUpdated(updated);
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
    // Check if user can edit status
    if (!userRole.isAdmin && !userRole.isServiceDept) {
      toast.error("Only service department can change status");
      return;
    }

    setPendingStatus({ id: recordId, status: newStatus });
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateRecord(recordId, { status: newStatus });
      onRecordUpdated(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
      setPendingStatus(null);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;

    setSaving(true);
    try {
      await api.deleteRecord(recordId);
      onRecordDeleted(recordId);
      toast.success("Record deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
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

  const canEditField = (field: string): boolean => {
    if (userRole.isAdmin) return true;

    const serviceFields = ["status", "return_label_cost_cents", "service_remark"];
    const orderFields = [
      "ebay_order_id",
      "sale_date",
      "item_name",
      "qty",
      "sale_price_cents",
      "ebay_fees_cents",
      "amazon_price_cents",
      "amazon_tax_cents",
      "amazon_shipping_cents",
      "amazon_order_id",
      "order_remark",
    ];

    if (userRole.isServiceDept) {
      return serviceFields.includes(field);
    }
    if (userRole.isOrderDept) {
      return orderFields.includes(field);
    }
    // General/listing dept can edit order fields but not service fields
    return orderFields.includes(field) && field !== "order_remark";
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
      return <span className={className || "text-white"}>$0.00</span>;
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
          className={`${config?.width || "w-24"} h-7 text-sm bg-gray-800 border-gray-700`}
          autoFocus
          disabled={saving}
          min={config?.type === "number" ? 1 : undefined}
        />
      );
    }

    if (!canEdit) {
      return <span className={className || "text-white"}>{displayValue}</span>;
    }

    return (
      <span
        className={`cursor-pointer hover:text-blue-400 ${className || ""}`}
        onClick={() => handleEditStart(record.id, field)}
      >
        {displayValue}
      </span>
    );
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No records found for this account.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-800 overflow-x-auto">
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 text-red-200 px-4 py-2 text-sm">
          {error}
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="border-gray-800 hover:bg-gray-900">
            <TableHead className="text-gray-400 w-8"></TableHead>
            <TableHead className="text-gray-400">Date</TableHead>
            <TableHead className="text-gray-400">eBay Order</TableHead>
            <TableHead className="text-gray-400">Item</TableHead>
            <TableHead className="text-gray-400 text-center">Qty</TableHead>
            <TableHead className="text-gray-400 text-right">Earnings</TableHead>
            <TableHead className="text-gray-400 text-right">COGS</TableHead>
            <TableHead className="text-gray-400 text-right">Profit</TableHead>
            <TableHead className="text-gray-400">Amazon Order</TableHead>
            <TableHead className="text-gray-400">Status</TableHead>
            <TableHead className="text-gray-400 w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const isExpanded = expandedIds.has(record.id);
            const strikeAll = record.status === "RETURN_CLOSED";
            const strikeSalesFees = record.status === "REFUND_NO_RETURN";
            const displayProfit = strikeAll ? 0 : record.profit_cents;
            const canEditStatus = userRole.isAdmin || userRole.isServiceDept;

            return (
              <Fragment key={record.id}>
                {/* Main Row */}
                <TableRow
                  className="border-gray-800 hover:bg-gray-900"
                >
                  {/* Expand Toggle */}
                  <TableCell className="p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-gray-400"
                      onClick={() => toggleExpanded(record.id)}
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
                  </TableCell>

                  {/* Date */}
                  <TableCell className="text-white">
                    {renderEditableCell(record, "sale_date", record.sale_date, "text-white")}
                  </TableCell>

                  {/* eBay Order */}
                  <TableCell>
                    {renderEditableCell(
                      record,
                      "ebay_order_id",
                      record.ebay_order_id,
                      "text-white font-mono text-sm"
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
                      "text-white"
                    )}
                  </TableCell>

                  {/* Qty */}
                  <TableCell className="text-center">
                    {renderEditableCell(record, "qty", record.qty, "text-white")}
                  </TableCell>

                  {/* Earnings (Net) */}
                  <TableCell
                    className={`text-right ${strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"}`}
                  >
                    {formatCents(record.earnings_net_cents)}
                  </TableCell>

                  {/* COGS Total */}
                  <TableCell
                    className={`text-right ${strikeAll ? STRIKE_CLASS : "text-white"}`}
                  >
                    {formatCents(record.cogs_total_cents)}
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
                    {formatCents(displayProfit)}
                  </TableCell>

                  {/* Amazon Order */}
                  <TableCell>
                    {renderEditableCell(
                      record,
                      "amazon_order_id",
                      displayValue(record.amazon_order_id),
                      "text-white font-mono text-sm"
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
                            disabled={isPending}
                          >
                            <SelectTrigger className="w-[140px] h-7 text-xs bg-gray-800 border-gray-700">
                              <SelectValue>
                                <Badge
                                  variant={getStatusBadgeVariant(displayStatus)}
                                  className="pointer-events-none"
                                >
                                  {STATUS_LABELS[displayStatus]}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              {STATUS_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-white hover:bg-gray-700"
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
                        {STATUS_LABELS[record.status]}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Delete Button */}
                  <TableCell>
                    {userRole.isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-400 hover:bg-red-900/20"
                        onClick={() => handleDelete(record.id)}
                        disabled={saving}
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
                  <TableRow key={`${record.id}-details`} className="bg-gray-900/50">
                    <TableCell colSpan={11} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Earnings Breakdown */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-400 mb-3">
                            Earnings Breakdown
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Sale Price:</span>
                              <span
                                className={strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"}
                              >
                                {renderEditableCell(
                                  record,
                                  "sale_price_cents",
                                  formatCents(record.sale_price_cents),
                                  strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">eBay Fees:</span>
                              <span
                                className={strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"}
                              >
                                {renderEditableCell(
                                  record,
                                  "ebay_fees_cents",
                                  `-${formatCents(record.ebay_fees_cents)}`,
                                  strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-gray-700 pt-1">
                              <span className="text-gray-300 font-medium">Earnings (Net):</span>
                              <span
                                className={`font-medium ${strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"}`}
                              >
                                {formatCents(record.earnings_net_cents)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* COGS Breakdown */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-400 mb-3">
                            COGS Breakdown
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Amazon Price:</span>
                              <span className={strikeAll ? STRIKE_CLASS : "text-white"}>
                                {renderEditableCell(
                                  record,
                                  "amazon_price_cents",
                                  formatCents(record.amazon_price_cents),
                                  strikeAll ? STRIKE_CLASS : "text-white"
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Amazon Tax:</span>
                              <span className={strikeAll ? STRIKE_CLASS : "text-white"}>
                                {renderEditableCell(
                                  record,
                                  "amazon_tax_cents",
                                  formatCents(record.amazon_tax_cents),
                                  strikeAll ? STRIKE_CLASS : "text-white"
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Amazon Shipping:</span>
                              <span className={strikeAll ? STRIKE_CLASS : "text-white"}>
                                {renderEditableCell(
                                  record,
                                  "amazon_shipping_cents",
                                  formatCents(record.amazon_shipping_cents),
                                  strikeAll ? STRIKE_CLASS : "text-white"
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-gray-700 pt-1">
                              <span className="text-gray-300 font-medium">COGS (Total):</span>
                              <span
                                className={`font-medium ${strikeAll ? STRIKE_CLASS : "text-white"}`}
                              >
                                {formatCents(record.cogs_total_cents)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Returns / Service */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-400 mb-3">
                            Returns / Service
                          </h4>
                          <div className="space-y-3 text-sm">
                            {/* Return Label Cost - only show when not REFUND_NO_RETURN */}
                            {record.status !== "REFUND_NO_RETURN" && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Return Label Cost:</span>
                                <span className={strikeAll ? STRIKE_CLASS : "text-white"}>
                                  {renderEditableCell(
                                    record,
                                    "return_label_cost_cents",
                                    formatCents(record.return_label_cost_cents),
                                    strikeAll ? STRIKE_CLASS : "text-white"
                                  )}
                                </span>
                              </div>
                            )}

                            {/* Order Remark - only show if user has access */}
                            {userRole.canAccessOrderRemark && (
                              <div>
                                <span className="text-gray-400 block mb-1">Order Remark:</span>
                                {renderEditableCell(
                                  record,
                                  "order_remark",
                                  record.order_remark || "(none)",
                                  "text-gray-300 text-sm block"
                                )}
                              </div>
                            )}

                            {/* Service Remark - only show if user has access */}
                            {userRole.canAccessServiceRemark && (
                              <div>
                                <span className="text-gray-400 block mb-1">Service Remark:</span>
                                {renderEditableCell(
                                  record,
                                  "service_remark",
                                  record.service_remark || "(none)",
                                  "text-gray-300 text-sm block"
                                )}
                              </div>
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
    </div>
  );
}
