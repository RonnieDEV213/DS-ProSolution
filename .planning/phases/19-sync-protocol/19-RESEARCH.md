# Phase 19: Sync Protocol - Research

**Researched:** 2026-01-24
**Domain:** Offline-first sync UX, optimistic mutations, conflict resolution
**Confidence:** HIGH

## Summary

This phase adds user-facing sync status feedback on top of the existing Phase 18 IndexedDB + sync infrastructure. The core challenge is providing clear visibility into data synchronization state at both global (header indicator) and row-level (individual record badges), with robust offline resilience, automatic retry with backoff, and conflict resolution UI.

The project already has TanStack Query for mutations (with existing optimistic delete pattern), Dexie/IndexedDB for local persistence, and `useSyncRecords` hook that tracks sync status. Phase 19 extends this foundation with: (1) a sync status provider for global state, (2) a pending mutations table in IndexedDB for offline queue, (3) row-level sync status tracking, (4) retry logic with exponential backoff, and (5) conflict resolution modal.

**Primary recommendation:** Use React Context + TanStack Query's `useMutationState` for sync status tracking, a dedicated `_pending_mutations` IndexedDB table for offline queue, and `date-fns` (already installed) for relative timestamps.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.90.20 | Mutation state, optimistic updates | Already used, has `useMutationState` for tracking |
| dexie | ^4.2.1 | IndexedDB wrapper, offline queue | Already used for `_sync_meta`, extend for mutations |
| dexie-react-hooks | ^4.2.0 | `useLiveQuery` for reactive reads | Already used in `useSyncRecords` |
| date-fns | ^4.1.0 | `formatDistanceToNow` for "X ago" | Already installed, tree-shakeable |
| lucide-react | ^0.562.0 | Cloud/wifi icons | Already installed |
| framer-motion | ^12.25.0 | Animations for status transitions | Already installed |
| sonner | ^1.7.0 | Error toasts | Already installed |

### Supporting (No New Dependencies Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dialog | ^1.1.15 | Conflict resolution modal | Already have Dialog component |
| @radix-ui/react-tooltip | ^1.2.8 | Error message tooltips | Already have Tooltip component |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Context | Zustand | Zustand not needed - TanStack Query already provides mutation state |
| Custom retry | axios-retry | Not using axios, custom exponential backoff is simple |
| Dexie Cloud | Custom sync | Dexie Cloud is commercial, we have our own sync engine |

**Installation:**
```bash
# No new dependencies required - all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── hooks/sync/
│   ├── use-sync-records.ts       # Existing - extend with mutation tracking
│   ├── use-sync-status.ts        # NEW - global sync status hook
│   ├── use-online-status.ts      # NEW - navigator.onLine detection
│   └── use-pending-mutations.ts  # NEW - track pending offline mutations
├── components/
│   ├── sync/
│   │   ├── sync-status-indicator.tsx    # NEW - header sync icon
│   │   ├── sync-row-badge.tsx           # NEW - per-row sync status
│   │   └── conflict-resolution-modal.tsx # NEW - conflict UI
│   └── providers/
│       └── sync-provider.tsx            # NEW - sync context provider
└── lib/db/
    ├── index.ts          # Extend schema for _pending_mutations
    ├── sync.ts           # Extend with mutation queue functions
    └── conflicts.ts      # NEW - conflict detection/resolution
```

### Pattern 1: Pending Mutations Queue (IndexedDB Table)
**What:** Store mutations locally when offline, replay when online
**When to use:** All mutations (create, update, delete) go through this queue
**Example:**
```typescript
// Source: IndexedDB offline queue pattern
interface PendingMutation {
  id: string;              // UUID for the mutation
  record_id: string;       // ID of the record being mutated
  table: 'records' | 'accounts' | 'sellers';
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: string;       // ISO timestamp for ordering
  retry_count: number;
  last_error: string | null;
  status: 'pending' | 'in-flight' | 'failed';
}

// Dexie schema addition
db.version(2).stores({
  // ... existing tables
  _pending_mutations: 'id, record_id, table, status, timestamp',
});
```

