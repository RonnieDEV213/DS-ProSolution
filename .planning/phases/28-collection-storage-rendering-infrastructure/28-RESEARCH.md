# Phase 28: Collection Storage & Rendering Infrastructure - Research

**Researched:** 2026-01-27
**Domain:** Mirroring v3 bookkeeping sync/render infrastructure for collection (sellers) feature
**Confidence:** HIGH

## Summary

Phase 28 brings the v3 bookkeeping infrastructure (Phases 15-21) to the collection feature. The v3 milestone built cursor-based pagination, TanStack Query caching, IndexedDB persistence via Dexie.js, incremental sync with conflict resolution, virtualized rendering with react-window v2, and streaming export. All of this currently serves only bookkeeping records. The collection feature (primarily the SellersGrid component) still uses direct Supabase fetch calls, manual state management, and lacks offline support, background sync, or query caching.

The research examined every existing v3 infrastructure file in detail. The key finding is that **most of the heavy lifting is already done**. The infrastructure is well-architected for extension: the Dexie database singleton already includes a `sellers` table, the sync endpoint `/sync/sellers` already exists with cursor pagination, and the `syncSellers()` function in `lib/db/sync.ts` already handles incremental sync for sellers. What is missing is the wiring: the SellersGrid component does not use any of this infrastructure. It fetches sellers directly via `fetch()` against `${API_BASE}/sellers?limit=100000`, manages state locally with `useState`, and has no cache, no persistence, no background sync, no offline support, and no TanStack Query integration.

The SellersGrid also has collection-specific functionality (flag painting, drag selection, bulk operations, export with flagging) that must be preserved while migrating to the sync infrastructure. The virtualized Grid component from react-window v2 is already in use for SellersGrid, so the rendering layer is partially done -- but it needs to be backed by IndexedDB rather than ephemeral state.

**Primary recommendation:** Wire the existing v3 sync infrastructure into the collection feature. Create `useSyncSellers` hook mirroring `useSyncRecords`, add sellers to TanStack Query key factory, create collection-specific mutation hooks, add a `/sync/collection-items` endpoint for collection run data, and migrate SellersGrid from direct fetch to cache-first reads.

## Standard Stack

The established libraries/tools for this domain:

### Core (All Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.90.20 | Server state management, mutations | Already used for bookkeeping, extend for sellers |
| dexie | ^4.2.1 | IndexedDB persistence | Already has sellers table defined |
| dexie-react-hooks | ^4.2.0 | Reactive reads via useLiveQuery | Already used in useSyncRecords |
| react-window | ^2.2.5 | Virtualized Grid/List | Already used in SellersGrid |
| react-window-infinite-loader | ^2.0.1 | Infinite scroll | Already used in VirtualizedRecordsList |
| react-intersection-observer | ^10.0.2 | Prefetch triggers | Already used in bookkeeping |

### Backend (All Already Available)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI StreamingResponse | Built-in | Streaming CSV/JSON export | Already used for bookkeeping export |
| pagination.py | Existing | Cursor encode/decode | Already works for sellers sync endpoint |
| sync.py router | Existing | `/sync/sellers` endpoint | Already implements cursor pagination for sellers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 | Relative timestamps | Already used for sync status display |
| sonner | ^1.7.4 | Toast notifications | Already used throughout |
| lucide-react | ^0.562.0 | Icons | Already used throughout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending existing Dexie schema | New separate database | Complexity; single DB is better for consistency |
| useSyncSellers (new hook) | Modifying SellersGrid inline | Hook is reusable, testable, matches existing pattern |
| Server streaming export | Client-side export (current) | Server streaming handles large datasets; client-side is fine for sellers < 100K |

**Installation:**
```bash
# No new packages required - all libraries already installed
```

## Architecture Patterns

### What Already Exists (v3 Infrastructure)

```
apps/web/src/
  lib/
    db/
      index.ts           # Dexie singleton - HAS sellers table already
      schema.ts           # SellerRecord type already defined
      sync.ts             # syncSellers() function already works
      pending-mutations.ts # Offline queue - supports 'sellers' table type
      conflicts.ts        # Conflict detection (records-focused, needs extension)
      init.ts             # DB initialization with version check
    api.ts               # SyncParams, SyncResponse, syncSellers() already defined
    query-keys.ts        # NO sellers keys yet (only accounts, records)
  hooks/
    sync/
      use-sync-records.ts  # Template for useSyncSellers
      use-sync-status.ts   # Global sync status (already includes sellers)
      use-online-status.ts # Network detection
      use-pending-mutations.ts # Per-table pending mutations
      use-prefetch-on-scroll.ts # Scroll-based prefetch

apps/api/src/app/
  routers/
    sync.py              # /sync/sellers endpoint exists, fully functional
    export.py            # Streaming exports for bookkeeping (template for sellers)
  pagination.py          # Cursor encode/decode
```

