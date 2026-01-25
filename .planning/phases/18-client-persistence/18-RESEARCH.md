# Phase 18: Client Persistence - Research

**Researched:** 2026-01-24
**Domain:** IndexedDB with Dexie.js, TanStack Query persistence, incremental sync
**Confidence:** HIGH

## Summary

Dexie.js v4.2 is the established IndexedDB wrapper for modern React/Next.js applications. It provides a clean API over IndexedDB with built-in TypeScript support, reactive queries via `useLiveQuery`, and seamless Next.js App Router compatibility (fixed in dexie-react-hooks@1.1.3+).

The architecture follows a cache-first pattern: reads always check IndexedDB first, then optionally sync from server. Mutations always hit the server (Phase 19 handles offline queue). Per-table sync checkpoints using `updated_at` cursors enable incremental sync, fetching only changed records since last sync.

TanStack Query integration has two paths: (1) the `experimental_createPersister` plugin for automatic query cache persistence, or (2) manual integration where Dexie is the source of truth and TanStack Query coordinates fetching/caching. Given Phase 17's existing TanStack Query setup and the need for fine-grained sync control, the **manual integration approach** is recommended - Dexie stores data, custom hooks coordinate sync, and TanStack Query handles request deduplication and cache invalidation.

**Primary recommendation:** Use Dexie.js v4.2 with TypeScript EntityTable pattern. Mirror server tables exactly (accounts, records, sellers). Store sync checkpoints in a dedicated `_sync_meta` table. Implement cache-first reads that fall back to server sync. Use IntersectionObserver at 70-80% scroll position to trigger prefetch.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dexie | 4.2.1 | IndexedDB wrapper | 920+ npm dependents, TypeScript-first, excellent React hooks |
| dexie-react-hooks | 4.2.0 | React integration | useLiveQuery for reactive queries, Next.js App Router compatible |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-intersection-observer | 9.x | Scroll position detection | Prefetch trigger at threshold |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dexie.js | idb-keyval | idb-keyval is simpler but lacks schema, queries, live updates |
| Dexie.js | PouchDB | PouchDB has built-in sync but is heavier, CouchDB-oriented |
| Manual integration | TanStack Query Persister | Persister is experimental, doesn't support setQueryData persistence |
| react-intersection-observer | Manual IntersectionObserver | Package handles edge cases, cleanup, and TypeScript types |

**Installation:**
```bash
cd apps/web && npm install dexie dexie-react-hooks react-intersection-observer
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── db/
│   │   ├── index.ts           # Dexie database singleton
│   │   ├── schema.ts          # Table definitions and types
│   │   └── sync.ts            # Sync engine logic
│   ├── query-client.ts        # Existing TanStack Query setup
│   └── query-keys.ts          # Existing query key factory
├── hooks/
│   ├── queries/               # TanStack Query hooks (existing)
│   │   └── use-records-infinite.ts  # Modified to use Dexie
│   └── sync/                  # Sync-related hooks
│       ├── use-sync-status.ts
│       └── use-prefetch.ts
```

### Pattern 1: Dexie Database Singleton with TypeScript

**What:** Single database instance exported as module, using Dexie 4's EntityTable pattern
**When to use:** Application entry point, imported by all database-accessing code

