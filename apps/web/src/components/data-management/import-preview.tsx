"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  // Group errors by row for easy lookup
  const errorsByRow = useMemo(() => {
    const map = new Map<number, ImportValidationError[]>();
    for (const row of preview) {
      if (row.errors.length > 0) {
        map.set(row.row_number, row.errors);
      }
    }
    return map;
  }, [preview]);

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

  const invalidRows = totalRows - validRows;
  const allValid = invalidRows === 0;

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
          {validRows.toLocaleString()} valid
        </Badge>
        {invalidRows > 0 && (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            {invalidRows.toLocaleString()} with errors
          </Badge>
        )}
        <span className="text-sm text-gray-400">
          of {totalRows.toLocaleString()} total rows
        </span>
        {preview.length < totalRows && (
          <span className="text-xs text-gray-500">
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
      <div className="rounded-md border border-gray-700 overflow-hidden max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-gray-900 z-10">
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead className="w-12 text-center">Status</TableHead>
              {visibleColumns.map((col) => (
                <TableHead key={col.target} className="min-w-[120px]">
                  {formatFieldName(col.target)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.map((row) => {
              const isExpanded = expandedRows.has(row.row_number);
              const rowErrors = errorsByRow.get(row.row_number) || [];
              const errorFields = new Set(rowErrors.map((e) => e.field));

              return (
                <>
                  <TableRow
                    key={row.row_number}
                    className={
                      row.is_valid
                        ? ""
                        : "bg-red-500/5 hover:bg-red-500/10 cursor-pointer"
                    }
                    onClick={() => !row.is_valid && toggleRow(row.row_number)}
                  >
                    <TableCell className="text-center text-gray-500 font-mono text-xs">
                      {row.row_number}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.is_valid ? (
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
                    </TableCell>
                    {visibleColumns.map((col) => {
                      const value = row.data[col.source];
                      const hasError = errorFields.has(col.target);
                      const fieldError = rowErrors.find((e) => e.field === col.target);

                      return (
                        <TableCell
                          key={col.target}
                          className={hasError ? "text-red-400" : ""}
                        >
                          {hasError && fieldError ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="underline decoration-red-500 decoration-dotted cursor-help">
                                  {formatValue(value)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                {fieldError.message}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            formatValue(value)
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {/* Expanded error details */}
                  {isExpanded && rowErrors.length > 0 && (
                    <TableRow className="bg-red-500/5">
                      <TableCell
                        colSpan={visibleColumns.length + 2}
                        className="py-2"
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
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-gray-500">
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