### What Needs to Be Built

```
apps/web/src/
  lib/
    query-keys.ts        # ADD sellers keys (all, list, infinite, filters)
  hooks/
    sync/
      use-sync-sellers.ts   # NEW: Cache-first seller reads via IndexedDB
    queries/
      use-sellers-infinite.ts # NEW: TanStack useInfiniteQuery for sellers
    mutations/
      use-flag-seller.ts     # NEW: Optimistic flag toggle with offline queue
      use-update-seller.ts   # NEW: Optimistic name update with offline queue
      use-delete-seller.ts   # NEW: Bulk delete with offline queue
      use-create-seller.ts   # NEW: Add seller(s) with sync
  components/
    admin/collection/
      sellers-grid.tsx       # REFACTOR: Replace fetch() with useSyncSellers

apps/api/src/app/
  routers/
    export.py            # ADD /export/sellers/csv and /export/sellers/json
```

### Pattern 1: useSyncSellers Hook (Mirroring useSyncRecords)
**What:** Cache-first hook returning sellers from IndexedDB, with background sync
**When to use:** Everywhere the SellersGrid needs seller data
**Example:**
```typescript
// src/hooks/sync/use-sync-sellers.ts
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, useCallback } from 'react';
import { db, type SellerRecord } from '@/lib/db';
import { syncSellers } from '@/lib/db/sync';

interface UseSyncSellersOptions {
  filters?: {
    flagged?: boolean;
    search?: string;
  };
}

interface UseSyncSellersResult {
  sellers: SellerRecord[];
  isLoading: boolean;
  isSyncing: boolean;
  error: Error | null;
  totalCount: number;
  flaggedCount: number;
  refetch: () => void;
}

export function useSyncSellers({ filters }: UseSyncSellersOptions = {}): UseSyncSellersResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const syncingRef = useRef(false);

  // Live query - reactive to IndexedDB changes
  const sellers = useLiveQuery(async () => {
    let results = await db.sellers.toArray();

    // Apply filters in memory (Dexie indexes help, but complex filters need memory)
    return results.filter((s) => {
      if (filters?.flagged !== undefined && s.flagged !== filters.flagged) return false;
      if (filters?.search) {
        const term = filters.search.toLowerCase();
        if (!s.display_name.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [filters?.flagged, filters?.search]);

  const totalCount = useLiveQuery(() => db.sellers.count(), []) ?? 0;
  const flaggedCount = useLiveQuery(
    () => db.sellers.where('flagged').equals(1).count(),  // Dexie stores booleans as 0/1
    []
  ) ?? 0;

  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      await syncSellers();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Sync failed'));
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // Background sync on mount
  useEffect(() => {
    doSync();
  }, [doSync]);

  return {
    sellers: sellers ?? [],
    isLoading: sellers === undefined,
    isSyncing,
    error,
    totalCount,
    flaggedCount,
    refetch: doSync,
  };
}
```

### Pattern 2: Seller Mutation Hooks with Offline Queue
**What:** TanStack mutations with optimistic updates, IndexedDB persistence, offline queue
**When to use:** All seller create/update/delete/flag operations
**Example:**
```typescript
// src/hooks/mutations/use-flag-seller.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { useOnlineStatus } from '@/hooks/sync/use-online-status';
import { queueMutation } from '@/lib/db/pending-mutations';

export function useFlagSeller() {
  const isOnline = useOnlineStatus();

  return useMutation({
    mutationFn: async ({ id, flagged }: { id: string; flagged: boolean }) => {
      // Optimistically update IndexedDB immediately
      await db.sellers.update(id, { flagged });

      if (!isOnline) {
        await queueMutation({
          record_id: id,
          table: 'sellers',
          operation: 'update',
          data: { flagged },
        });
        return;
      }

      // Call API when online
      const token = await getAccessToken();
      await fetch(`${API_BASE}/sellers/${id}/flag`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    },
  });
}
```

