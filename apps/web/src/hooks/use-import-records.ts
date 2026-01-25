"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  importApi,
  type ImportFormat,
  type ImportValidationResponse,
  type ImportCommitResponse,
  type ImportBatch,
  type ImportRollbackWarning,
} from "@/lib/api";

/**
 * Hook for importing records: validation, commit, and state management.
 */
export function useImportRecords() {
  const queryClient = useQueryClient();
  const [validationResult, setValidationResult] = useState<ImportValidationResponse | null>(null);
  const [validationError, setValidationError] = useState<Error | null>(null);

  // Validation mutation
  const validateMutation = useMutation<ImportValidationResponse, Error, { file: File; format: ImportFormat }>({
    mutationFn: ({ file, format }) => importApi.validateFile(file, format),
    onSuccess: (data) => {
      setValidationResult(data);
      setValidationError(null);
    },
    onError: (error) => {
      setValidationError(error);
      setValidationResult(null);
    },
  });

  // Commit mutation
  const commitMutation = useMutation<
    ImportCommitResponse,
    Error,
    { file: File; accountId: string; format: ImportFormat; columnMapping: Record<string, string> }
  >({
    mutationFn: ({ file, accountId, format, columnMapping }) =>
      importApi.commitImport(file, accountId, format, columnMapping),
    onSuccess: () => {
      // Invalidate records queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["records"] });
      // Invalidate import batches
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
    },
  });

  // Validate file
  const validateFile = useCallback(
    async (file: File, format: ImportFormat) => {
      return validateMutation.mutateAsync({ file, format });
    },
    [validateMutation]
  );

  // Commit import
  const commitImport = useCallback(
    async (file: File, accountId: string, format: ImportFormat, columnMapping: Record<string, string>) => {
      return commitMutation.mutateAsync({ file, accountId, format, columnMapping });
    },
    [commitMutation]
  );

  // Reset state
  const reset = useCallback(() => {
    setValidationResult(null);
    setValidationError(null);
    validateMutation.reset();
    commitMutation.reset();
  }, [validateMutation, commitMutation]);

  return {
    // Validation
    validateFile,
    validationResult,
    isValidating: validateMutation.isPending,
    validationError,

    // Commit
    commitImport,
    isCommitting: commitMutation.isPending,
    commitError: commitMutation.error,
    commitResult: commitMutation.data,

    // Reset
    reset,
  };
}

/**
 * Hook for import history: list batches and rollback.
 */
export function useImportHistory(accountId?: string) {
  const queryClient = useQueryClient();
  const [rollbackWarning, setRollbackWarning] = useState<ImportRollbackWarning | null>(null);

  // Query import batches
  const batchesQuery = useQuery({
    queryKey: ["import-batches", accountId],
    queryFn: () => importApi.getImportBatches(accountId),
    staleTime: 30_000, // 30s
  });

  // Rollback mutation
  const rollbackMutation = useMutation<
    { success: boolean; rows_deleted: number; warning?: ImportRollbackWarning },
    Error,
    { batchId: string; force?: boolean }
  >({
    mutationFn: ({ batchId, force = false }) => importApi.rollbackImport(batchId, force),
    onSuccess: (data, variables) => {
      if (data.warning && !variables.force) {
        // Store warning and wait for force confirmation
        setRollbackWarning(data.warning);
      } else {
        // Successful rollback
        setRollbackWarning(null);
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["records"] });
        queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      }
    },
  });

  // Rollback import batch
  const rollback = useCallback(
    async (batchId: string, force: boolean = false) => {
      return rollbackMutation.mutateAsync({ batchId, force });
    },
    [rollbackMutation]
  );

  // Clear warning
  const clearWarning = useCallback(() => {
    setRollbackWarning(null);
    rollbackMutation.reset();
  }, [rollbackMutation]);

  return {
    // Batches
    batches: batchesQuery.data?.batches ?? ([] as ImportBatch[]),
    isLoading: batchesQuery.isLoading,
    error: batchesQuery.error,

    // Rollback
    rollback,
    rollbackWarning,
    clearWarning,
    isRollingBack: rollbackMutation.isPending,
    rollbackError: rollbackMutation.error,
  };
}
