'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { Conflict, Resolution, MergeSelection } from '@/lib/db/conflicts';
import { resolveConflict as resolveConflictDb } from '@/lib/db/conflicts';
import { processQueue } from '@/lib/db/pending-mutations';
import { useOnlineStatus } from '@/hooks/sync/use-online-status';

interface SyncContextValue {
  conflicts: Conflict[];
  currentConflict: Conflict | null;
  addConflict: (conflict: Conflict) => void;
  resolveCurrentConflict: (
    resolution: Resolution,
    mergeSelection?: MergeSelection,
    applyToAll?: boolean
  ) => Promise<void>;
  hasConflicts: boolean;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const isOnline = useOnlineStatus();

  const currentConflict = conflicts[0] ?? null;
  const hasConflicts = conflicts.length > 0;

  const addConflict = useCallback((conflict: Conflict) => {
    setConflicts((prev) => [...prev, conflict]);
  }, []);

  const resolveCurrentConflict = useCallback(
    async (
      resolution: Resolution,
      mergeSelection?: MergeSelection,
      applyToAll?: boolean
    ) => {
      if (!currentConflict) return;

      if (applyToAll && resolution !== 'merge') {
        // Apply same resolution to all remaining conflicts
        for (const conflict of conflicts) {
          await resolveConflictDb(conflict, resolution);
        }
        setConflicts([]);
      } else {
        // Resolve just the current conflict
        await resolveConflictDb(currentConflict, resolution, mergeSelection);
        setConflicts((prev) => prev.slice(1));
      }
    },
    [currentConflict, conflicts]
  );

  // CRITICAL WIRING: Process queue when coming back online
  // Pass addConflict as the onConflict callback so detectConflict results
  // flow into the conflict queue and trigger the modal.
  useEffect(() => {
    if (isOnline && !hasConflicts) {
      // When online and no unresolved conflicts, process the queue
      processQueue(addConflict).then((result) => {
        if (result.conflicts > 0) {
          console.log(`[Sync] ${result.conflicts} conflict(s) detected, awaiting resolution`);
        }
        if (result.processed > 0) {
          console.log(`[Sync] Processed ${result.processed} queued mutation(s)`);
        }
        if (result.failed > 0) {
          console.warn(`[Sync] ${result.failed} mutation(s) failed after retries`);
        }
      });
    }
  }, [isOnline, hasConflicts, addConflict]);

  return (
    <SyncContext.Provider
      value={{
        conflicts,
        currentConflict,
        addConflict,
        resolveCurrentConflict,
        hasConflicts,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncConflicts() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncConflicts must be used within SyncProvider');
  }
  return context;
}