### Pattern 3: Query Key Factory Extension
**What:** Add sellers to existing query key factory
**When to use:** All seller queries for consistent cache invalidation
**Example:**
```typescript
// Addition to src/lib/query-keys.ts
export interface SellerFilters {
  flagged?: boolean;
  search?: string;
}

export const queryKeys = {
  // ... existing accounts, records ...

  sellers: {
    all: (orgId: string) => ['sellers', orgId] as const,
    list: (orgId: string, filters?: SellerFilters) =>
      ['sellers', orgId, 'list', filters] as const,
    infinite: (orgId: string, filters?: SellerFilters) =>
      ['sellers', orgId, 'infinite', filters] as const,
  },
} as const;
```

### Pattern 4: SellersGrid Migration Strategy
**What:** Replace direct fetch with useSyncSellers, keep all existing UI/interaction
**When to use:** The main SellersGrid refactoring task
**Key insight:** The current SellersGrid already uses react-window v2 Grid. The migration changes the data source, not the rendering.

Current pattern (to replace):
```typescript
// CURRENT: Direct fetch, ephemeral state
const [sellers, setSellers] = useState<Seller[]>([]);
const fetchSellers = useCallback(async () => {
  const response = await fetch(`${API_BASE}/sellers?limit=100000`);
  setSellers(data.sellers || []);
}, []);
```

New pattern:
```typescript
// NEW: Cache-first via IndexedDB + background sync
const { sellers, isLoading, isSyncing, refetch, totalCount, flaggedCount } =
  useSyncSellers({ filters: { search: searchTerm } });
```

### Pattern 5: Streaming Seller Export (Server-Side)
**What:** Add streaming CSV/JSON export endpoints for sellers
**When to use:** When exporting large seller lists (>10K sellers)
**Example:**
```python
# Addition to apps/api/src/app/routers/export.py
@router.get("/sellers/csv")
async def export_sellers_csv(
    flagged: Optional[bool] = Query(None),
    user: dict = Depends(require_permission_key("seller_collection.read")),
):
    supabase = get_supabase_for_user(user["token"])
    return StreamingResponse(
        generate_sellers_csv(supabase, flagged),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sellers.csv"},
    )
```

### Anti-Patterns to Avoid
- **Fetching all sellers via REST then storing in state:** This is what the current SellersGrid does (`?limit=100000`). Replace with sync infrastructure.
- **Mixing IndexedDB source with useState source:** SellersGrid currently uses `useState` as truth. After migration, IndexedDB (via `useLiveQuery`) must be the single source of truth.
- **Creating new Dexie tables for collection data:** The sellers table already exists in the Dexie schema. Use it.
- **Breaking existing SellersGrid interactions:** Flag painting, drag selection, bulk delete, export - all must continue working after migration.
- **Bumping SCHEMA_VERSION unnecessarily:** Adding indexes to existing tables requires a version bump, but if only code changes are needed, keep version 2.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Seller sync from server | New fetch logic | Existing `syncSellers()` in `lib/db/sync.ts` | Already handles cursor pagination, soft deletes, checkpoints |
| Seller IndexedDB storage | New table definition | Existing `db.sellers` table in Dexie schema | Already defined with proper indexes |
| Offline mutation queue | Custom queue | Existing `queueMutation()` in `pending-mutations.ts` | Already supports `'sellers'` table type |
| Cursor pagination | New cursor logic | Existing `pagination.py` + `/sync/sellers` endpoint | Already fully functional |
| Reactive data reads | Manual subscriptions | `useLiveQuery` from dexie-react-hooks | Already used in bookkeeping, handles re-renders |
| Online/offline detection | Custom checks | Existing `useOnlineStatus` hook | Already implemented with `useSyncExternalStore` |
| Global sync status | New status tracking | Existing `useSyncStatus` hook | Already aggregates from all tables |
| Conflict detection | New logic | Existing `detectConflict()` in `conflicts.ts` | Needs minor extension for seller fields |

**Key insight:** The entire v3 infrastructure was designed to be entity-agnostic. The sync engine, offline queue, and conflict detection all work with generic tables. Phase 28 is primarily about *wiring*, not *building*.

## Common Pitfalls

### Pitfall 1: SellersGrid State vs IndexedDB Source of Truth Conflict
**What goes wrong:** After migration, `setSellers()` calls update local state but not IndexedDB, causing data to be out of sync.
**Why it happens:** The current SellersGrid has ~15 places that call `setSellers()` directly (for optimistic updates).
**How to avoid:** Replace all `setSellers()` with IndexedDB mutations (`db.sellers.update()`, `db.sellers.bulkPut()`). The `useLiveQuery` will reactively update the UI.
**Warning signs:** UI shows different data than IndexedDB, data reverts after page reload.