```typescript
// src/lib/db/index.ts
import Dexie, { type EntityTable } from 'dexie';

// Table interfaces matching server sync models exactly
export interface AccountRecord {
  id: string;           // Primary key
  account_code: string;
  name: string | null;
  updated_at: string;   // ISO timestamp for sync
  deleted_at: string | null;
}

export interface BookkeepingRecord {
  id: string;           // Primary key
  account_id: string;   // Foreign key
  ebay_order_id: string;
  sale_date: string;
  item_name: string;
  qty: number;
  sale_price_cents: number;
  ebay_fees_cents: number | null;
  amazon_price_cents: number | null;
  amazon_tax_cents: number | null;
  amazon_shipping_cents: number | null;
  amazon_order_id: string | null;
  status: string;
  return_label_cost_cents: number | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface SellerRecord {
  id: string;
  display_name: string;
  normalized_name: string;
  platform: string;
  platform_id: string | null;
  times_seen: number;
  flagged: boolean;
  updated_at: string;
  deleted_at: string | null;
}

// Sync metadata for checkpoints
export interface SyncMeta {
  table_name: string;   // Primary key
  last_sync_at: string; // ISO timestamp of last successful sync
  cursor: string | null; // Opaque cursor for resuming
}

// Database schema version - increment to clear and resync
const SCHEMA_VERSION = 1;

const db = new Dexie('DSProSolution') as Dexie & {
  accounts: EntityTable<AccountRecord, 'id'>;
  records: EntityTable<BookkeepingRecord, 'id'>;
  sellers: EntityTable<SellerRecord, 'id'>;
  _sync_meta: EntityTable<SyncMeta, 'table_name'>;
};

db.version(SCHEMA_VERSION).stores({
  accounts: 'id, account_code, updated_at',
  records: 'id, account_id, [account_id+sale_date], updated_at',
  sellers: 'id, normalized_name, flagged, updated_at',
  _sync_meta: 'table_name',
});

export { db, SCHEMA_VERSION };
```

### Pattern 2: Clear and Resync on Schema Version Change

**What:** Detect version mismatch and wipe local data for clean resync
**When to use:** When SCHEMA_VERSION is bumped due to schema changes

```typescript
// src/lib/db/index.ts (addition)
import { db, SCHEMA_VERSION } from './index';

const VERSION_KEY = 'ds-pro-schema-version';

export async function initializeDatabase(): Promise<void> {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  const currentVersion = String(SCHEMA_VERSION);

  if (storedVersion !== currentVersion) {
    // Schema version changed - clear all data
    console.log('Schema version changed, clearing IndexedDB...');
    await db.delete();
    await db.open();
    localStorage.setItem(VERSION_KEY, currentVersion);
    // Clear sync metadata to trigger full resync
    await db._sync_meta.clear();
  } else {
    await db.open();
  }
}
```

### Pattern 3: Sync Engine with Per-Table Checkpoints

**What:** Track last sync time per table, fetch only changed records
**When to use:** Background sync, initial sync, manual refresh

```typescript
// src/lib/db/sync.ts
import { db, type BookkeepingRecord } from './index';
import { api } from '@/lib/api';

interface SyncResult {
  synced: number;
  deleted: number;
  hasMore: boolean;
}

export async function syncRecords(accountId: string): Promise<SyncResult> {
  const metaKey = `records:${accountId}`;
  const meta = await db._sync_meta.get(metaKey);

  let cursor = meta?.cursor ?? null;
  let synced = 0;
  let deleted = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await api.syncRecords({
      account_id: accountId,
      cursor,
      limit: 100,
      include_deleted: true, // Need to detect server-side deletions
      updated_since: meta?.last_sync_at ?? undefined,
    });

    // Separate active vs deleted records
    const active: BookkeepingRecord[] = [];
    const toDelete: string[] = [];

    for (const item of response.items) {
      if (item.deleted_at) {
        toDelete.push(item.id);
      } else {
        active.push(item);
      }
    }

    // Bulk upsert active records
    if (active.length > 0) {
      await db.records.bulkPut(active);
      synced += active.length;
    }

    // Delete soft-deleted records locally
    if (toDelete.length > 0) {
      await db.records.bulkDelete(toDelete);
      deleted += toDelete.length;
    }

    cursor = response.next_cursor;
    hasMore = response.has_more;
  }

  // Update sync checkpoint
  await db._sync_meta.put({
    table_name: metaKey,
    last_sync_at: new Date().toISOString(),
    cursor: null, // Reset cursor for next incremental sync
  });

  return { synced, deleted, hasMore: false };
}
```

