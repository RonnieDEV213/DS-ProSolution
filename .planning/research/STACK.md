# Technology Stack: v3 Data Infrastructure

**Project:** DS-ProSolution v3 Large-Scale Data Pipeline
**Researched:** 2026-01-23
**Confidence:** HIGH (verified with official docs and recent sources)

## Executive Summary

This stack recommendation addresses the v3 milestone requirements: handling millions of records with fast read/write across hundreds of eBay accounts. The recommendations prioritize technologies that integrate cleanly with the existing Supabase/PostgreSQL backend, Next.js 14+ frontend, and Chrome Extension MV3 architecture.

**Key decisions:**
- **Server pagination:** Keyset/cursor-based pagination (not offset-based)
- **Client cache:** Dexie.js 4.x for IndexedDB (not RxDB or raw IndexedDB)
- **State management:** TanStack Query + Supabase Cache Helpers (not Zustand for server state)
- **Sync protocol:** Custom incremental sync with Supabase Realtime (not PowerSync/Electric)

---

## Recommended Stack

### 1. Server-Side Pagination (PostgreSQL/Supabase)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Keyset Pagination | Native PostgreSQL | Navigate large datasets efficiently | Offset pagination degrades 17x at scale; keyset maintains constant performance |
| Composite Indexes | Native PostgreSQL | Support compound cursor queries | Required for `(timestamp, id)` cursor patterns |
| Supabase PostgREST | Built-in | REST API with `.gt()`, `.gte()` filters | Native support for cursor conditions |

**Implementation Pattern:**

```sql
-- Required index for cursor pagination
CREATE INDEX idx_orders_cursor ON orders (updated_at DESC, id DESC);

-- Query pattern (keyset pagination)
SELECT * FROM orders
WHERE (updated_at, id) < ($1, $2)  -- cursor from previous page
ORDER BY updated_at DESC, id DESC
LIMIT 50;
```

**Supabase Client Usage:**

```typescript
// Cursor-based pagination with Supabase
const { data } = await supabase
  .from('orders')
  .select('*')
  .lt('updated_at', lastSeenTimestamp)
  .or(`updated_at.eq.${lastSeenTimestamp},id.lt.${lastSeenId}`)
  .order('updated_at', { ascending: false })
  .order('id', { ascending: false })
  .limit(50);
```