### Pitfall 2: Dexie Boolean Index Quirk
**What goes wrong:** `db.sellers.where('flagged').equals(true)` returns nothing.
**Why it happens:** Dexie/IndexedDB stores booleans as 0/1 in indexes. The `where` clause needs `equals(1)` for `true`.
**How to avoid:** Use `db.sellers.where('flagged').equals(1)` or filter in memory after `toArray()`.
**Warning signs:** Flagged count always shows 0, flag filters return empty results.

### Pitfall 3: Breaking Drag Selection During Migration
**What goes wrong:** Drag selection breaks because the sellers array reference changes on every sync.
**Why it happens:** `useLiveQuery` returns a new array instance on every IndexedDB change. Drag selection callbacks that captured the old array reference lose track.
**How to avoid:** Use `useRef` to track the current sellers array for drag callbacks (the existing pattern already does this with `sellersRef`). Ensure the ref is updated when useLiveQuery returns new data.
**Warning signs:** Drag-selected sellers disappear or wrong sellers are selected after a background sync.

### Pitfall 4: Export with Flag Auto-Set Needs IndexedDB Update
**What goes wrong:** Export flags sellers optimistically via `setSellers()`, but IndexedDB doesn't reflect this.
**Why it happens:** Current export code updates local state but not IndexedDB.
**How to avoid:** After flagging exported sellers, use `db.sellers.bulkUpdate()` to persist to IndexedDB, then let `useLiveQuery` propagate the change.
**Warning signs:** Flagged sellers appear unflagged after page reload.

### Pitfall 5: Schema Version Bump When Adding Collection Items Table
**What goes wrong:** Adding a new table (e.g., `collection_items`) to Dexie requires bumping SCHEMA_VERSION, which wipes all local data.
**Why it happens:** Dexie version upgrade mechanism.
**How to avoid:** If a new table is needed, bump `SCHEMA_VERSION` to 3 in `lib/db/index.ts`. The `initializeDatabase()` function will handle the wipe and resync. Make this a deliberate early step, not a surprise mid-implementation.
**Warning signs:** "Schema version changed, clearing IndexedDB" log message unexpectedly appearing.

### Pitfall 6: 100K Seller Limit in Current Implementation
**What goes wrong:** Current SellersGrid fetches `?limit=100000` which works but defeats the purpose of cursor pagination.
**Why it happens:** Simple implementation before sync infrastructure existed.
**How to avoid:** With the sync infrastructure, all sellers are incrementally synced to IndexedDB. The `useLiveQuery` reads from local cache, so there's no single-request limit. The sync endpoint fetches in batches of 100 via cursor pagination.
**Warning signs:** N/A - this is the fix, not a problem.

### Pitfall 7: PendingMutation Table Type Must Support Seller Operations
**What goes wrong:** Seller mutations fail to queue because the `table` field doesn't include seller operation types.
**Why it happens:** The PendingMutation interface already supports `'sellers'` but the `executeMutation()` function only handles `api.createRecord`, `api.updateRecord`, `api.deleteRecord`.
**How to avoid:** Extend `executeMutation()` in `pending-mutations.ts` to handle seller-specific API calls (`api.flagSeller`, `api.updateSeller`, `api.deleteSeller`).
**Warning signs:** Offline mutations for sellers silently fail when replayed.

## Code Examples

### Existing syncSellers() - Already Functional
```typescript
// Source: lib/db/sync.ts (already implemented)
export async function syncSellers(): Promise<SyncResult> {
  const metaKey = 'sellers';
  const meta = await db._sync_meta.get(metaKey);
  // ... full cursor pagination, soft delete handling, checkpoint tracking
  // This function ALREADY WORKS. Phase 28 just needs to call it from a hook.
}
```

### Existing /sync/sellers Endpoint - Already Functional
```python
# Source: apps/api/src/app/routers/sync.py (already implemented)
@router.get("/sellers", response_model=SellerSyncResponse)
async def sync_sellers(
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    updated_since: Optional[datetime] = Query(None),
    include_deleted: bool = Query(False),
    flagged: Optional[bool] = Query(None),
    user: dict = Depends(require_permission_key("seller_collection.read")),
):
    # Full cursor-based pagination with all filters
    # This endpoint ALREADY WORKS.
```