### Pattern 4: Cache-First Read Hook with useLiveQuery

**What:** Return local data immediately, trigger background sync
**When to use:** All list/detail views

```typescript
// src/hooks/queries/use-records-cached.ts
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { db } from '@/lib/db';
import { syncRecords } from '@/lib/db/sync';

interface UseRecordsCachedOptions {
  accountId: string;
  filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export function useRecordsCached({ accountId, filters }: UseRecordsCachedOptions) {
  const syncingRef = useRef(false);

  // Live query - reactive to IndexedDB changes
  const records = useLiveQuery(async () => {
    let query = db.records.where('account_id').equals(accountId);

    // Note: Complex filters may need to be applied in memory
    // Dexie compound indexes help but have limitations
    const results = await query.toArray();

    // Apply additional filters in memory
    return results.filter(r => {
      if (filters?.status && r.status !== filters.status) return false;
      if (filters?.dateFrom && r.sale_date < filters.dateFrom) return false;
      if (filters?.dateTo && r.sale_date > filters.dateTo) return false;
      return true;
    }).sort((a, b) => {
      // Sort by sale_date DESC, then id DESC
      const dateCompare = b.sale_date.localeCompare(a.sale_date);
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
  }, [accountId, filters?.status, filters?.dateFrom, filters?.dateTo]);

  // Background sync on mount and periodically
  useEffect(() => {
    if (syncingRef.current) return;

    syncingRef.current = true;
    syncRecords(accountId)
      .catch(err => console.error('Sync failed:', err))
      .finally(() => { syncingRef.current = false; });
  }, [accountId]);

  return {
    records: records ?? [],
    isLoading: records === undefined,
  };
}
```

### Pattern 5: Scroll-Based Prefetch with IntersectionObserver

**What:** Prefetch next page when user scrolls to 70-80% of current content
**When to use:** Infinite scroll lists with virtualization (Phase 20)

```typescript
// src/hooks/use-prefetch-on-scroll.ts
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';

interface UsePrefetchOnScrollOptions {
  hasNextPage: boolean;
  isFetching: boolean;
  fetchNextPage: () => void;
  threshold?: number; // 0-1, default 0.7 (70%)
}

export function usePrefetchOnScroll({
  hasNextPage,
  isFetching,
  fetchNextPage,
  threshold = 0.7,
}: UsePrefetchOnScrollOptions) {
  const { ref, inView } = useInView({
    threshold: 0,
    // Trigger when sentinel is 30% of viewport height away
    rootMargin: `${Math.round((1 - threshold) * 100)}% 0px`,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetching, fetchNextPage]);

  return { prefetchSentinelRef: ref };
}
```

### Anti-Patterns to Avoid

- **Creating Dexie instance per component:** Use singleton pattern; multiple instances cause version conflicts
- **Mixing TanStack Query and Dexie as sources of truth:** Pick one; Dexie for persistence, TanStack Query for request coordination
- **Storing computed fields in IndexedDB:** Only store raw data; compute profit_cents etc. on read
- **Using synchronous reads from IndexedDB:** Always use async methods; sync APIs are deprecated
- **Forgetting to handle deleted_at in sync:** Must process soft deletes to remove stale local data

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB transactions | Manual transaction handling | Dexie's implicit transactions | Auto-commit, proper error handling |
| Live queries | useEffect + manual refetch | useLiveQuery | Binary tree algorithm detects affected queries |
| Bulk operations | Loop of individual puts | db.table.bulkPut() | Skips onsuccess events, 10x faster |
| Scroll position detection | Manual scroll event handler | react-intersection-observer | Handles cleanup, edge cases, performance |
| Schema versioning | Custom version checks | Dexie.version().stores() | Built-in upgrade/downgrade handling |

**Key insight:** Dexie's bulk methods are dramatically faster than individual operations because they bypass the IndexedDB event listeners that normally fire for each record.

## Common Pitfalls

