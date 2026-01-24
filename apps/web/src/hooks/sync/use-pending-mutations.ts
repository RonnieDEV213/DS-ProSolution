'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PendingMutation } from '@/lib/db';

/**
 * Get all pending/failed mutations for records in the current view.
 * Returns a Map of recordId -> PendingMutation for quick lookup.
 *
 * Uses Dexie's useLiveQuery for reactive updates when IndexedDB changes.
 */
export function usePendingMutations(
  table: 'records' | 'accounts' | 'sellers' = 'records'
): Map<string, PendingMutation> {
  const result = useLiveQuery(
    async () => {
      const mutations = await db._pending_mutations
        .where('table')
        .equals(table)
        .filter(m => m.status === 'pending' || m.status === 'failed' || m.status === 'in-flight')
        .toArray();

      return new Map(mutations.map(m => [m.record_id, m]));
    },
    [table],
    new Map<string, PendingMutation>()
  );

  // useLiveQuery can return undefined during initial load
  return result ?? new Map<string, PendingMutation>();
}