### Existing Dexie Schema - Sellers Table Ready
```typescript
// Source: lib/db/index.ts (already implemented)
db.version(SCHEMA_VERSION).stores({
  accounts: 'id, account_code, updated_at',
  records: 'id, account_id, [account_id+sale_date], updated_at',
  sellers: 'id, normalized_name, flagged, updated_at',  // ALREADY EXISTS
  _sync_meta: 'table_name',
  _pending_mutations: 'id, record_id, table, status, timestamp',
});
```

### executeMutation Extension for Sellers
```typescript
// Source: Extension needed in lib/db/pending-mutations.ts
async function executeMutation(mutation: PendingMutation): Promise<void> {
  switch (mutation.table) {
    case 'records':
      // ... existing record mutation handling ...
      break;

    case 'sellers':
      switch (mutation.operation) {
        case 'create': {
          const name = mutation.data.name as string;
          await api.createSeller(name);
          break;
        }
        case 'update': {
          if ('flagged' in mutation.data) {
            await api.flagSeller(mutation.record_id);
          } else if ('name' in mutation.data) {
            await api.updateSeller(mutation.record_id, mutation.data.name as string);
          }
          break;
        }
        case 'delete':
          await api.deleteSeller(mutation.record_id);
          break;
      }
      break;
  }
}
```

### SellersGrid Data Source Migration
```typescript
// BEFORE (current SellersGrid):
const [sellers, setSellers] = useState<Seller[]>([]);
const fetchSellers = useCallback(async () => {
  const response = await fetch(`${API_BASE}/sellers?limit=100000`);
  const data = await response.json();
  setSellers(data.sellers || []);
}, []);

// AFTER (with sync infrastructure):
const {
  sellers,
  isLoading,
  isSyncing,
  refetch,
  totalCount,
  flaggedCount,
} = useSyncSellers({
  filters: {
    search: searchTerm || undefined,
  },
});
// sellers is reactive - automatically updates when IndexedDB changes
// No need for setSellers, fetchSellers, or manual state management
```

### Optimistic Flag Update via IndexedDB
```typescript
// BEFORE (current SellersGrid):
setSellers(prev => prev.map(s =>
  s.id === seller.id ? { ...s, flagged: newFlagged } : s
));
await fetch(`${API_BASE}/sellers/${seller.id}/flag`, { ... });

// AFTER (with sync infrastructure):
await db.sellers.update(seller.id, { flagged: newFlagged });
// useLiveQuery automatically re-renders with new data
// If offline, also queue the mutation:
if (!isOnline) {
  await queueMutation({
    record_id: seller.id,
    table: 'sellers',
    operation: 'update',
    data: { flagged: newFlagged },
  });
}
// When online, API call happens via mutation hook
flagMutation.mutate({ id: seller.id, flagged: newFlagged });
```

## State of the Art

| Old Approach (Current SellersGrid) | New Approach (Phase 28) | Impact |
|-------------------------------------|-------------------------|--------|
| `fetch(sellers?limit=100000)` single request | Cursor-paginated incremental sync via IndexedDB | No more loading all sellers at once |
| `useState<Seller[]>` ephemeral state | `useLiveQuery` reading from IndexedDB | Persists across page reloads |
| No offline support | Offline queue via `_pending_mutations` | Users can flag/edit sellers offline |
| No background sync | Automatic incremental sync on mount | Only fetches changed sellers |
| Manual `setSellers()` optimistic updates | IndexedDB update + reactive `useLiveQuery` | Single source of truth |
| Client-side-only CSV export | Option for streaming server-side export | Handles large seller lists |
| No TanStack Query cache | Query key factory + cache invalidation | Consistent cache management |
| No sync status indicator | Global `useSyncStatus` already includes sellers | Users see sync state |

## Task Decomposition Guidance

The work naturally breaks into these task groups, ordered by dependency:

### Group 1: Foundation (No UI Changes)
1. **Extend query-keys.ts** - Add sellers keys
2. **Extend pending-mutations.ts** - Handle seller operations in `executeMutation()`
3. **Add seller API functions** to `api.ts` (createSeller, updateSeller, deleteSeller, flagSeller) - some exist as raw fetch, need to be formalized