### Pattern 2: Global Sync Status Provider
**What:** React Context that aggregates sync state from multiple sources
**When to use:** Provides sync status to header indicator and any component needing global sync awareness
**Example:**
```typescript
// Source: TanStack Query useMutationState pattern
interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  pendingCount: number;
  lastSyncAt: Date | null;
  error: string | null;
}

function SyncProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus();
  const pendingMutations = useMutationState({
    filters: { status: 'pending' },
    select: (m) => m.state.variables,
  });

  // Combine TanStack Query pending mutations with IndexedDB queue
  const queuedMutations = useLiveQuery(() =>
    db._pending_mutations.where('status').equals('pending').count()
  );

  const value: SyncState = {
    status: !isOnline ? 'offline' : pendingMutations.length > 0 ? 'syncing' : 'idle',
    pendingCount: (pendingMutations.length ?? 0) + (queuedMutations ?? 0),
    lastSyncAt: /* from _sync_meta */,
    error: null,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
```

### Pattern 3: Row-Level Sync Status
**What:** Track sync status per record in IndexedDB
**When to use:** Display pending/error badges on individual rows
**Example:**
```typescript
// Source: Row-level sync status pattern
// Extend BookkeepingRecord schema (or separate table)
interface RecordSyncStatus {
  record_id: string;       // Primary key
  status: 'synced' | 'pending' | 'error';
  error_message: string | null;
  pending_operation: 'create' | 'update' | 'delete' | null;
}

// Query in records table component
const syncStatuses = useLiveQuery(() =>
  db._pending_mutations
    .where('table').equals('records')
    .toArray()
    .then(mutations =>
      Object.fromEntries(mutations.map(m => [m.record_id, m.status]))
    )
);

// In RecordsTable, lookup status per row
const rowSyncStatus = syncStatuses?.[record.id] ?? 'synced';
```

### Pattern 4: Optimistic Mutation with Offline Queue
**What:** Apply change optimistically, queue for sync, rollback on permanent failure
**When to use:** All mutations
**Example:**
```typescript
// Source: TanStack Query optimistic updates + Dexie queue
const mutation = useMutation({
  mutationKey: ['records', 'update', recordId],
  mutationFn: async (data) => {
    if (!navigator.onLine) {
      // Queue for later
      await db._pending_mutations.add({
        id: crypto.randomUUID(),
        record_id: recordId,
        table: 'records',
        operation: 'update',
        data,
        timestamp: new Date().toISOString(),
        retry_count: 0,
        last_error: null,
        status: 'pending',
      });
      // Also update local IndexedDB immediately
      await db.records.update(recordId, data);
      return { ...existingRecord, ...data }; // Return optimistic result
    }
    return api.updateRecord(recordId, data);
  },
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey });
    const previousData = queryClient.getQueryData(queryKey);
    // Optimistic update
    queryClient.setQueryData(queryKey, (old) => ({...old, ...newData}));
    return { previousData };
  },
  onError: (err, _vars, context) => {
    // Rollback on error
    if (context?.previousData) {
      queryClient.setQueryData(queryKey, context.previousData);
    }
  },
  retry: 3,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
});
```

### Pattern 5: Conflict Detection
**What:** Compare local and server versions to detect conflicts
**When to use:** During sync when server returns updated_at newer than local
**Example:**
```typescript
// Source: Offline-first conflict resolution pattern
interface Conflict {
  record_id: string;
  local_version: BookkeepingRecord;
  server_version: BookkeepingRecord;
  conflicting_fields: string[];
}

function detectConflict(
  localRecord: BookkeepingRecord,
  serverRecord: BookkeepingRecord,
  pendingMutation: PendingMutation
): Conflict | null {
  // Server was updated after our local change
  if (new Date(serverRecord.updated_at) > new Date(pendingMutation.timestamp)) {
    const conflictingFields = Object.keys(pendingMutation.data).filter(
      key => localRecord[key] !== serverRecord[key]
    );
    if (conflictingFields.length > 0) {
      return {
        record_id: localRecord.id,
        local_version: localRecord,
        server_version: serverRecord,
        conflicting_fields: conflictingFields,
      };
    }
  }
  return null;
}
```

