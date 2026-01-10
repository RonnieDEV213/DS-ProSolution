"use client";

import { useState } from "react";
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
  formatCents,
  parseDollars,
  type BookkeepingRecord,
  type BookkeepingStatus,
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
  sale_price_cents: { type: "cents", width: "w-20" },
  ebay_fees_cents: { type: "cents", width: "w-20" },
  cogs_cents: { type: "cents", width: "w-20" },
  tax_paid_cents: { type: "cents", width: "w-20" },
  return_label_cost_cents: { type: "cents", width: "w-20" },
  amazon_order_id: { type: "text", width: "w-32" },
  remarks: { type: "text", width: "w-40" },
};

interface RecordsTableProps {
  records: BookkeepingRecord[];
  onRecordUpdated: (record: BookkeepingRecord) => void;
  onRecordDeleted: (recordId: string) => void;
}

export function RecordsTable({ records, onRecordUpdated, onRecordDeleted }: RecordsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{id: string, status: BookkeepingStatus} | null>(null);

  const getDisplayValue = (
    record: BookkeepingRecord,
    field: string
  ): string => {
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

    setSaving(true);
    setError(null);

    try {
      const config = FIELD_CONFIG[editingField];
      let convertedValue: unknown;

      switch (config?.type) {
        case "cents":
          convertedValue = parseDollars(editValue);
          break;
        case "number":
          convertedValue = parseInt(editValue) || null;
          break;
        case "date":
          convertedValue = editValue || null;
          break;
        default:
          convertedValue = editValue || null;
      }

      const updated = await api.updateRecord(editingId, {
        [editingField]: convertedValue,
      });
      onRecordUpdated(updated);
      handleEditCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
    setError(null);
    try {
      const updated = await api.updateRecord(recordId, { status: newStatus });
      onRecordUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
      setPendingStatus(null);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;

    setSaving(true);
    setError(null);
    try {
      await api.deleteRecord(recordId);
      onRecordDeleted(recordId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete record");
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

  const renderEditableCell = (
    record: BookkeepingRecord,
    field: string,
    displayValue: React.ReactNode,
    className?: string
  ) => {
    const config = FIELD_CONFIG[field];
    const isEditing = editingId === record.id && editingField === field;

    if (isEditing) {
      return (
        <Input
          type={config?.type === "date" ? "date" : config?.type === "number" ? "number" : "text"}
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

    return (
      <span
        className={`cursor-pointer hover:text-blue-400 ${className || ""}`}
        onClick={() => handleEditStart(record.id, field)}
      >
        {displayValue}
      </span>
    );
  };

  const renderCentsCell = (
    record: BookkeepingRecord,
    field: string,
    strikeClass: string
  ) => {
    const value = record[field as keyof BookkeepingRecord] as number | null;
    const displayValue = formatCents(value);

    // Special case: return_label_cost only editable when RETURN_LABEL_PROVIDED
    if (field === "return_label_cost_cents" && record.status !== "RETURN_LABEL_PROVIDED") {
      return (
        <span className={strikeClass || "text-white"}>
          {displayValue}
        </span>
      );
    }

    return renderEditableCell(
      record,
      field,
      displayValue,
      strikeClass || "text-white"
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
            <TableHead className="text-gray-400">Date</TableHead>
            <TableHead className="text-gray-400">eBay Order</TableHead>
            <TableHead className="text-gray-400">Item</TableHead>
            <TableHead className="text-gray-400 text-center">Qty</TableHead>
            <TableHead className="text-gray-400 text-right">Sale</TableHead>
            <TableHead className="text-gray-400 text-right">Fees</TableHead>
            <TableHead className="text-gray-400 text-right">COGS</TableHead>
            <TableHead className="text-gray-400 text-right">Tax</TableHead>
            <TableHead className="text-gray-400 text-right">Return Label</TableHead>
            <TableHead className="text-gray-400 text-right">Profit</TableHead>
            <TableHead className="text-gray-400">Amazon Order</TableHead>
            <TableHead className="text-gray-400">Status</TableHead>
            <TableHead className="text-gray-400">Remarks</TableHead>
            <TableHead className="text-gray-400 w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const strikeAll = record.status === "RETURN_CLOSED";
            const strikeSalesFees = record.status === "REFUND_NO_RETURN";
            const strikeClassAll = strikeAll ? STRIKE_CLASS : "";
            const strikeClassSalesFees = strikeAll || strikeSalesFees ? STRIKE_CLASS : "";
            const displayProfit = strikeAll ? 0 : record.profit_cents;

            return (
              <TableRow
                key={record.id}
                className="border-gray-800 hover:bg-gray-900"
              >
                {/* Sale Date - Editable */}
                <TableCell className="text-white">
                  {renderEditableCell(
                    record,
                    "sale_date",
                    record.sale_date,
                    "text-white"
                  )}
                </TableCell>

                {/* eBay Order ID - Editable */}
                <TableCell>
                  {renderEditableCell(
                    record,
                    "ebay_order_id",
                    record.ebay_order_id,
                    "text-white font-mono text-sm"
                  )}
                </TableCell>

                {/* Item Name - Editable */}
                <TableCell className="max-w-[200px]">
                  {renderEditableCell(
                    record,
                    "item_name",
                    <span className="truncate block" title={record.item_name}>{record.item_name}</span>,
                    "text-white"
                  )}
                </TableCell>

                {/* Qty - Editable */}
                <TableCell className="text-center">
                  {renderEditableCell(
                    record,
                    "qty",
                    record.qty,
                    "text-white"
                  )}
                </TableCell>

                {/* Sale Price - Editable */}
                <TableCell className="text-right">
                  {renderCentsCell(record, "sale_price_cents", strikeClassSalesFees)}
                </TableCell>

                {/* eBay Fees - Editable */}
                <TableCell className="text-right">
                  {renderCentsCell(record, "ebay_fees_cents", strikeClassSalesFees)}
                </TableCell>

                {/* COGS - Editable */}
                <TableCell className="text-right">
                  {renderCentsCell(record, "cogs_cents", strikeClassAll)}
                </TableCell>

                {/* Tax Paid - Editable */}
                <TableCell className="text-right">
                  {renderCentsCell(record, "tax_paid_cents", strikeClassAll)}
                </TableCell>

                {/* Return Label - Editable only when RETURN_LABEL_PROVIDED */}
                <TableCell className="text-right">
                  {renderCentsCell(record, "return_label_cost_cents", strikeClassAll)}
                </TableCell>

                {/* Profit - NOT Editable (computed) */}
                <TableCell
                  className={`text-right font-semibold ${
                    strikeAll
                      ? strikeClassAll
                      : displayProfit >= 0
                        ? "text-green-400"
                        : "text-red-400"
                  }`}
                >
                  {formatCents(displayProfit)}
                </TableCell>

                {/* Amazon Order ID - Editable */}
                <TableCell>
                  {renderEditableCell(
                    record,
                    "amazon_order_id",
                    record.amazon_order_id || "-",
                    "text-white font-mono text-sm"
                  )}
                </TableCell>

                {/* Status - Dropdown */}
                <TableCell>
                  {(() => {
                    const isPending = pendingStatus?.id === record.id;
                    const displayStatus = isPending ? pendingStatus.status : record.status;
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
                              {STATUS_OPTIONS.find((s) => s.value === displayStatus)
                                ?.label || displayStatus}
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
                  })()}
                </TableCell>

                {/* Remarks - Editable */}
                <TableCell>
                  {renderEditableCell(
                    record,
                    "remarks",
                    record.remarks || "-",
                    "text-gray-300 text-sm"
                  )}
                </TableCell>

                {/* Delete Button */}
                <TableCell>
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        </Table>
    </div>
  );
}
