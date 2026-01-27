"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  History,
  Loader2,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ColumnMapper, SKIP_COLUMN } from "./column-mapper";
import { ImportPreview } from "./import-preview";
import { ImportHistory } from "./import-history";
import { useImportRecords } from "@/hooks/use-import-records";
import { IMPORT_FIELDS, type ImportFormat } from "@/lib/api";

interface ImportDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Account ID for import */
  accountId: string;
}

type ImportStep = "upload" | "mapping" | "preview" | "history";

// File format detection
function detectFormat(file: File): ImportFormat {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "excel";
  return "csv";
}

/**
 * Import dialog with multi-step wizard.
 * Steps: Upload -> Column Mapping -> Preview -> Confirm
 */
export function ImportDialog({
  open,
  onOpenChange,
  accountId,
}: ImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    validateFile,
    validationResult,
    isValidating,
    validationError,
    commitImport,
    isCommitting,
    commitError,
    commitResult,
    reset,
  } = useImportRecords();

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset on close
        setStep("upload");
        setFile(null);
        setFormat("csv");
        setColumnMapping({});
        setDragActive(false);
        reset();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, reset]
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      const detectedFormat = detectFormat(selectedFile);
      setFormat(detectedFormat);

      try {
        const result = await validateFile(selectedFile, detectedFormat);

        // Initialize mapping with suggested values
        const headers = Object.keys(result.suggested_mapping);
        const initialMapping: Record<string, string> = {};
        for (const header of headers) {
          initialMapping[header] = result.suggested_mapping[header] || SKIP_COLUMN;
        }
        setColumnMapping(initialMapping);

        // Move to mapping step
        setStep("mapping");
      } catch {
        // Error handled by hook
      }
    },
    [validateFile]
  );

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect]
  );

  // Check if all required fields are mapped
  const allRequiredMapped = useMemo(() => {
    const mappedFields = new Set(
      Object.values(columnMapping).filter((v) => v !== SKIP_COLUMN)
    );
    const requiredFields = IMPORT_FIELDS.filter((f) => f.required);
    return requiredFields.every((f) => mappedFields.has(f.field));
  }, [columnMapping]);

  // Get set of mapped fields (for filtering errors)
  const mappedFields = useMemo(() => {
    return new Set(
      Object.values(columnMapping).filter((v) => v && v !== SKIP_COLUMN)
    );
  }, [columnMapping]);

  // Check if all rows are valid (considering only mapped fields)
  const allRowsValid = useMemo(() => {
    if (!validationResult) return false;

    // Check each preview row for errors in mapped fields only
    for (const row of validationResult.preview) {
      const relevantErrors = row.errors.filter((e) => mappedFields.has(e.field));
      if (relevantErrors.length > 0) return false;
    }
    return true;
  }, [validationResult, mappedFields]);

  // Handle commit
  const handleCommit = useCallback(async () => {
    if (!file) return;

    try {
      await commitImport(file, accountId, format, columnMapping);
      // Show success briefly, then close
      setTimeout(() => {
        handleOpenChange(false);
      }, 1500);
    } catch {
      // Error handled by hook
    }
  }, [file, accountId, format, columnMapping, commitImport, handleOpenChange]);

  // Navigate between steps
  const goBack = () => {
    if (step === "mapping") setStep("upload");
    if (step === "preview") setStep("mapping");
    if (step === "history") setStep("upload");
  };

  const goNext = () => {
    if (step === "mapping" && allRequiredMapped) setStep("preview");
  };

  // Step indicator
  const steps = [
    { key: "upload", label: "Upload" },
    { key: "mapping", label: "Map Columns" },
    { key: "preview", label: "Preview" },
  ] as const;

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" showCloseButton={false}>
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Records
            </DialogTitle>
            {step !== "history" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("history")}
                className="text-muted-foreground hover:text-foreground"
              >
                <History className="h-4 w-4 mr-1" />
                History
              </Button>
            )}
          </div>

          {/* Step indicator */}
          {step !== "history" && (
            <div className="flex items-center gap-2 mt-4">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                      i < currentStepIndex
                        ? "bg-green-600 text-white"
                        : i === currentStepIndex
                          ? "bg-blue-600 text-white"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < currentStepIndex ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span
                    className={`ml-2 text-sm ${
                      i === currentStepIndex ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                  {i < steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Content area with scroll */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* Upload step */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
                  dragActive
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border hover:border-border/80"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDrag}
                onDragEnter={handleDragIn}
                onDragLeave={handleDragOut}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,.xlsx,.xls"
                  onChange={handleFileInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-center">
                  {isValidating ? (
                    <>
                      <Loader2 className="h-10 w-10 mx-auto mb-3 text-blue-500 animate-spin" />
                      <p className="text-foreground">Validating file...</p>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-foreground mb-1">
                        Drag and drop your file here
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supported: CSV, JSON, Excel (.xlsx, .xls)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Validation error */}
              {validationError && (
                <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 inline-block mr-2" />
                  {validationError.message}
                </div>
              )}
            </div>
          )}

          {/* Mapping step */}
          {step === "mapping" && validationResult && (
            <ColumnMapper
              headers={Object.keys(validationResult.suggested_mapping)}
              suggestedMapping={validationResult.suggested_mapping}
              mapping={columnMapping}
              onMappingChange={setColumnMapping}
            />
          )}

          {/* Preview step */}
          {step === "preview" && validationResult && (
            <div className="space-y-4">
              <ImportPreview
                preview={validationResult.preview}
                totalRows={validationResult.total_rows}
                validRows={validationResult.valid_rows}
                columnMapping={columnMapping}
              />

              {/* Commit success */}
              {commitResult && (
                <div className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-400">
                  <Check className="h-4 w-4 inline-block mr-2" />
                  Successfully imported {commitResult.rows_imported.toLocaleString()} records!
                </div>
              )}

              {/* Commit error */}
              {commitError && (
                <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 inline-block mr-2" />
                  {commitError.message}
                </div>
              )}
            </div>
          )}

          {/* History step */}
          {step === "history" && <ImportHistory accountId={accountId} />}
        </div>

        {/* Footer with navigation */}
        <div className="shrink-0 border-t border-border pt-4 flex items-center justify-between">
          <div>
            {step !== "upload" && (
              <Button variant="outline" onClick={goBack} disabled={isCommitting}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === "mapping" && (
              <Button onClick={goNext} disabled={!allRequiredMapped}>
                Preview
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === "preview" && (
              <Button
                onClick={handleCommit}
                disabled={!allRowsValid || isCommitting || !!commitResult}
                className="bg-green-600 hover:bg-green-700"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : commitResult ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Imported!
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {validationResult?.total_rows.toLocaleString()} Records
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