### Group 2: Hooks (Data Layer)
4. **Create useSyncSellers hook** - Mirrors useSyncRecords
5. **Create seller mutation hooks** - useFlagSeller, useUpdateSeller, useDeleteSeller, useCreateSeller
6. **Create useSellersInfinite hook** - TanStack useInfiniteQuery for sellers (optional, may not need if useLiveQuery is sufficient)

### Group 3: SellersGrid Migration
7. **Replace SellersGrid data source** - useSyncSellers instead of fetch+useState
8. **Replace SellersGrid mutations** - Mutation hooks instead of direct fetch
9. **Preserve all interaction patterns** - Flag painting, drag selection, bulk ops
10. **Test offline capabilities** - Verify mutations queue and replay

### Group 4: Server-Side Export
11. **Add /export/sellers/csv endpoint** - Streaming CSV export
12. **Add /export/sellers/json endpoint** - Streaming JSON export
13. **Update SellersGrid export** - Option to use server-side export for large lists

### Group 5: Verification
14. **End-to-end testing** - All seller operations via sync infrastructure
15. **Performance comparison** - Ensure no regression from sync overhead

## Open Questions

Things that could not be fully resolved:

1. **Collection Items Sync**
   - What we know: The phase description mentions "SellerCollection data" broadly. The `collection_items` table stores per-run items.
   - What's unclear: Whether `collection_items` (per-run scan results) need sync infrastructure, or only the `sellers` table.
   - Recommendation: Start with sellers only. `collection_items` are ephemeral per-run data that don't benefit from client-side persistence. If needed, add as a follow-up.

2. **Dexie Boolean Indexing**
   - What we know: The `flagged` column is indexed in Dexie schema. Booleans in IndexedDB are stored as 0/1.
   - What's unclear: Whether `db.sellers.where('flagged').equals(true)` works or needs `equals(1)`.
   - Recommendation: Test during implementation. If boolean doesn't work directly, use `equals(1)` or filter in memory.

3. **Schema Version Bump**
   - What we know: Current SCHEMA_VERSION is 2. Adding new tables requires bumping.
   - What's unclear: Whether Phase 28 needs a new table (e.g., collection-specific metadata).
   - Recommendation: If no new tables are needed (sellers table already exists), keep SCHEMA_VERSION at 2. Only bump if adding new tables like `collection_runs` to IndexedDB.

4. **SellersGrid Complexity**
   - What we know: SellersGrid is 1,530 lines with drag selection, right-click flag painting, export, undo/redo.
   - What's unclear: Exact refactoring scope - whether to keep it as one large component or extract data management.
   - Recommendation: Extract data management into hooks (useSyncSellers, mutation hooks), keep interaction logic (drag, selection) in the component. This minimizes risk to existing UI.

5. **Export Threshold**
   - What we know: Bookkeeping uses 10K row threshold for background exports. Current seller export is client-side only.
   - What's unclear: Whether sellers will ever exceed 10K (current fetch is `limit=100000`).
   - Recommendation: Add server-side streaming export as an option but keep client-side export as default. Switch to server-side when seller count exceeds 10K.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `lib/db/index.ts`, `lib/db/schema.ts`, `lib/db/sync.ts` - Verified sellers table exists and sync functions work
- Existing codebase: `routers/sync.py` - Verified `/sync/sellers` endpoint with cursor pagination
- Existing codebase: `lib/api.ts` - Verified `SyncParams`, `SyncResponse`, `SellerSyncItem` types
- Existing codebase: `hooks/sync/use-sync-records.ts` - Template for useSyncSellers
- Existing codebase: `hooks/mutations/use-update-record.ts` - Template for seller mutations
- Existing codebase: `components/admin/collection/sellers-grid.tsx` - Full understanding of current implementation
- Existing codebase: `components/bookkeeping/virtualized-records-list.tsx` - Pattern for virtualized rendering integration

### Secondary (MEDIUM confidence)
- Phase 15-21 RESEARCH.md files - Design decisions and architecture rationale
- TanStack Query v5 docs - useInfiniteQuery, useMutation patterns
- Dexie.js docs - useLiveQuery, boolean indexing behavior

### Tertiary (LOW confidence)
- None needed - all research is based on actual codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, all infrastructure code already exists
- Architecture: HIGH - Directly mirroring established patterns from v3 (useSyncRecords, mutation hooks)
- Pitfalls: HIGH - Based on direct code analysis of SellersGrid's 1,530 lines and known Dexie quirks
- Task decomposition: HIGH - Clear dependency chain based on actual code dependencies

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable infrastructure, well-understood codebase)
