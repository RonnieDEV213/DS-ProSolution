import { db, type PendingMutation } from './index';
import { api } from '@/lib/api';
import { detectConflict, type Conflict } from './conflicts';

/**
 * Add a mutation to the offline queue.
 * Called when mutation attempted while offline.
 */
export async function queueMutation(
  mutation: Omit<PendingMutation, 'id' | 'timestamp' | 'retry_count' | 'last_error' | 'status'>
): Promise<string> {
  const id = crypto.randomUUID();
  await db._pending_mutations.add({
    ...mutation,
    id,
    timestamp: new Date().toISOString(),
    retry_count: 0,
    last_error: null,
    status: 'pending',
  });
  return id;
}

/**
 * Get pending mutation for a specific record.
 * Returns most recent pending/failed mutation if exists.
 */
export async function getPendingForRecord(
  recordId: string
): Promise<PendingMutation | null> {
  const mutations = await db._pending_mutations
    .where('record_id')
    .equals(recordId)
    .filter(m => m.status === 'pending' || m.status === 'failed')
    .sortBy('timestamp');
  return mutations[mutations.length - 1] ?? null;
}

/**
 * Callback type for conflict detection during queue processing.
 * The caller (SyncProvider) passes this to handle conflicts via UI.
 */
export type OnConflictCallback = (conflict: Conflict) => void;

/**
 * Process the offline queue sequentially.
 * Called when network comes back online.
 *
 * @param onConflict - Callback invoked when a conflict is detected.
 *   The mutation is paused (left as 'pending') and the conflict is passed
 *   to the callback for user resolution via SyncProvider.addConflict.
 */
export async function processQueue(
  onConflict?: OnConflictCallback
): Promise<{ processed: number; failed: number; conflicts: number }> {
  let processed = 0;
  let failed = 0;
  let conflicts = 0;

  // Get all pending mutations in timestamp order
  const pending = await db._pending_mutations
    .where('status')
    .equals('pending')
    .sortBy('timestamp');

  for (const mutation of pending) {
    // Mark as in-flight
    await db._pending_mutations.update(mutation.id, { status: 'in-flight' });

    try {
      // For updates, check for conflict before applying
      if (mutation.operation === 'update') {
        // Get the current IndexedDB record to detect conflicts
        const localRecord = await db.records.get(mutation.record_id);
        if (localRecord) {
          const conflict = detectConflict(mutation, localRecord);
          if (conflict) {
            // Conflict detected - pause this mutation for user resolution
            await db._pending_mutations.update(mutation.id, { status: 'pending' });
            if (onConflict) {
              onConflict(conflict);
            }
            conflicts++;
            continue; // Skip to next mutation, this one awaits resolution
          }
        }
      }

      // Execute mutation against API
      await executeMutation(mutation);

      // Success - remove from queue
      await db._pending_mutations.delete(mutation.id);
      processed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const newRetryCount = mutation.retry_count + 1;

      // Check if this is a 4xx error (validation error - don't retry per 19-02 decision)
      const is4xxError = errorMessage.includes('400') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403') ||
        errorMessage.includes('404') ||
        errorMessage.includes('422');

      if (is4xxError || newRetryCount >= 3) {
        // Max retries reached or client error - mark as failed
        await db._pending_mutations.update(mutation.id, {
          status: 'failed',
          retry_count: newRetryCount,
          last_error: errorMessage,
        });
        failed++;
      } else {
        // Will retry later
        await db._pending_mutations.update(mutation.id, {
          status: 'pending',
          retry_count: newRetryCount,
          last_error: errorMessage,
        });
      }
    }

    // Small delay between operations to avoid overwhelming server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { processed, failed, conflicts };
}

/**
 * Execute a single mutation against the API.
 */
async function executeMutation(mutation: PendingMutation): Promise<void> {
  switch (mutation.operation) {
    case 'create': {
      // Create expects RecordCreate type - cast through unknown for flexibility
      const createData = mutation.data as unknown as Parameters<typeof api.createRecord>[0];
      await api.createRecord(createData);
      break;
    }
    case 'update': {
      const updateData = mutation.data as Parameters<typeof api.updateRecord>[1];
      await api.updateRecord(mutation.record_id, updateData);
      break;
    }
    case 'delete':
      await api.deleteRecord(mutation.record_id);
      break;
  }
}

/**
 * Retry a failed mutation manually.
 */
export async function retryMutation(mutationId: string): Promise<boolean> {
  const mutation = await db._pending_mutations.get(mutationId);
  if (!mutation || mutation.status !== 'failed') return false;

  await db._pending_mutations.update(mutationId, { status: 'pending' });
  const result = await processQueue();
  return result.processed > 0;
}

/**
 * Remove a failed mutation (user chose to discard).
 */
export async function discardMutation(mutationId: string): Promise<void> {
  await db._pending_mutations.delete(mutationId);
}