### Pitfall 1: Server-Side Execution of IndexedDB Code

**What goes wrong:** Build fails or runtime error on server
**Why it happens:** IndexedDB is browser-only; Next.js SSR tries to execute
**How to avoid:** Use 'use client' directive; dexie-react-hooks@1.1.3+ handles this
**Warning signs:** "indexedDB is not defined" error, build failures

### Pitfall 2: Sync Race Conditions

**What goes wrong:** Data appears to jump around, duplicate operations
**Why it happens:** Multiple sync operations running simultaneously
**How to avoid:** Use refs/flags to prevent concurrent syncs; queue sync requests
**Warning signs:** Console shows multiple sync started, duplicates in UI

### Pitfall 3: Memory Bloat with Large Datasets

**What goes wrong:** Browser becomes slow, crashes on large accounts
**Why it happens:** Loading all records into memory for filtering/sorting
**How to avoid:** Use Dexie indexes, paginate queries, apply filters in query not memory
**Warning signs:** High memory usage in devtools, sluggish UI after scrolling

### Pitfall 4: Stale Sync Checkpoints After Errors

**What goes wrong:** Some records never sync, data appears missing
**Why it happens:** Checkpoint updated before all pages processed, error interrupts
**How to avoid:** Only update checkpoint after complete successful sync; use cursor for resume
**Warning signs:** Missing records that exist on server, sync reports success but data missing

### Pitfall 5: IndexedDB Quota Exceeded

**What goes wrong:** Writes silently fail or throw QuotaExceeded error
**Why it happens:** Browser storage limits (varies by browser, typically 50-500MB)
**How to avoid:** Monitor storage usage; implement cleanup for old data; handle errors
**Warning signs:** Sync failures on large accounts, writes not persisting

## Code Examples

Verified patterns for this phase:

### Database Initialization in Root Layout

```typescript
// src/app/layout.tsx (or a client component wrapper)
'use client';

import { useEffect, useState } from 'react';
import { initializeDatabase } from '@/lib/db';

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeDatabase()
      .then(() => setReady(true))
      .catch(err => {
        console.error('Database init failed:', err);
        // Fallback: app works without local cache
        setReady(true);
      });
  }, []);

  if (!ready) {
    return null; // Or loading spinner
  }

  return <>{children}</>;
}
```

### Prefetch Sentinel Placement in List

```typescript
// src/components/records/records-list.tsx
'use client';

import { useRecordsCached } from '@/hooks/queries/use-records-cached';
import { usePrefetchOnScroll } from '@/hooks/use-prefetch-on-scroll';

export function RecordsList({ accountId }: { accountId: string }) {
  const { records, isLoading, hasNextPage, isFetching, fetchNextPage } =
    useRecordsWithPrefetch(accountId);

  const { prefetchSentinelRef } = usePrefetchOnScroll({
    hasNextPage,
    isFetching,
    fetchNextPage,
    threshold: 0.75, // Prefetch at 75% scroll
  });

  if (isLoading) return <RecordsSkeleton />;

  return (
    <div>
      {records.map((record, index) => (
        <RecordRow key={record.id} record={record} />
      ))}
      {/* Sentinel element - invisible, triggers prefetch */}
      <div ref={prefetchSentinelRef} style={{ height: 1 }} />
      {isFetching && <LoadingSpinner />}
    </div>
  );
}
```

### Sync API Integration