**Rationale:**
- Offset pagination (`OFFSET 10000`) requires scanning 10,000 rows before returning results
- Keyset pagination jumps directly to the cursor position via index
- Sources: [Sequin Blog](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/), [Citus Data](https://www.citusdata.com/blog/2016/03/30/five-ways-to-paginate/)

---

### 2. Client-Side IndexedDB (Wrapper Library)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Dexie.js** | 4.2.x | IndexedDB wrapper | Best DX, bulk performance, React hooks, mature ecosystem |
| dexie-react-hooks | 4.2.x | React integration | `useLiveQuery()` for reactive UI updates |

**Why Dexie over alternatives:**

| Criterion | Dexie 4.x | RxDB | idb | idb-keyval |
|-----------|-----------|------|-----|------------|
| Bundle size | ~40KB | ~200KB+ | ~2KB | ~600B |
| Learning curve | Low | High | Medium | Very Low |
| React integration | Excellent | Good | Manual | Manual |
| Bulk operations | Excellent | Good | Manual | N/A |
| Schema migrations | Built-in | Built-in | Manual | N/A |
| Query API | Rich | Very Rich | Basic | Key-value only |
| MV3 Extension support | Yes | Yes | Yes | Yes |

**Installation:**

```bash
cd apps/web
npm install dexie@^4.2.1 dexie-react-hooks@^4.2.1
```

**Basic Setup:**

```typescript
// lib/db.ts
import Dexie, { Table } from 'dexie';

export interface Order {
  id: string;
  account_id: string;
  updated_at: string;
  // ... other fields
}

export class AppDatabase extends Dexie {
  orders!: Table<Order, string>;

  constructor() {
    super('ds-prosolution');
    this.version(1).stores({
      orders: 'id, account_id, updated_at, [account_id+updated_at]'
    });
  }
}

export const db = new AppDatabase();
```

**React Usage:**

```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

function OrderList({ accountId }: { accountId: string }) {
  const orders = useLiveQuery(
    () => db.orders
      .where('account_id')
      .equals(accountId)
      .sortBy('updated_at'),
    [accountId]
  );

  return <>{orders?.map(order => <OrderRow key={order.id} order={order} />)}</>;
}
```

**Rationale:**
- Dexie's bulk methods leverage IndexedDB's lesser-known feature for batch inserts without individual `onsuccess` events
- Works around browser-specific IndexedDB bugs
- 100,000+ websites use Dexie in production
- Sources: [Dexie.org](https://dexie.org/), [GitHub Dexie.js](https://github.com/dexie/Dexie.js)

---

### 3. State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **TanStack Query** | 5.x | Server state management | Caching, deduplication, background refetch, optimistic updates |
| **@supabase-cache-helpers/postgrest-react-query** | 1.x | Supabase + TanStack integration | Auto-generates cache keys, handles mutations, realtime integration |
| Zustand | 5.x | Client-only UI state | Lightweight, simple, already proven in ecosystem |

**Why TanStack Query + Supabase Cache Helpers:**

The cache helpers automatically:
- Generate unique cache keys from Supabase queries
- Populate cache on mutations (optimistic updates)
- Integrate with Supabase Realtime for live updates
- Handle pagination (offset and cursor-based)

**Installation:**

```bash
cd apps/web
npm install @tanstack/react-query@^5.64.0 @supabase-cache-helpers/postgrest-react-query@^1.14.0
```

**Setup:**

```typescript
// providers/query-provider.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes (renamed from cacheTime in v5)
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Usage with Supabase Cache Helpers:**

```typescript
import { useQuery } from '@supabase-cache-helpers/postgrest-react-query';
import { createClient } from '@/lib/supabase/client';

function OrdersPage({ accountId }: { accountId: string }) {
  const supabase = createClient();

  const { data, isLoading } = useQuery(
    supabase
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(50)
  );

  // Cache key is auto-generated from the query
  // Mutations automatically update the cache
}
```

**Cursor Pagination:**

```typescript
import { useCursorInfiniteScrollQuery } from '@supabase-cache-helpers/postgrest-react-query';

function InfiniteOrderList({ accountId }: { accountId: string }) {
  const supabase = createClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useCursorInfiniteScrollQuery(
    supabase
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false }),
    { pageSize: 50 }
  );
}
```

**Rationale:**
- TanStack Query is the de facto standard for server state in React
- Supabase Cache Helpers eliminate boilerplate for cache key generation
- Built-in infinite scroll/pagination hooks
- Sources: [Supabase Blog](https://supabase.com/blog/react-query-nextjs-app-router-cache-helpers), [Supabase Cache Helpers Docs](https://supabase-cache-helpers.vercel.app/)

---

### 4. Sync Protocol (Client-Server)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Custom Incremental Sync** | Custom | Track changes since last sync | Full control, no vendor lock-in |
| **Supabase Realtime** | Built-in | Live updates for active data | Already in stack, no additional infrastructure |
| `updated_at` checkpoints | Native PostgreSQL | Track sync cursor | Simple, debuggable, works with existing schema |

**Why NOT PowerSync/Electric/RxDB Replication:**

| Solution | Issue for DS-ProSolution |
|----------|--------------------------|
| PowerSync | Requires separate service, adds infrastructure complexity |
| Electric SQL | SQLite sync target (we use IndexedDB), early-stage for production |
| RxDB Supabase Replication | Heavyweight, requires schema changes, complex setup |
| Dexie Cloud | Commercial SaaS, vendor lock-in |

**Our constraint:** Must work within existing Supabase ecosystem without adding services.

**Recommended Sync Architecture:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   IndexedDB     │◄────│   Sync Layer    │◄────│    Supabase     │
│   (Dexie.js)    │     │   (Custom)      │     │   PostgreSQL    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  useLiveQuery()       │  Pull: checkpoint     │  RLS enforced
        │                       │  Push: upsert         │
        ▼                       │  Live: Realtime       │
    React UI                    │                       │
                                ▼                       │
                        TanStack Query             Realtime
                        (server state)             (WebSocket)
```

**Database Schema Requirements:**