### Anti-Patterns to Avoid
- **Polling for sync status:** Use reactive `useLiveQuery` and `useMutationState`, not polling
- **Storing sync status in React state alone:** Must persist in IndexedDB to survive page reload
- **Silent conflict overwrite:** Per CONTEXT.md, conflicts must surface for user resolution
- **Retry without backoff:** Always use exponential backoff to avoid hammering failed endpoints
- **Blocking UI during sync:** Sync should be background; UI remains responsive

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Online/offline detection | Custom network checks | `navigator.onLine` + event listeners | Standard browser API, reliable |
| Relative time formatting | Custom date math | `date-fns.formatDistanceToNow` | Already installed, localized, edge cases handled |
| Mutation state tracking | Custom Map/Set | TanStack Query `useMutationState` | Built-in, handles concurrent mutations |
| Exponential backoff | Custom timers | TanStack Query `retryDelay` option | Configurable, integrates with mutation lifecycle |
| Modal focus management | Manual focus trap | Radix Dialog (already have) | Accessible, handles edge cases |
| Reactive IndexedDB reads | Manual subscriptions | Dexie `useLiveQuery` | Already used, handles re-renders efficiently |

**Key insight:** The project already has most tools needed. Phase 19 is primarily wiring existing capabilities together with new UI components, not adding new libraries.

## Common Pitfalls

### Pitfall 1: Race Conditions in Optimistic Updates
**What goes wrong:** Multiple rapid mutations on same record cause cache inconsistency
**Why it happens:** Optimistic update A finishes after B starts, overwrites B's optimistic state
**How to avoid:** Use TanStack Query's `cancelQueries` in `onMutate`, unique mutation keys per record
**Warning signs:** UI "flickers" between states, final state doesn't match last mutation

### Pitfall 2: Offline Queue Not Replayed in Order
**What goes wrong:** Update applied before create, delete before update
**Why it happens:** Parallel processing of queue items
**How to avoid:** Process queue sequentially, sort by timestamp
**Warning signs:** Server returns 404 for records that should exist

### Pitfall 3: Stale "Last Synced" Timestamp
**What goes wrong:** Shows "2 hours ago" when sync just completed
**Why it happens:** Timestamp not updated after successful sync
**How to avoid:** Update `_sync_meta.last_sync_at` on every successful sync completion
**Warning signs:** Timestamp never updates even when data changes

### Pitfall 4: Memory Leak from Online/Offline Listeners
**What goes wrong:** Multiple event listeners accumulate on navigation
**Why it happens:** `useEffect` cleanup not removing listeners
**How to avoid:** Always return cleanup function that removes both `online` and `offline` listeners
**Warning signs:** Performance degradation over time, duplicate events firing

### Pitfall 5: Conflict Modal Blocks Unrelated Work
**What goes wrong:** User can't do anything while conflict modal is open
**Why it happens:** Modal blocks entire UI for single-record conflict
**How to avoid:** Per CONTEXT.md, this is acceptable ("blocks until resolved"), but provide "apply to all" for bulk conflicts
**Warning signs:** N/A - this is intentional per user decision

### Pitfall 6: Retry Storm After Network Recovery
**What goes wrong:** All queued mutations fire simultaneously, overwhelming server
**Why it happens:** Online event triggers all retries at once
**How to avoid:** Process queue sequentially with delays between items
**Warning signs:** Server rate limiting errors after coming online

## Code Examples

Verified patterns from official sources:

### Online/Offline Detection Hook
```typescript
// Source: React official useSyncExternalStore pattern
import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
```

### Exponential Backoff with TanStack Query
```typescript
// Source: TanStack Query v5 mutation retry docs
const mutation = useMutation({
  mutationFn: updateRecord,
  retry: (failureCount, error) => {
    // Only retry on network/server errors, not validation
    if (error instanceof NetworkError || error.status >= 500) {
      return failureCount < 3; // Max 3 retries per CONTEXT.md
    }
    return false;
  },
  retryDelay: (attemptIndex) => {
    // Exponential: 1s, 2s, 4s (capped at 30s)
    return Math.min(1000 * 2 ** attemptIndex, 30000);
  },
});
```

