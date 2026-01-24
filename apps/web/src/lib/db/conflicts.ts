import { db, type BookkeepingRecord, type PendingMutation } from './index';
import type { RecordSyncItem } from '@/lib/api';

export interface Conflict {
  id: string;                    // Unique conflict ID
  record_id: string;
  mutation_id: string;           // Reference to pending mutation
  local_values: Record<string, unknown>;
  server_values: Record<string, unknown>;
  conflicting_fields: string[];  // Only fields that actually differ
  created_at: string;
}

/**
 * Detect if a conflict exists between local pending mutation and server state.
 * Called from processQueue when comparing against fresh server data.
 *
 * @param pendingMutation - The queued local mutation
 * @param serverRecord - Fresh record from api.syncRecords (has updated_at)
 */
export function detectConflict(
  pendingMutation: PendingMutation,
  serverRecord: RecordSyncItem
): Conflict | null {
  // Only updates can conflict (creates are new, deletes are binary)
  if (pendingMutation.operation !== 'update') return null;

  // Check if server was updated after our local change
  if (new Date(serverRecord.updated_at) <= new Date(pendingMutation.timestamp)) {
    return null; // No conflict - our change is newer
  }

  // Find fields that actually conflict (both changed, different values)
  const mutatedFields = Object.keys(pendingMutation.data);
  const conflictingFields: string[] = [];
  const localValues: Record<string, unknown> = {};
  const serverValues: Record<string, unknown> = {};

  for (const field of mutatedFields) {
    const localValue = pendingMutation.data[field];
    const serverValue = serverRecord[field as keyof RecordSyncItem];

    // Only conflict if values actually differ
    if (!deepEqual(localValue, serverValue)) {
      conflictingFields.push(field);
      localValues[field] = localValue;
      serverValues[field] = serverValue;
    }
  }

  if (conflictingFields.length === 0) {
    return null; // Same values - no real conflict
  }

  return {
    id: crypto.randomUUID(),
    record_id: pendingMutation.record_id,
    mutation_id: pendingMutation.id,
    local_values: localValues,
    server_values: serverValues,
    conflicting_fields: conflictingFields,
    created_at: new Date().toISOString(),
  };
}

export type Resolution = 'keep-mine' | 'keep-theirs' | 'merge';

export interface MergeSelection {
  [field: string]: 'local' | 'server';
}

/**
 * Resolve a conflict by applying the chosen resolution.
 */
export async function resolveConflict(
  conflict: Conflict,
  resolution: Resolution,
  mergeSelection?: MergeSelection
): Promise<void> {
  const record = await db.records.get(conflict.record_id);
  if (!record) return;

  let resolvedData: Partial<BookkeepingRecord>;

  switch (resolution) {
    case 'keep-mine':
      // Apply local values to IndexedDB (will sync to server)
      resolvedData = conflict.local_values as Partial<BookkeepingRecord>;
      break;

    case 'keep-theirs':
      // Apply server values to IndexedDB
      resolvedData = conflict.server_values as Partial<BookkeepingRecord>;
      break;

    case 'merge':
      // Apply field-by-field selection
      if (!mergeSelection) {
        throw new Error('Merge selection required for merge resolution');
      }
      resolvedData = {};
      for (const field of conflict.conflicting_fields) {
        const choice = mergeSelection[field] ?? 'server';
        const value = choice === 'local'
          ? conflict.local_values[field]
          : conflict.server_values[field];
        // Use type assertion since we know these are valid BookkeepingRecord fields
        (resolvedData as Record<string, unknown>)[field] = value;
      }
      break;
  }

  // Update local record
  await db.records.update(conflict.record_id, {
    ...resolvedData,
    updated_at: new Date().toISOString(),
  });

  // Remove the pending mutation that caused conflict
  await db._pending_mutations.delete(conflict.mutation_id);
}

/**
 * Deep equality check for conflict detection.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
}
