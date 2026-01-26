"use client";

import { useState } from "react";
import { AlertCircle, FileSpreadsheet, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useImportHistory } from "@/hooks/use-import-records";
import type { ImportBatch, ImportRollbackWarning } from "@/lib/api";

interface ImportHistoryProps {
  /** Account ID to filter batches */
  accountId?: string;
}

/**
 * Import history list with rollback functionality.
 * Shows past imports with ability to undo within 24 hours.
 */
export function ImportHistory({ accountId }: ImportHistoryProps) {
  const {
    batches,
    isLoading,
    error,
    rollback,
    rollbackWarning,
    clearWarning,
    isRollingBack,
  } = useImportHistory(accountId);

  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);

  // Initiate rollback
  const handleRollback = async (batch: ImportBatch) => {
    setSelectedBatch(batch);
    setShowConfirmDialog(true);
  };

  // Confirm initial rollback
  const confirmRollback = async () => {
    if (!selectedBatch) return;
    setShowConfirmDialog(false);

    try {
      const result = await rollback(selectedBatch.id, false);
      if (result.warning) {
        // Show warning dialog for modified records
        setShowWarningDialog(true);
      }
    } catch {
      // Error handled by hook
    }
  };

  // Force rollback after warning
  const forceRollback = async () => {
    if (!selectedBatch) return;
    setShowWarningDialog(false);
    clearWarning();

    try {
      await rollback(selectedBatch.id, true);
    } catch {
      // Error handled by hook
    }
    setSelectedBatch(null);
  };

  // Cancel rollback
  const cancelRollback = () => {
    setShowConfirmDialog(false);
    setShowWarningDialog(false);
    clearWarning();
    setSelectedBatch(null);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading import history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
        <AlertCircle className="h-4 w-4 inline-block mr-2" />
        Failed to load import history: {error.message}
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No import history yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Recent Imports</h3>

      <div className="divide-y divide-border rounded-md border border-border">
        {batches.map((batch) => (
          <ImportBatchRow
            key={batch.id}
            batch={batch}
            onRollback={() => handleRollback(batch)}
            isRollingBack={isRollingBack && selectedBatch?.id === batch.id}
          />
        ))}
      </div>

      {/* Initial confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Import?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all {selectedBatch?.row_count.toLocaleString()} records
              imported from &quot;{selectedBatch?.filename}&quot;. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelRollback}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRollback}
              className="bg-red-600 hover:bg-red-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Rollback
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modified records warning dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertCircle className="h-5 w-5" />
              Records Have Been Modified
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{rollbackWarning?.warning}</p>
                <p className="font-medium text-amber-400">
                  {rollbackWarning?.modified_count} record(s) have been edited since import.
                </p>
                <p>
                  Do you still want to delete these records? This will also remove
                  any changes made to them.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelRollback}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={forceRollback}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ImportBatchRowProps {
  batch: ImportBatch;
  onRollback: () => void;
  isRollingBack: boolean;
}

function ImportBatchRow({ batch, onRollback, isRollingBack }: ImportBatchRowProps) {
  const importDate = new Date(batch.created_at);
  const isRolledBack = batch.rolled_back_at !== null;

  return (
    <div className="flex items-center justify-between gap-4 p-3">
      <div className="flex items-center gap-3 min-w-0">
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{batch.filename}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-mono">{batch.row_count.toLocaleString()} rows</span>
            <span>&bull;</span>
            <span className="font-mono">{formatDate(importDate)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isRolledBack ? (
          <Badge variant="secondary" className="text-muted-foreground">
            Rolled back
          </Badge>
        ) : batch.can_rollback ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRollback}
            disabled={isRollingBack}
            className="text-red-400 border-red-500/50 hover:bg-red-500/10"
          >
            {isRollingBack ? (
              <>Rolling back...</>
            ) : (
              <>
                <RotateCcw className="h-3 w-3 mr-1" />
                Rollback
              </>
            )}
          </Button>
        ) : (
          <Badge variant="secondary" className="text-muted-foreground">
            Expired
          </Badge>
        )}
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