### Relative Time Display
```typescript
// Source: date-fns formatDistanceToNow
import { formatDistanceToNow } from 'date-fns';

function LastSyncedTime({ timestamp }: { timestamp: string | null }) {
  if (!timestamp) return null;

  const relativeTime = formatDistanceToNow(new Date(timestamp), {
    addSuffix: true
  });

  return <span className="text-gray-400 text-sm">Last synced {relativeTime}</span>;
}
```

### Tracking Pending Mutations Globally
```typescript
// Source: TanStack Query v5 useMutationState docs
import { useMutationState } from '@tanstack/react-query';

function usePendingRecordMutations() {
  const pendingUpdates = useMutationState({
    filters: {
      mutationKey: ['records'],
      status: 'pending'
    },
    select: (mutation) => ({
      recordId: mutation.state.variables?.id,
      operation: mutation.state.context?.operation,
    }),
  });

  return pendingUpdates;
}
```

### Sync Status Icons (Lucide)
```typescript
// Source: Lucide React icons
import { Cloud, CloudOff, Loader2, AlertCircle, Check } from 'lucide-react';

function SyncStatusIcon({ status }: { status: SyncState['status'] }) {
  switch (status) {
    case 'syncing':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    case 'offline':
      return <CloudOff className="h-4 w-4 text-yellow-400" />;
    case 'idle':
    default:
      return null; // Hidden when synced per CONTEXT.md
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom mutation tracking | TanStack Query `useMutationState` | v5 (2023) | No need for custom state management |
| Polling for online status | `useSyncExternalStore` + events | React 18 (2022) | Cleaner, no memory leaks |
| Manual cache updates | TanStack Query optimistic updates | Always available | Less boilerplate |
| Custom IndexedDB wrappers | Dexie `useLiveQuery` | Dexie 4.x | Reactive without subscriptions |

**Deprecated/outdated:**
- **useOnline from @rehooks/online-status:** Can use built-in `useSyncExternalStore` instead
- **react-detect-offline:** Unnecessary with native hooks

## Open Questions

Things that couldn't be fully resolved:

1. **Merge Strategy for Conflicts**
   - What we know: "Keep mine" / "Keep theirs" are straightforward
   - What's unclear: How "Merge" should work - field-by-field selection? Automatic merge rules?
   - Recommendation: For MVP, "Merge" opens field-level selection; user picks each field. Defer smart merge.

2. **Conflict Detection Timing**
   - What we know: Conflicts occur when server version is newer
   - What's unclear: Should we check for conflicts before mutation attempt, or only on 409 response?
   - Recommendation: Check on sync response - simpler, handles server-side concurrent edits

3. **Offline Queue Size Limit**
   - What we know: Queue needs to persist across sessions
   - What's unclear: What happens if user makes thousands of offline changes?
   - Recommendation: Set reasonable limit (e.g., 1000 pending mutations), warn user if exceeded

## Sources

### Primary (HIGH confidence)
- TanStack Query v5 Mutations docs - optimistic updates, useMutationState, retry configuration
- Dexie.js Documentation - IndexedDB patterns, useLiveQuery
- React v18 useSyncExternalStore - online/offline detection
- date-fns v4 formatDistanceToNow - relative time formatting

### Secondary (MEDIUM confidence)
- [TanStack Query Optimistic Updates Guide](https://tanstack.com/query/v5/docs/react/guides/mutations)
- [Lucide Icons - Cloud sync, Cloud-off](https://lucide.dev/icons/cloud-sync)
- [Offline-first IndexedDB patterns - LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)

### Tertiary (LOW confidence)
- Community patterns for row-level sync status (various blog posts)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and verified
- Architecture: HIGH - patterns derived from existing codebase patterns
- Pitfalls: MEDIUM - based on common offline-first issues, may discover more during implementation

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (stable stack, 30 days)
