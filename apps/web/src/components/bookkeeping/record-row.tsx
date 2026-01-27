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
import { SkeletonRow } from "@/components/bookkeeping/skeleton-row";
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
  { value: "REFUND_NO_RETURN", label: "Refund" },
];

const STRIKE_CLASS = "line-through text-muted-foreground/70";

const STATUS_ICONS: Record<BookkeepingStatus, React.ReactNode> = {
  SUCCESSFUL: <Check className="w-4 h-4 mr-1 inline" aria-hidden="true" />,
  RETURN_LABEL_PROVIDED: (
    <RotateCcw className="w-4 h-4 mr-1 inline" aria-hidden="true" />
  ),
  RETURN_CLOSED: <X className="w-4 h-4 mr-1 inline" aria-hidden="true" />,
  REFUND_NO_RETURN: (
    <PackageX className="w-4 h-4 mr-1 inline" aria-hidden="true" />
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
  sale_date: { type: "date", width: "w-24" },
  ebay_order_id: { type: "text", width: "w-36" },
  item_name: { type: "text", width: "w-full" },
  qty: { type: "number", width: "w-12" },
  sale_price_cents: { type: "cents", width: "w-24" },
  ebay_fees_cents: { type: "cents", width: "w-24" },
  amazon_price_cents: { type: "cents", width: "w-24" },
  amazon_tax_cents: { type: "cents", width: "w-24" },
  amazon_shipping_cents: { type: "cents", width: "w-24" },
  return_label_cost_cents: { type: "cents", width: "w-24" },
  amazon_order_id: { type: "text", width: "w-52" },
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
  rowHeight: number;
  isLoadingMore: boolean;
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
  rowHeight,
  isLoadingMore,
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
  if (!row) {
    return isLoadingMore ? (
      <SkeletonRow style={{ ...style, width: "100%", height: rowHeight }} density={density} />
    ) : null;
  }

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
          value={editingState.value}
          onChange={(e) => onEditValueChange(e.target.value)}
          onBlur={onEditSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditSave();
            if (e.key === "Escape") onEditCancel();
          }}
          className={`${config?.width || "w-24"} h-7 text-sm bg-muted border-border [&::-webkit-calendar-picker-indicator]:invert`}
          autoFocus
          disabled={editingState.saving}
          min={config?.type === "number" ? 1 : undefined}
        />
      );
    }

    return (
      <span
        className={cn("cursor-pointer hover:text-accent-foreground", className)}
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
        className="border-b border-border bg-muted/50 px-4 py-3 text-sm text-foreground/80"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Earnings Breakdown
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sale Price:</span>
                <span className={strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-foreground"}>
                  {renderEditableCell(
                    "sale_price_cents",
                    <span className="font-mono">{formatCents(record.sale_price_cents)}</span>,
                    strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-foreground"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">eBay Fees:</span>
                <span className={strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-foreground"}>
                  {renderEditableCell(
                    "ebay_fees_cents",
                    <span className="font-mono">{`-${formatCents(record.ebay_fees_cents)}`}</span>,
                    strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-foreground"
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-1">
                <span className="text-foreground/80 font-medium">Earnings (Net):</span>
                <span
                  className={cn(
                    "font-medium",
                    strikeSalesFees || strikeAll ? STRIKE_CLASS : "text-foreground"
                  )}
                >
                  <span className="font-mono">{formatCents(record.earnings_net_cents)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              COGS Breakdown
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amazon Price:</span>
                <span className={strikeAll ? STRIKE_CLASS : "text-foreground"}>
                  {renderEditableCell(
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
                      "return_label_cost_cents",
                      <span className="font-mono">{formatCents(record.return_label_cost_cents)}</span>,
                      strikeAll ? STRIKE_CLASS : "text-foreground"
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1">
                <span className="text-foreground/80 font-medium">COGS (Total):</span>
                <span className={cn("font-medium", strikeAll ? STRIKE_CLASS : "text-foreground")}>
                  <span className="font-mono">{formatCents(record.cogs_total_cents)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground block mb-1">Order Remark:</span>
              {renderEditableCell(
                "order_remark",
                record.order_remark || (
                  <span className="text-muted-foreground/70 italic">No remarks</span>
                ),
                "text-foreground/80 text-sm block"
              )}
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Service Remark:</span>
              {renderEditableCell(
                "service_remark",
                record.service_remark || (
                  <span className="text-muted-foreground/70 italic">No remarks</span>
                ),
                "text-foreground/80 text-sm block"
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
        "flex items-center gap-2 border-b border-border text-sm text-foreground/80 px-2 min-w-[1200px]",
        rowPadding,
        isFocused && "ring-2 ring-ring"
      )}
    >
      <div className="flex items-center gap-1 w-10 shrink-0">
        <SyncRowBadge mutation={pendingMutations.get(record.id)} />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground"
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

      <div className="w-24 shrink-0 text-foreground">
        {renderEditableCell("sale_date", <span className="font-mono text-sm">{record.sale_date}</span>, "text-foreground")}
      </div>

      <div className="w-36 shrink-0">
        {renderEditableCell(
          "ebay_order_id",
          <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">{record.ebay_order_id}</span>,
          "text-foreground"
        )}
      </div>

      <div className="flex-1 min-w-[200px]">
        {renderEditableCell(
          "item_name",
          <span className="truncate block" title={record.item_name}>
            {record.item_name}
          </span>,
          "text-foreground"
        )}
      </div>

      <div className="w-12 shrink-0 text-center">
        {renderEditableCell("qty", <span className="font-mono text-sm">{record.qty}</span>, "text-foreground")}
      </div>

      <div className="w-20 shrink-0 text-right">
        {strikeSalesFees || strikeAll ? (
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
      </div>

      <div
        className={cn("w-20 shrink-0 text-right", strikeAll ? STRIKE_CLASS : "text-foreground")}
      >
        <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">{formatCents(record.cogs_total_cents)}</span>
      </div>

      <div
        className={cn(
          "w-20 shrink-0 text-right font-semibold pr-4",
          strikeAll
            ? STRIKE_CLASS
            : displayProfit >= 0
              ? "text-green-400"
              : "text-red-400"
        )}
      >
        <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">{formatCents(displayProfit)}</span>
      </div>

      <div className="w-52 shrink-0">
        {renderEditableCell(
          "amazon_order_id",
          <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">{displayValue(record.amazon_order_id)}</span>,
          "text-foreground"
        )}
      </div>

      <div className="w-48 shrink-0">
        <Select
          value={displayStatus}
          onValueChange={(value) =>
            onStatusChange(record.id, value as BookkeepingStatus)
          }
          disabled={isPending || isUpdating}
        >
          <SelectTrigger
            className="w-full h-7 text-xs bg-muted border-border"
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
      </div>

      <div className="w-10 shrink-0 ml-auto">
        {userRole.isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-900/20"
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