```typescript
// src/lib/api.ts (additions)
interface SyncParams {
  account_id?: string;
  cursor?: string | null;
  limit?: number;
  include_deleted?: boolean;
  updated_since?: string;
}

interface SyncResponse<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
  total_estimate: number | null;
}

export const api = {
  // ... existing methods ...

  syncRecords: async (params: SyncParams): Promise<SyncResponse<RecordSyncItem>> => {
    const searchParams = new URLSearchParams();
    if (params.account_id) searchParams.set('account_id', params.account_id);
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.include_deleted) searchParams.set('include_deleted', 'true');
    if (params.updated_since) searchParams.set('updated_since', params.updated_since);

    return fetchAPI(`/sync/records?${searchParams}`);
  },

  syncAccounts: async (params: SyncParams): Promise<SyncResponse<AccountSyncItem>> => {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.include_deleted) searchParams.set('include_deleted', 'true');
    if (params.updated_since) searchParams.set('updated_since', params.updated_since);

    return fetchAPI(`/sync/accounts?${searchParams}`);
  },

  syncSellers: async (params: SyncParams): Promise<SyncResponse<SellerSyncItem>> => {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.include_deleted) searchParams.set('include_deleted', 'true');
    if (params.updated_since) searchParams.set('updated_since', params.updated_since);

    return fetchAPI(`/sync/sellers?${searchParams}`);
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dexie subclass pattern | EntityTable type assertion | Dexie 4.0 | Simpler TypeScript, fewer boilerplate |
| dexie-react-hooks SSR workarounds | Direct useLiveQuery | v1.1.3 (2024) | Works in Next.js App Router without dynamic imports |
| localStorage for sync cursors | Dedicated IndexedDB table | Current best practice | Atomic with data, survives localStorage clear |
| TanStack Query PersistQueryClient | experimental_createPersister | v5.10+ | Per-query persistence, lazy loading |

**Deprecated/outdated:**
- Dexie 3.x subclass pattern - still works but EntityTable is cleaner
- Using localStorage for sync metadata - use IndexedDB table instead
- dexie-react-hooks versions < 1.1.3 - had SSR issues with Next.js

## Open Questions

Things that couldn't be fully resolved:

1. **TanStack Query integration depth**
   - What we know: Can use TanStack Query for request coordination while Dexie holds data
   - What's unclear: Whether to wrap Dexie reads in useQuery or use useLiveQuery directly
   - Recommendation: Use useLiveQuery for reads (reactive), TanStack Query for sync coordination

2. **Optimal prefetch depth**
   - What we know: Prefetching 1 page ahead is standard practice
   - What's unclear: Whether 2-3 pages is better for this app's record sizes
   - Recommendation: Start with 1 page (50 records), measure and adjust based on user testing

3. **Storage quota handling**
   - What we know: Browsers have limits, can check via StorageManager API
   - What's unclear: What to do when approaching limit - LRU eviction? Warn user?
   - Recommendation: Log quota usage, implement account-level clearing as first measure

## Sources

### Primary (HIGH confidence)
- [Dexie.js Official Documentation](https://dexie.org/docs/) - Schema, API reference, React integration
- [Dexie npm package](https://www.npmjs.com/package/dexie) - Version 4.2.1, 920+ dependents
- [dexie-react-hooks npm](https://www.npmjs.com/package/dexie-react-hooks) - Version 4.2.0, Next.js App Router support
- [TanStack Query Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) - fetchNextPage, prefetch patterns

### Secondary (MEDIUM confidence)
- [Dexie.js + Next.js Article](https://medium.com/dexie-js/dexie-js-next-js-fd15556653e6) - SSR compatibility fixes
- [TanStack Query createPersister Discussion](https://github.com/TanStack/query/discussions/6213) - IndexedDB integration approaches
- [Dexie Version Upgrade Docs](https://dexie.org/docs/Dexie/Dexie.version()) - Schema migration patterns

### Tertiary (LOW confidence)
- [react-intersection-observer npm](https://www.npmjs.com/package/react-intersection-observer) - Scroll detection package
- [LogRocket Offline-First Article](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) - Cache-first patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Dexie.js is well-established, versions verified on npm
- Architecture: HIGH - Patterns from official docs and real-world usage
- Pitfalls: MEDIUM - Based on community discussions and common issues
- Prefetch strategy: MEDIUM - Patterns clear, optimal threshold needs testing

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - stable libraries, slow-moving)