```sql
-- Add to existing tables
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Trigger for auto-updating timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for sync queries
CREATE INDEX idx_orders_sync ON orders (updated_at, id);
```

**Sync Implementation:**

```typescript
// lib/sync.ts
import { db } from './db';
import { createClient } from './supabase/client';

interface SyncCheckpoint {
  table: string;
  last_updated_at: string;
  last_id: string;
}

export async function syncTable(table: 'orders' | 'listings', accountId: string) {
  const supabase = createClient();

  // Get checkpoint from IndexedDB
  const checkpoint = await db.sync_checkpoints.get(`${table}:${accountId}`);

  // Pull changes since checkpoint
  let query = supabase
    .from(table)
    .select('*')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1000);

  if (checkpoint) {
    query = query.or(
      `updated_at.gt.${checkpoint.last_updated_at},` +
      `and(updated_at.eq.${checkpoint.last_updated_at},id.gt.${checkpoint.last_id})`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  if (data.length > 0) {
    // Bulk upsert to IndexedDB
    await db[table].bulkPut(data);

    // Update checkpoint
    const last = data[data.length - 1];
    await db.sync_checkpoints.put({
      id: `${table}:${accountId}`,
      last_updated_at: last.updated_at,
      last_id: last.id,
    });

    // Recurse if we got a full page (more data may exist)
    if (data.length === 1000) {
      await syncTable(table, accountId);
    }
  }
}

// Subscribe to realtime updates
export function subscribeToChanges(table: string, accountId: string) {
  const supabase = createClient();

  return supabase
    .channel(`${table}:${accountId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `account_id=eq.${accountId}`
      },
      async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          await db[table].put(payload.new);
        }
        // Soft deletes: deleted=true comes as UPDATE
      }
    )
    .subscribe();
}
```

**Soft Deletes (Critical):**

```typescript
// NEVER hard-delete - use soft delete for offline sync
await supabase
  .from('orders')
  .update({ deleted: true })
  .eq('id', orderId);

// Client filters out deleted records
const orders = await db.orders
  .where('account_id').equals(accountId)
  .and(order => !order.deleted)
  .toArray();
```

**Rationale:**
- Soft deletes ensure offline clients receive deletion notifications
- Checkpoint-based sync handles interruptions gracefully
- Supabase Realtime provides instant updates for active sessions
- Sources: [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime), [RxDB Supabase](https://rxdb.info/replication-supabase.html)

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `idb-keyval` | 6.2.x | Simple key-value IndexedDB | Sync checkpoints, small metadata |
| `@tanstack/react-query-devtools` | 5.x | Debug TanStack Query | Development only |
| `date-fns` | 3.x | Date manipulation | Timestamp comparisons in sync |

**Installation:**

```bash
# Core data infrastructure
npm install dexie@^4.2.1 dexie-react-hooks@^4.2.1
npm install @tanstack/react-query@^5.64.0
npm install @supabase-cache-helpers/postgrest-react-query@^1.14.0
npm install idb-keyval@^6.2.1

# Dev tools
npm install -D @tanstack/react-query-devtools@^5.64.0
```

---

## Chrome Extension Considerations

The extension (`packages/extension`) uses Manifest V3 service workers which have special storage constraints.

**IndexedDB in MV3 Service Workers:**
- localStorage is NOT available (synchronous API)
- IndexedDB IS available and recommended
- Data persists across service worker shutdowns
- Use Dexie.js in both web app AND extension for consistency

**Best Practice for Extension:**

```javascript
// packages/extension/service-worker.js
import Dexie from 'dexie';

const db = new Dexie('ds-prosolution-extension');
db.version(1).stores({
  jobs: 'id, status, created_at',
  cache: 'key'
});

// Load data on service worker startup
let inMemoryData = null;

async function ensureLoaded() {
  if (!inMemoryData) {
    inMemoryData = await db.cache.get('runtime-data');
  }
  return inMemoryData;
}

