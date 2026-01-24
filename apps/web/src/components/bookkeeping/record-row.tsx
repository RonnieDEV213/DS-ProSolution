"use client";

import type { RowComponentProps } from "react-window";
import { Check, X, RotateCcw, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SyncRowBadge } from "@/components/sync/sync-row-badge";
import {
  displayValue,
  formatCents,
  STATUS_LABELS,
  type BookkeepingRecord,
  type BookkeepingStatus,
  type UserRole,
} from "@/lib/api";
import type { PendingMutation } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { RowDensity } from "@/hooks/use-row-density";

const STATUS_OPTIONS: { value: BookkeepingStatus; label: string }[] = [
  { value: "SUCCESSFUL", label: "Successful" },
  { value: "RETURN_LABEL_PROVIDED", label: "Return Label" },
  { value: "RETURN_CLOSED", label: "Return Closed" },
  { value: "REFUND_NO_RETURN", label: "Refund (No Return)" },
];

const STRIKE_CLASS = "line-through text-gray-500";

const STATUS_ICONS: Record<BookkeepingStatus, React.ReactNode> = {
  SUCCESSFUL: <Check className="w-3 h-3 mr-1 inline" aria-hidden="true" />,
  RETURN_LABEL_PROVIDED: (
    <RotateCcw className="w-3 h-3 mr-1 inline" aria-hidden="true" />
  ),
  RETURN_CLOSED: <X className="w-3 h-3 mr-1 inline" aria-hidden="true" />,
  REFUND_NO_RETURN: (
    <PackageX className="w-3 h-3 mr-1 inline" aria-hidden="true" />
  ),
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

type VirtualRow = { type: "record" | "expanded"; record: BookkeepingRecord };

interface EditingState {
  id: string | null;
  field: string | null;
  value: string;
  saving: boolean;
}

interface RecordRowProps {
  records: VirtualRow[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  density: RowDensity;
  userRole: UserRole;
  orgId: string;
  accountId: string;
  editingState: EditingState;
  onEditStart: (recordId: string, field: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditValueChange: (value: string) => void;
  pendingMutations: Map<string, PendingMutation>;
  pendingStatus: { id: string; status: BookkeepingStatus } | null;
  isUpdating: boolean;
  deleteState: { id: string | null; isPending: boolean };
  onStatusChange: (recordId: string, status: BookkeepingStatus) => void;
  onDeleteClick: (recordId: string) => void;
  focusedIndex?: number;
}

export function RecordRow({
  ariaAttributes,
  index,
  style,
  records,
  expandedIds,
  onToggleExpand,
  density,
  userRole,
  editingState,
  onEditStart,
  onEditSave,
  onEditCancel,
  onEditValueChange,
  pendingMutations,
  pendingStatus,
  isUpdating,
  deleteState,
  onStatusChange,
  onDeleteClick,
  focusedIndex,
}: RowComponentProps<RecordRowProps>) {
  const row = records[index];
  if (!row) return null;

  const record = row.record;
  const isExpanded = expandedIds.has(record.id);
  const strikeAll = record.status === "RETURN_CLOSED";
  const strikeSalesFees = record.status === "REFUND_NO_RETURN";
  const displayProfit = strikeAll ? 0 : record.profit_cents;

  const rowPadding = density === "compact" ? "py-1" : "py-2";
  const isFocused = focusedIndex === index;

  const getDisplayValue = (field: string): string => {
    const value = record[field as keyof BookkeepingRecord];
    const config = FIELD_CONFIG[field];

    if (config?.type === "cents") {
      return value != null ? ((value as number) / 100).toFixed(2) : "";
    }
    return value?.toString() ?? "";
  };

  const renderEditableCell = (
    field: string,
    displayContent: React.ReactNode,
    className?: string
  ) => {
    const config = FIELD_CONFIG[field];
    const isEditing = editingState.id === record.id && editingState.field === field;

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
          value={editingState.value}
          onChange={(e) => onEditValueChange(e.target.value)}
          onBlur={onEditSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditSave();
            if (e.key === "Escape") onEditCancel();
          }}
          className={`${config?.width || "w-24"} h-7 text-sm bg-gray-800 border-gray-700`}
          autoFocus
          disabled={editingState.saving}
          min={config?.type === "number" ? 1 : undefined}
        />
      );
    }

    return (
      <span
        className={cn("cursor-pointer hover:text-blue-400", className)}
        onClick={() => onEditStart(record.id, field)}
      >
        {displayContent}
      </span>
    );
  };

  if (row.type === "expanded") {
    return (
      <div
        style={style}
        {...ariaAttributes}
        className="border-b border-gray-800 bg-gray-900/50 px-4 py-3 text-sm text-gray-200"
      >
        <div className="mb-3 text-sm">
          <span className="text-gray-400">Quantity: </span>
          <span className="text-white font-medium">{record.qty}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-400 mb-3">
              Earnings Breakdown
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Sale Price:</span>
                <span className={strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"}>
                  {renderEditableCell(
                    "sale_price_cents",
                    formatCents(record.sale_price_cents),
                    strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">eBay Fees:</span>
                <span className={strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"}>
                  {renderEditableCell(
                    "ebay_fees_cents",
                    `-${formatCents(record.ebay_fees_cents)}`,
                    strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-1">
                <span className="text-gray-300 font-medium">Earnings (Net):</span>
                <span
                  className={cn(
                    "font-medium",
                    strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-white"
                  )}
                >
                  {formatCents(record.earnings_net_cents)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-400 mb-3">
              COGS Breakdown
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Amazon Price:</span>
                <span className={strikeAll ? STRIKE_CLASS : "text-white"}>
                  {renderEditableCell(
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
                    "amazon_tax_cents",
                    formatCents(record.amazon_tax_cents ?? 0),
                    strikeAll ? STRIKE_CLASS : "text-white"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amazon Shipping:</span>
                <span className={strikeAll ? STRIKE_CLASS : "text-white"}>
                  {renderEditableCell(
                    "amazon_shipping_cents",
                    formatCents(record.amazon_shipping_cents),
                    strikeAll ? STRIKE_CLASS : "text-white"
                  )}
                </span>
              </div>
              {record.status !== "SUCCESSFUL" && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Return Label Cost:</span>
                  <span className={strikeAll ? STRIKE_CLASS : "text-white"}>
                    {renderEditableCell(
                      "return_label_cost_cents",
                      formatCents(record.return_label_cost_cents),
                      strikeAll ? STRIKE_CLASS : "text-white"
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-700 pt-1">
                <span className="text-gray-300 font-medium">COGS (Total):</span>
                <span className={cn("font-medium", strikeAll ? STRIKE_CLASS : "text-white")}>
                  {formatCents(record.cogs_total_cents)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-400 block mb-1">Order Remark:</span>
              {renderEditableCell(
                "order_remark",
                record.order_remark || (
                  <span className="text-gray-500 italic">No remarks</span>
                ),
                "text-gray-300 text-sm block"
              )}
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Service Remark:</span>
              {renderEditableCell(
                "service_remark",
                record.service_remark || (
                  <span className="text-gray-500 italic">No remarks</span>
                ),
                "text-gray-300 text-sm block"
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPending = pendingStatus?.id === record.id;
  const displayStatus = isPending ? pendingStatus.status : record.status;
  const isDeleting = deleteState.isPending && deleteState.id === record.id;

  return (
    <div
      style={style}
      {...ariaAttributes}
      className={cn(
        "flex items-center border-b border-gray-800 text-sm text-gray-200 px-2",
        rowPadding,
        isFocused && "ring-2 ring-blue-500"
      )}
    >
      <div className="flex items-center gap-1 w-10 shrink-0">
        <SyncRowBadge mutation={pendingMutations.get(record.id)} />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-gray-400"
          onClick={() => onToggleExpand(record.id)}
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
            className={cn("transition-transform", isExpanded && "rotate-90")}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Button>
      </div>

      <div className="w-32 shrink-0 text-white">
        {renderEditableCell("sale_date", record.sale_date, "text-white")}
      </div>

      <div className="w-32 shrink-0">
        {renderEditableCell(
          "ebay_order_id",
          record.ebay_order_id,
          "text-white font-mono text-sm"
        )}
      </div>

      <div className="w-48 shrink-0">
        {renderEditableCell(
          "item_name",
          <span className="truncate block" title={record.item_name}>
            {record.item_name}
          </span>,
          "text-white"
        )}
      </div>

      <div className="w-16 shrink-0 text-center">
        {renderEditableCell("qty", record.qty, "text-white")}
      </div>

      <div className="w-24 shrink-0 text-right">
        {strikeSalesFees || strikeAll ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={STRIKE_CLASS}>
                {formatCents(record.earnings_net_cents)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {record.status === "RETURN_CLOSED"
                ? "Return closed - excluded from totals"
                : "Refunded - excluded from totals"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-white">{formatCents(record.earnings_net_cents)}</span>
        )}
      </div>

      <div
        className={cn("w-24 shrink-0 text-right", strikeAll ? STRIKE_CLASS : "text-white")}
      >
        {formatCents(record.cogs_total_cents)}
      </div>

      <div
        className={cn(
          "w-24 shrink-0 text-right font-semibold",
          strikeAll
            ? STRIKE_CLASS
            : displayProfit >= 0
              ? "text-green-400"
              : "text-red-400"
        )}
      >
        {formatCents(displayProfit)}
      </div>

      <div className="w-32 shrink-0">
        {renderEditableCell(
          "amazon_order_id",
          displayValue(record.amazon_order_id),
          "text-white font-mono text-sm"
        )}
      </div>

      <div className="w-40 shrink-0">
        <Select
          value={displayStatus}
          onValueChange={(value) =>
            onStatusChange(record.id, value as BookkeepingStatus)
          }
          disabled={isPending || isUpdating}
        >
          <SelectTrigger
            className="min-w-[160px] h-7 text-xs bg-gray-800 border-gray-700"
            aria-label="Order status"
          >
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
      </div>

      <div className="w-12 shrink-0">
        {userRole.isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-red-400 hover:bg-red-900/20"
            onClick={() => onDeleteClick(record.id)}
            disabled={editingState.saving || isDeleting}
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
      </div>
    </div>
  );
}
