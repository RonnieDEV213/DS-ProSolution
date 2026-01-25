"use client";

import { useMemo } from "react";
import { AlertCircle, Check, Minus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { IMPORT_FIELDS } from "@/lib/api";

interface ColumnMapperProps {
  /** Column headers from the uploaded file */
  headers: string[];
  /** Suggested column mapping from API validation */
  suggestedMapping: Record<string, string>;
  /** Current user-confirmed mapping */
  mapping: Record<string, string>;
  /** Callback when mapping changes */
  onMappingChange: (mapping: Record<string, string>) => void;
}

const SKIP_COLUMN = "__skip__";

/**
 * Column mapping component for import wizard.
 * Shows file columns mapped to database fields with dropdown selectors.
 */
export function ColumnMapper({
  headers,
  suggestedMapping,
  mapping,
  onMappingChange,
}: ColumnMapperProps) {
  // Calculate mapping status
  const { mappedRequired, missingRequired, mappedOptional } = useMemo(() => {
    const mappedFields = new Set(Object.values(mapping).filter((v) => v !== SKIP_COLUMN));
    const requiredFields = IMPORT_FIELDS.filter((f) => f.required);
    const optionalFields = IMPORT_FIELDS.filter((f) => !f.required);

    return {
      mappedRequired: requiredFields.filter((f) => mappedFields.has(f.field)).length,
      missingRequired: requiredFields.filter((f) => !mappedFields.has(f.field)),
      mappedOptional: optionalFields.filter((f) => mappedFields.has(f.field)).length,
    };
  }, [mapping]);

  // Get fields already mapped (to prevent duplicates)
  const usedFields = useMemo(() => {
    return new Set(Object.values(mapping).filter((v) => v !== SKIP_COLUMN));
  }, [mapping]);

  // Handle column mapping change
  const handleMappingChange = (fileColumn: string, targetField: string) => {
    const newMapping = { ...mapping };
    if (targetField === SKIP_COLUMN) {
      newMapping[fileColumn] = SKIP_COLUMN;
    } else {
      // Remove this target field from any other file column
      for (const key of Object.keys(newMapping)) {
        if (newMapping[key] === targetField) {
          newMapping[key] = SKIP_COLUMN;
        }
      }
      newMapping[fileColumn] = targetField;
    }
    onMappingChange(newMapping);
  };

  // Apply suggested mappings
  const applySuggested = () => {
    const newMapping: Record<string, string> = {};
    for (const header of headers) {
      newMapping[header] = suggestedMapping[header] || SKIP_COLUMN;
    }
    onMappingChange(newMapping);
  };

  // Check if current mapping differs from suggested
  const hasDifferentMapping = useMemo(() => {
    for (const header of headers) {
      const current = mapping[header] || SKIP_COLUMN;
      const suggested = suggestedMapping[header] || SKIP_COLUMN;
      if (current !== suggested) return true;
    }
    return false;
  }, [headers, mapping, suggestedMapping]);

  const totalRequired = IMPORT_FIELDS.filter((f) => f.required).length;
  const allRequiredMapped = missingRequired.length === 0;

  return (
    <div className="space-y-4">
      {/* Status summary */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={allRequiredMapped ? "default" : "destructive"}>
          {allRequiredMapped ? (
            <Check className="mr-1 h-3 w-3" />
          ) : (
            <AlertCircle className="mr-1 h-3 w-3" />
          )}
          {mappedRequired}/{totalRequired} required
        </Badge>
        <Badge variant="secondary">{mappedOptional} optional</Badge>
        {hasDifferentMapping && (
          <button
            type="button"
            onClick={applySuggested}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Reset to suggested
          </button>
        )}
      </div>

      {/* Missing required fields warning */}
      {missingRequired.length > 0 && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
          <strong>Missing required fields:</strong>{" "}
          {missingRequired.map((f) => f.label).join(", ")}
        </div>
      )}

      {/* Mapping table */}
      <div className="rounded-md border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-4 py-2 text-left text-gray-400 font-medium">
                File Column
              </th>
              <th className="px-4 py-2 text-center text-gray-400 font-medium w-10">
                {/* Arrow */}
              </th>
              <th className="px-4 py-2 text-left text-gray-400 font-medium">
                Map to Field
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {headers.map((header) => {
              const currentValue = mapping[header] || SKIP_COLUMN;
              const fieldInfo = IMPORT_FIELDS.find((f) => f.field === currentValue);
              const isRequired = fieldInfo?.required;
              const isSkipped = currentValue === SKIP_COLUMN;

              return (
                <tr
                  key={header}
                  className={
                    isSkipped
                      ? "bg-gray-900/30 opacity-60"
                      : isRequired
                        ? "bg-blue-500/5"
                        : ""
                  }
                >
                  <td className="px-4 py-2 font-mono text-gray-300">{header}</td>
                  <td className="px-4 py-2 text-center text-gray-500">
                    {isSkipped ? (
                      <Minus className="h-4 w-4 mx-auto" />
                    ) : (
                      <span>&rarr;</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      value={currentValue}
                      onValueChange={(value) => handleMappingChange(header, value)}
                    >
                      <SelectTrigger className="w-full max-w-[280px]">
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP_COLUMN}>
                          <span className="text-gray-500">Skip this column</span>
                        </SelectItem>
                        {IMPORT_FIELDS.map((field) => {
                          const isUsed = usedFields.has(field.field) && currentValue !== field.field;
                          return (
                            <SelectItem
                              key={field.field}
                              value={field.field}
                              disabled={isUsed}
                            >
                              <span className="flex items-center gap-2">
                                {field.label}
                                {field.required && (
                                  <span className="text-xs text-red-400">*</span>
                                )}
                                {isUsed && (
                                  <span className="text-xs text-gray-500">(used)</span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        * Required fields must be mapped before import can proceed.
      </p>
    </div>
  );
}

export { SKIP_COLUMN };