// Persist on every change
async function updateData(newData) {
  inMemoryData = newData;
  await db.cache.put({ key: 'runtime-data', ...newData });
}
```

**Sources:** [Chrome Developer Docs](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| IndexedDB | Dexie 4.x | RxDB 16.x | Heavier bundle, complex setup, overkill for our sync needs |
| IndexedDB | Dexie 4.x | idb | Too low-level, no schema migrations, no React hooks |
| Pagination | Keyset | Offset | 17x slower at scale, inconsistent with concurrent writes |
| Server State | TanStack Query | SWR | Less feature-rich, no built-in Supabase helpers |
| Sync | Custom + Realtime | PowerSync | Additional infrastructure, cost, vendor lock-in |
| Sync | Custom + Realtime | Electric SQL | SQLite target (not IndexedDB), early-stage |
| Sync | Custom + Realtime | Dexie Cloud | Commercial SaaS, requires their backend |

---

## What NOT to Use

| Technology | Reason |
|------------|--------|
| **Offset pagination** | Performance degrades linearly with page depth |
| **Raw IndexedDB API** | Verbose, callback-based, no migrations |
| **idb-keyval for large data** | Key-value only, no indexes, no queries |
| **RxDB for this project** | Overkill complexity, large bundle, we don't need CRDT |
| **PowerSync/Electric** | Adds infrastructure we don't need; Supabase handles sync |
| **localStorage for cache** | 5MB limit, blocks main thread, no queries |
| **chrome.storage.local** | Too slow for large datasets, 10MB limit |
| **Zustand for server state** | TanStack Query is purpose-built for this |
| **Hard deletes** | Breaks offline sync - always use soft deletes |

---

## Migration Path from Current State

The current codebase uses full-fetch pattern with no client cache. Here's the incremental migration:

**Phase 1: Add TanStack Query + Supabase Cache Helpers**
- Wrap existing Supabase queries with `useQuery()`
- Immediate benefits: caching, deduplication, loading states
- No schema changes required

**Phase 2: Add Dexie.js for Offline Cache**
- Create IndexedDB schema mirroring key tables
- Populate on initial sync
- Serve reads from IndexedDB, background refresh from server

**Phase 3: Implement Incremental Sync**
- Add `updated_at` triggers to tables
- Implement checkpoint-based sync
- Subscribe to Supabase Realtime for live updates

**Phase 4: Convert to Cursor Pagination**
- Add composite indexes
- Replace `.range()` with keyset queries
- Implement infinite scroll UI

---

## Performance Targets

| Metric | Target | How Achieved |
|--------|--------|--------------|
| Initial page load | <1s | IndexedDB cache + skeleton UI |
| Incremental sync | <5s for 10K records | Bulk insert, checkpoint batching |
| UI responsiveness | <50ms | useLiveQuery() reactive updates |
| Memory footprint | <100MB | Paginated loading, not full dataset |
| Offline capability | Full read | IndexedDB stores all synced data |

---

## Sources

**Server Pagination:**
- [Keyset Cursors for Postgres Pagination](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/)
- [Five Ways to Paginate in Postgres](https://www.citusdata.com/blog/2016/03/30/five-ways-to-paginate/)
- [Cursor Pagination Guide 2025](https://bun.uptrace.dev/guide/cursor-pagination.html)

**IndexedDB Libraries:**
- [Dexie.js Official Docs](https://dexie.org/)
- [Dexie.js GitHub](https://github.com/dexie/Dexie.js)
- [idb vs Dexie Comparison](https://npm-compare.com/dexie,idb)

**State Management:**
- [Supabase Cache Helpers Docs](https://supabase-cache-helpers.vercel.app/)
- [Using React Query with Supabase](https://supabase.com/blog/react-query-nextjs-app-router-cache-helpers)
- [TanStack Query Persist](https://tanstack.com/query/v4/docs/framework/react/plugins/persistQueryClient)

**Sync Protocols:**
- [RxDB Supabase Replication](https://rxdb.info/replication-supabase.html)
- [Supabase Realtime Best Practices](https://github.com/orgs/supabase/discussions/21995)
- [PowerSync JS SDK](https://docs.powersync.com/client-sdk-references/js-web)

**Chrome Extension Storage:**
- [Migrate to Service Workers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)
- [MV3 Storage Learnings](https://devblogs.microsoft.com/engineering-at-microsoft/learnings-from-migrating-accessibility-insights-for-web-to-chromes-manifest-v3/)

---

*Stack research: 2026-01-23*
*Confidence: HIGH - All recommendations verified with official documentation and 2025 sources*
