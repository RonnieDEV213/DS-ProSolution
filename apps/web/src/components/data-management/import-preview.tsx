"use client";

import { Fragment, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ImportPreviewRow, ImportValidationError } from "@/lib/api";

interface ImportPreviewProps {
  /** Preview rows from validation */
  preview: ImportPreviewRow[];
  /** Total rows in file */
  totalRows: number;
  /** Number of valid rows */
  validRows: number;
  /** Column mapping to show mapped field names */
  columnMapping: Record<string, string>;
}

const SKIP_COLUMN = "__skip__";

/**
 * Preview table showing validation results for import.
 * Displays first 100 rows with error highlighting.
 */
export function ImportPreview({
  preview,
  totalRows,
  validRows,
  columnMapping,
}: ImportPreviewProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Get visible columns (mapped, not skipped)
  const visibleColumns = useMemo(() => {
    return Object.entries(columnMapping)
      .filter(([, target]) => target !== SKIP_COLUMN)
      .map(([source, target]) => ({ source, target }));
  }, [columnMapping]);

  // Get set of mapped DB fields (exclude skipped)
  const mappedFields = useMemo(() => {
    return new Set(
      Object.values(columnMapping).filter((v) => v && v !== SKIP_COLUMN)
    );
  }, [columnMapping]);

  // Group errors by row, filtering out errors for unmapped/skipped fields
  const errorsByRow = useMemo(() => {
    const map = new Map<number, ImportValidationError[]>();
    for (const row of preview) {
      // Filter errors to only include mapped fields
      const relevantErrors = row.errors.filter((e) => mappedFields.has(e.field));
      if (relevantErrors.length > 0) {
        map.set(row.row_number, relevantErrors);
      }
    }
    return map;
  }, [preview, mappedFields]);

  // Toggle row expansion
  const toggleRow = (rowNumber: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber);
    } else {
      newExpanded.add(rowNumber);
    }
    setExpandedRows(newExpanded);
  };

  // Recalculate valid/invalid based on filtered errors (respects user's mapping)
  const filteredValidRows = useMemo(() => {
    return preview.filter((row) => !errorsByRow.has(row.row_number)).length;
  }, [preview, errorsByRow]);

  const filteredInvalidRows = preview.length - filteredValidRows;
  const allValid = filteredInvalidRows === 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={allValid ? "default" : "destructive"}>
          {allValid ? (
            <Check className="mr-1 h-3 w-3" />
          ) : (
            <X className="mr-1 h-3 w-3" />
          )}
          {filteredValidRows.toLocaleString()} valid
        </Badge>
        {filteredInvalidRows > 0 && (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            {filteredInvalidRows.toLocaleString()} with errors
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">
          of {totalRows.toLocaleString()} total rows
        </span>
        {preview.length < totalRows && (
          <span className="text-xs text-muted-foreground">
            (showing first {preview.length} rows)
          </span>
        )}
      </div>

      {/* All-or-nothing warning */}
      {!allValid && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
          <strong>Import blocked:</strong> All rows must be valid before import
          can proceed. Fix the errors shown below and re-upload.
        </div>
      )}

      {/* Preview table */}
      <div className="rounded-md border border-border max-h-[400px] overflow-auto scrollbar-thin">
        <table className="w-full caption-bottom text-sm min-w-max">
          <thead className="sticky top-0 bg-card z-10 [&_tr]:border-b">
            <tr className="border-b transition-colors">
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-12 text-center text-foreground">#</th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-12 text-center text-foreground">Status</th>
              {visibleColumns.map((col) => (
                <th key={col.source} className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[120px] text-foreground">
                  {formatFieldName(col.target)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {preview.map((row) => {
              const isExpanded = expandedRows.has(row.row_number);
              const rowErrors = errorsByRow.get(row.row_number) || [];
              const errorFields = new Set(rowErrors.map((e) => e.field));
              const isRowValid = rowErrors.length === 0;

              return (
                <Fragment key={row.row_number}>
                  <tr
                    className={`border-b transition-colors ${
                      isRowValid
                        ? "hover:bg-muted/50"
                        : "bg-red-500/5 hover:bg-red-500/10 cursor-pointer"
                    }`}
                    onClick={() => !isRowValid && toggleRow(row.row_number)}
                  >
                    <td className="p-2 align-middle whitespace-nowrap text-center text-muted-foreground font-mono text-xs">
                      {row.row_number}
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap text-center">
                      {isRowValid ? (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <div className="flex items-center justify-center">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-red-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      )}
                    </td>
                    {visibleColumns.map((col) => {
                      // row.data is keyed by DB field (target), not CSV column (source)
                      const value = row.data[col.target];
                      const hasError = errorFields.has(col.target);
                      const fieldError = rowErrors.find((e) => e.field === col.target);

                      return (
                        <td
                          key={col.source}
                          className={`p-2 align-middle whitespace-nowrap ${hasError ? "text-red-400" : ""}`}
                        >
                          {hasError && fieldError ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded underline decoration-red-500 decoration-dotted cursor-help">
                                  {formatValue(value)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                {fieldError.message}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                              {formatValue(value)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Expanded error details */}
                  {isExpanded && rowErrors.length > 0 && (
                    <tr className="bg-red-500/5 border-b transition-colors">
                      <td
                        colSpan={visibleColumns.length + 2}
                        className="p-2 align-middle py-2"
                      >
                        <div className="pl-8 space-y-1">
                          {rowErrors.map((error, i) => (
                            <div key={i} className="text-xs text-red-400">
                              <span className="font-medium">
                                {formatFieldName(error.field)}:
                              </span>{" "}
                              {error.message}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Click on rows with errors to expand error details.
      </p>
    </div>
  );
}

// Format field name for display
function formatFieldName(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Cents$/, "(cents)")
    .replace(/Id$/, "ID");
}

// Format cell value for display
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number") return value.toString();
  return String(value);
}
