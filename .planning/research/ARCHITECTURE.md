# Architecture Patterns: 4-Layer Data Infrastructure

**Domain:** Large-scale data infrastructure for eBay account management
**Researched:** 2026-01-23
**Milestone:** v3 (Storage & Rendering)

## Executive Summary

This document defines the architecture for a 4-layer data infrastructure that handles millions of records across hundreds of eBay accounts. The architecture prioritizes:

1. **Scalability** - Cursor-based pagination prevents offset performance degradation
2. **Offline resilience** - IndexedDB provides local-first data access
3. **Efficiency** - Delta sync minimizes bandwidth and server load
4. **Responsiveness** - Virtualization renders only visible rows

## System Overview Diagram

```
+------------------------------------------------------------------+
|                         LAYER 4: RENDERING                        |
|   React Components + react-window + TanStack Virtual              |
|   - Virtualizes visible rows only                                 |
|   - Integrates with pagination triggers                           |
|   - Optimistic UI updates                                         |
+------------------------------------------------------------------+
                              |
                              | useLiveQuery() / React state
                              v
+------------------------------------------------------------------+
|                      LAYER 3: CLIENT STORAGE                      |
|   IndexedDB via Dexie.js                                          |
|   - Local cache for all synced data                               |
|   - Sync metadata tracking (cursors, timestamps)                  |
|   - Offline mutation queue                                        |
+------------------------------------------------------------------+
                              |
                              | Sync Engine (background)
                              v
+------------------------------------------------------------------+
|                       LAYER 2: TRANSPORT                          |
|   REST API (FastAPI) with cursor-based pagination                 |
|   - Cursor endpoints for paginated fetches                        |
|   - Delta sync endpoints (updated_since)                          |
|   - Bulk mutation endpoints                                       |
+------------------------------------------------------------------+
                              |
                              | HTTP/HTTPS
                              v
+------------------------------------------------------------------+
|                      LAYER 1: SERVER STORAGE                      |
|   PostgreSQL (Supabase)                                           |
|   - Indexed columns for cursor pagination                         |
|   - updated_at tracking for delta sync                            |
|   - RLS policies for multi-tenant security                        |
+------------------------------------------------------------------+
```

## Layer 1: Server Storage (PostgreSQL/Supabase)

### Purpose

Authoritative data store with optimized query patterns for pagination and sync.

### Schema Requirements

```sql
-- Every syncable table needs these columns
ALTER TABLE bookkeeping_records ADD COLUMN IF NOT EXISTS
  updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE bookkeeping_records ADD COLUMN IF NOT EXISTS
  deleted_at TIMESTAMPTZ NULL; -- Soft deletes for sync

-- Composite index for cursor pagination
CREATE INDEX IF NOT EXISTS idx_records_cursor
  ON bookkeeping_records (account_id, sale_date DESC, id DESC);

-- Index for delta sync queries
CREATE INDEX IF NOT EXISTS idx_records_updated_at
  ON bookkeeping_records (account_id, updated_at);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_records_updated_at
  BEFORE UPDATE ON bookkeeping_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Query Patterns

**Cursor-based pagination:**
```sql
-- First page (no cursor)
SELECT * FROM bookkeeping_records
WHERE account_id = $1
  AND deleted_at IS NULL
ORDER BY sale_date DESC, id DESC
LIMIT 50;

-- Subsequent pages (with cursor: sale_date + id)
SELECT * FROM bookkeeping_records
WHERE account_id = $1
  AND deleted_at IS NULL
  AND (sale_date, id) < ($cursor_date, $cursor_id)
ORDER BY sale_date DESC, id DESC
LIMIT 50;
```

**Delta sync:**
```sql
-- Fetch all changes since last sync
SELECT * FROM bookkeeping_records
WHERE account_id = $1
  AND updated_at > $last_sync_timestamp
ORDER BY updated_at ASC
LIMIT 1000;
```

### Confidence Level

**HIGH** - Cursor pagination and timestamp-based sync are well-established PostgreSQL patterns. Supabase fully supports these query patterns.

---

## Layer 2: Transport (REST API)

### Purpose

Provides cursor-based endpoints for initial data fetch and delta sync for ongoing updates.

### Endpoint Design

#### 2.1 Paginated Fetch Endpoint

```
GET /records/paginated
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| account_id | string | Required. Filter by account |
| cursor | string | Optional. Opaque cursor for next page |
| limit | int | Optional. Page size (default: 50, max: 100) |
| date_from | date | Optional. Filter start date |
| date_to | date | Optional. Filter end date |
| status | string | Optional. Filter by status |

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJkYXRlIjoiMjAyNi0wMS0xNSIsImlkIjoiYWJjMTIzIn0=",
    "has_more": true,
    "total_estimate": 15000
  },
  "sync_token": "2026-01-23T10:30:00Z"
}
```

**Cursor encoding:**
```python
import base64
import json

def encode_cursor(sale_date: str, record_id: str) -> str:
    """Encode cursor as opaque base64 string."""
    data = {"date": sale_date, "id": record_id}
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode()

def decode_cursor(cursor: str) -> tuple[str, str]:
    """Decode cursor to (sale_date, record_id)."""
    data = json.loads(base64.urlsafe_b64decode(cursor))
    return data["date"], data["id"]
```

#### 2.2 Delta Sync Endpoint

```
GET /records/sync
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| account_id | string | Required. Filter by account |
| since | datetime | Required. ISO timestamp of last sync |
| limit | int | Optional. Max records (default: 1000) |

**Response:**
```json
{
  "changes": [
    {"action": "upsert", "data": {...}},
    {"action": "delete", "id": "abc123"}
  ],
  "sync_token": "2026-01-23T11:00:00Z",
  "has_more": false
}
```

**Soft delete handling:**
- Records with `deleted_at` set are returned with `action: "delete"`
- Client removes from local IndexedDB
- After sync, server can hard-delete old soft-deleted records

#### 2.3 Bulk Write Endpoint

```
POST /records/bulk
```

**Request:**
```json
{
  "operations": [
    {"action": "create", "data": {...}},
    {"action": "update", "id": "abc123", "data": {...}},
    {"action": "delete", "id": "def456"}
  ],
  "client_timestamp": "2026-01-23T10:30:00Z"
}
```

**Response:**
```json
{
  "results": [
    {"success": true, "id": "new-id", "data": {...}},
    {"success": true, "id": "abc123", "data": {...}},
    {"success": false, "id": "def456", "error": "not_found"}
  ],
  "sync_token": "2026-01-23T11:00:05Z"
}
```

### FastAPI Implementation Structure

```
apps/api/src/app/routers/
  records.py          # Existing CRUD
  records_paginated.py # New cursor pagination
  records_sync.py      # New delta sync
```

### Confidence Level

**HIGH** - Based on [fastapi-pagination library](https://uriyyo-fastapi-pagination.netlify.app/) documentation and [cursor pagination best practices](https://www.speakeasy.com/api-design/pagination).

---

## Layer 3: Client Storage (IndexedDB)

### Purpose

Local-first data cache with sync state tracking and offline mutation queue.

### Technology Choice: Dexie.js

**Why Dexie.js:**
- Mature library with excellent React integration via `useLiveQuery()`
- Live queries automatically re-render components when data changes
- Schema versioning and migration support
- [Next.js 14+ compatible](https://medium.com/dexie-js/dexie-js-next-js-fd15556653e6) with dexie-react-hooks@1.1.3+

### Schema Design

```typescript
// apps/web/src/lib/db/schema.ts
import Dexie, { Table } from 'dexie';

export interface LocalRecord {
  // Primary key
  id: string;

  // Data fields (match server schema)
  account_id: string;
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

  // Computed fields
  earnings_net_cents: number;
  cogs_total_cents: number;
  profit_cents: number;

  // Remarks
  order_remark: string | null;
  service_remark: string | null;

  // Sync metadata
  _syncedAt: string;      // When this record was synced
  _localVersion: number;  // Increments on local edits
}

export interface SyncState {
  id: string;              // "account:{account_id}"
  account_id: string;
  lastSyncToken: string;   // ISO timestamp from server
  lastFullSync: string;    // When we did full initial sync
  cursor: string | null;   // Current pagination cursor (null = complete)
  totalEstimate: number;   // Estimated total records
  syncedCount: number;     // Records synced so far
}

export interface PendingMutation {
  id: string;              // Auto-generated
  account_id: string;
  record_id: string | null; // null for creates
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

export class AppDatabase extends Dexie {
  records!: Table<LocalRecord, string>;
  syncState!: Table<SyncState, string>;
  pendingMutations!: Table<PendingMutation, string>;

  constructor() {
    super('ds-prosolution');

    this.version(1).stores({
      // Compound index for efficient queries
      records: 'id, account_id, [account_id+sale_date], sale_date, status, _syncedAt',
      syncState: 'id, account_id',
      pendingMutations: 'id, account_id, createdAt'
    });
  }
}

export const db = new AppDatabase();
```

### Sync State Machine

```
                    +----------------+
                    |    IDLE        |
                    +-------+--------+
                            |
              User selects account / app loads
                            |
                            v
                    +-------+--------+
                    | CHECK_STATE    |
                    +-------+--------+
                            |
              +-----------+-+------------+
              |                          |
        No local data             Has local data
              |                          |
              v                          v
      +-------+--------+         +-------+--------+
      | INITIAL_SYNC   |         | DELTA_SYNC     |
      | (paginated)    |         | (since token)  |
      +-------+--------+         +-------+--------+
              |                          |
              v                          v
      +-------+--------+         +-------+--------+
      | SYNCING        |<------->| SYNCING        |
      | fetch pages    |         | apply deltas   |
      +-------+--------+         +-------+--------+
              |                          |
              +----------+---------------+
                         |
                         v
                 +-------+--------+
                 | PUSH_MUTATIONS |
                 | (if any)       |
                 +-------+--------+
                         |
                         v
                 +-------+--------+
                 | IDLE           |
                 +----------------+
```

### Sync Engine Implementation

```typescript
// apps/web/src/lib/db/sync-engine.ts
import { db, SyncState } from './schema';
import { api } from '../api';

export interface SyncProgress {
  phase: 'idle' | 'initial' | 'delta' | 'pushing';
  account_id: string;
  progress: number; // 0-100
  syncedCount: number;
  totalEstimate: number;
  error?: string;
}

export class SyncEngine {
  private abortController: AbortController | null = null;
  private onProgress: (progress: SyncProgress) => void;

  constructor(onProgress: (progress: SyncProgress) => void) {
    this.onProgress = onProgress;
  }

  async syncAccount(accountId: string): Promise<void> {
    this.abortController = new AbortController();

    try {
      // 1. Check local sync state
      const syncState = await db.syncState.get(`account:${accountId}`);

      if (!syncState || !syncState.lastSyncToken) {
        // Initial sync - paginate through all records
        await this.initialSync(accountId);
      } else {
        // Delta sync - fetch only changes
        await this.deltaSync(accountId, syncState.lastSyncToken);
      }

      // 2. Push pending mutations
      await this.pushMutations(accountId);

    } finally {
      this.abortController = null;
    }
  }

  private async initialSync(accountId: string): Promise<void> {
    let cursor: string | null = null;
    let syncedCount = 0;
    let totalEstimate = 0;

    do {
      const response = await api.getRecordsPaginated({
        account_id: accountId,
        cursor: cursor ?? undefined,
        limit: 100
      });

      // Upsert records to IndexedDB
      await db.records.bulkPut(
        response.data.map(record => ({
          ...record,
          _syncedAt: new Date().toISOString(),
          _localVersion: 0
        }))
      );

      cursor = response.pagination.cursor;
      totalEstimate = response.pagination.total_estimate;
      syncedCount += response.data.length;

      // Update sync state
      await db.syncState.put({
        id: `account:${accountId}`,
        account_id: accountId,
        lastSyncToken: response.sync_token,
        lastFullSync: new Date().toISOString(),
        cursor: cursor,
        totalEstimate,
        syncedCount
      });

      this.onProgress({
        phase: 'initial',
        account_id: accountId,
        progress: Math.round((syncedCount / totalEstimate) * 100),
        syncedCount,
        totalEstimate
      });

    } while (cursor);
  }

  private async deltaSync(accountId: string, since: string): Promise<void> {
    let hasMore = true;
    let currentSince = since;

    while (hasMore) {
      const response = await api.getRecordsSync({
        account_id: accountId,
        since: currentSince,
        limit: 1000
      });

      // Apply changes to IndexedDB
      for (const change of response.changes) {
        if (change.action === 'delete') {
          await db.records.delete(change.id);
        } else {
          await db.records.put({
            ...change.data,
            _syncedAt: new Date().toISOString(),
            _localVersion: 0
          });
        }
      }

      currentSince = response.sync_token;
      hasMore = response.has_more;

      // Update sync state
      await db.syncState.update(`account:${accountId}`, {
        lastSyncToken: currentSince
      });

      this.onProgress({
        phase: 'delta',
        account_id: accountId,
        progress: hasMore ? 50 : 100,
        syncedCount: response.changes.length,
        totalEstimate: response.changes.length
      });
    }
  }

  private async pushMutations(accountId: string): Promise<void> {
    const pending = await db.pendingMutations
      .where('account_id')
      .equals(accountId)
      .sortBy('createdAt');

    if (pending.length === 0) return;

    this.onProgress({
      phase: 'pushing',
      account_id: accountId,
      progress: 0,
      syncedCount: 0,
      totalEstimate: pending.length
    });

    // Batch mutations
    const operations = pending.map(m => ({
      action: m.action,
      id: m.record_id ?? undefined,
      data: m.data
    }));

    const results = await api.bulkWriteRecords({
      operations,
      client_timestamp: new Date().toISOString()
    });

    // Process results
    for (let i = 0; i < results.results.length; i++) {
      const result = results.results[i];
      const mutation = pending[i];

      if (result.success) {
        // Remove from pending
        await db.pendingMutations.delete(mutation.id);

        // Update local record with server data
        if (result.data) {
          await db.records.put({
            ...result.data,
            _syncedAt: new Date().toISOString(),
            _localVersion: 0
          });
        }
      } else {
        // Increment retry count
        await db.pendingMutations.update(mutation.id, {
          retryCount: mutation.retryCount + 1
        });
      }
    }
  }

  abort(): void {
    this.abortController?.abort();
  }
}
```

### Confidence Level

**HIGH** - Based on [Dexie.js documentation](https://dexie.org/docs/Tutorial/React) and [useLiveQuery() reference](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()).

---

## Layer 4: Rendering (React/Next.js)

### Purpose

Efficiently render large datasets with virtualization while integrating with paginated IndexedDB data.

### Technology Stack

- **react-window** (already installed) - Windowing/virtualization
- **react-window-infinite-loader** (already installed) - Infinite scroll with pagination
- **Dexie useLiveQuery()** - Reactive data binding

### Component Architecture

```
apps/web/src/components/bookkeeping/
  records-table-virtualized.tsx    # Main virtualized table
  records-row.tsx                  # Individual row component
  records-header.tsx               # Fixed header
  sync-status-indicator.tsx        # Sync progress UI

apps/web/src/hooks/
  use-paginated-records.ts         # Combines IndexedDB + pagination
  use-sync-engine.ts               # Sync engine React wrapper
```

### Virtualized Table Implementation

```typescript
// apps/web/src/hooks/use-paginated-records.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalRecord } from '@/lib/db/schema';
import { useCallback, useMemo } from 'react';

interface UsePaginatedRecordsOptions {
  accountId: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

interface UsePaginatedRecordsResult {
  records: LocalRecord[];
  totalCount: number;
  isLoading: boolean;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function usePaginatedRecords(
  options: UsePaginatedRecordsOptions
): UsePaginatedRecordsResult {
  const { accountId, dateFrom, dateTo, status } = options;

  // Live query from IndexedDB - automatically re-renders on changes
  const records = useLiveQuery(
    async () => {
      let query = db.records
        .where('account_id')
        .equals(accountId);

      // Note: Complex filtering may need to be done in memory
      // IndexedDB compound indexes are limited
      let results = await query.toArray();

      // Apply filters
      if (dateFrom) {
        results = results.filter(r => r.sale_date >= dateFrom);
      }
      if (dateTo) {
        results = results.filter(r => r.sale_date <= dateTo);
      }
      if (status) {
        results = results.filter(r => r.status === status);
      }

      // Sort by sale_date DESC, id DESC
      results.sort((a, b) => {
        const dateCompare = b.sale_date.localeCompare(a.sale_date);
        if (dateCompare !== 0) return dateCompare;
        return b.id.localeCompare(a.id);
      });

      return results;
    },
    [accountId, dateFrom, dateTo, status],
    [] // Default value while loading
  );

  // Sync state for this account
  const syncState = useLiveQuery(
    () => db.syncState.get(`account:${accountId}`),
    [accountId]
  );

  const hasMore = useMemo(
    () => syncState?.cursor !== null,
    [syncState]
  );

  return {
    records: records ?? [],
    totalCount: syncState?.totalEstimate ?? 0,
    isLoading: records === undefined,
    loadMore: async () => {
      // Trigger sync engine to fetch next page
      // This is handled by SyncEngine, not individual component
    },
    hasMore
  };
}
```

```typescript
// apps/web/src/components/bookkeeping/records-table-virtualized.tsx
"use client";

import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { usePaginatedRecords } from '@/hooks/use-paginated-records';
import { useSyncEngine } from '@/hooks/use-sync-engine';
import { RecordsRow } from './records-row';
import { RecordsHeader } from './records-header';

interface RecordsTableVirtualizedProps {
  accountId: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  height: number;
}

const ROW_HEIGHT = 48;

export function RecordsTableVirtualized({
  accountId,
  dateFrom,
  dateTo,
  status,
  height
}: RecordsTableVirtualizedProps) {
  const { records, totalCount, isLoading, hasMore } = usePaginatedRecords({
    accountId,
    dateFrom,
    dateTo,
    status
  });

  const { syncProgress, triggerSync } = useSyncEngine(accountId);

  // InfiniteLoader requires knowing if an item is loaded
  const isItemLoaded = (index: number) => {
    return index < records.length;
  };

  // Load more items when scrolling near the end
  const loadMoreItems = async (startIndex: number, stopIndex: number) => {
    if (hasMore && !syncProgress) {
      await triggerSync();
    }
  };

  // Item count includes placeholder for "loading more" if needed
  const itemCount = hasMore ? records.length + 1 : records.length;

  return (
    <div className="flex flex-col">
      <RecordsHeader />

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-gray-400">Loading...</div>
        </div>
      ) : (
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
          threshold={10}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={ref}
              height={height}
              itemCount={itemCount}
              itemSize={ROW_HEIGHT}
              width="100%"
              onItemsRendered={onItemsRendered}
            >
              {({ index, style }) => {
                if (!isItemLoaded(index)) {
                  return (
                    <div style={style} className="flex items-center justify-center">
                      <div className="text-gray-500">Loading more...</div>
                    </div>
                  );
                }
                return (
                  <RecordsRow
                    key={records[index].id}
                    record={records[index]}
                    style={style}
                  />
                );
              }}
            </List>
          )}
        </InfiniteLoader>
      )}
    </div>
  );
}
```

### Optimistic Updates

```typescript
// apps/web/src/hooks/use-record-mutations.ts
import { db, PendingMutation } from '@/lib/db/schema';
import { v4 as uuidv4 } from 'uuid';

export function useRecordMutations(accountId: string) {
  const updateRecord = async (
    recordId: string,
    updates: Partial<LocalRecord>
  ) => {
    // 1. Update local IndexedDB immediately (optimistic)
    await db.records.update(recordId, {
      ...updates,
      _localVersion: (await db.records.get(recordId))?._localVersion ?? 0 + 1
    });

    // 2. Queue mutation for sync
    await db.pendingMutations.add({
      id: uuidv4(),
      account_id: accountId,
      record_id: recordId,
      action: 'update',
      data: updates,
      createdAt: new Date().toISOString(),
      retryCount: 0
    });

    // 3. Trigger background sync (debounced)
    // SyncEngine will pick this up
  };

  const deleteRecord = async (recordId: string) => {
    // 1. Delete from local IndexedDB immediately
    await db.records.delete(recordId);

    // 2. Queue mutation for sync
    await db.pendingMutations.add({
      id: uuidv4(),
      account_id: accountId,
      record_id: recordId,
      action: 'delete',
      data: {},
      createdAt: new Date().toISOString(),
      retryCount: 0
    });
  };

  return { updateRecord, deleteRecord };
}
```

### Confidence Level

**HIGH** - react-window and react-window-infinite-loader are already in package.json. Pattern based on [TanStack Virtual with React Query](https://dev.to/ainayeem/building-an-efficient-virtualized-table-with-tanstack-virtual-and-react-query-with-shadcn-2hhl) and [react-window documentation](https://blog.openreplay.com/virtualizing-large-data-lists-with-react-window/).

---

## Data Flow Diagrams

### Flow 1: Initial Load (First Time User Opens Account)

```
User selects account
        |
        v
+------------------+
| Check IndexedDB  |  No local data found
| syncState        |
+--------+---------+
         |
         v
+------------------+
| Fetch page 1     |  GET /records/paginated?account_id=X&limit=100
| from API         |
+--------+---------+
         |
         v
+------------------+
| Store in         |  db.records.bulkPut(page1)
| IndexedDB        |  db.syncState.put({cursor: "..."})
+--------+---------+
         |
         v
+------------------+
| useLiveQuery()   |  Component re-renders with data
| triggers render  |
+--------+---------+
         |
         v
+------------------+
| User scrolls     |  InfiniteLoader detects near end
| near end         |
+--------+---------+
         |
         v
+------------------+
| Fetch page 2     |  GET /records/paginated?cursor=eyJ...
| from API         |
+--------+---------+
         |
         v
+------------------+
| Append to        |  db.records.bulkPut(page2)
| IndexedDB        |  useLiveQuery() auto-updates
+------------------+
```

### Flow 2: Returning User (Has Local Data)

```
User selects account
        |
        v
+------------------+
| Check IndexedDB  |  Found: lastSyncToken = "2026-01-22T10:00:00Z"
| syncState        |
+--------+---------+
         |
         v
+------------------+
| Render from      |  useLiveQuery() returns cached data
| local cache      |  UI is immediately responsive
+--------+---------+
         |
         v (background)
+------------------+
| Delta sync       |  GET /records/sync?since=2026-01-22T10:00:00Z
| from API         |
+--------+---------+
         |
         v
+------------------+
| Apply changes    |  Upserts and deletes in IndexedDB
| to IndexedDB     |  useLiveQuery() auto-updates UI
+------------------+
```

### Flow 3: User Edits Record (Optimistic Update)

```
User clicks edit
        |
        v
+------------------+
| Update local     |  db.records.update(id, changes)
| IndexedDB        |  UI immediately reflects change
+--------+---------+
         |
         v
+------------------+
| Queue mutation   |  db.pendingMutations.add({action: 'update'})
+--------+---------+
         |
         v (background, debounced)
+------------------+
| Push to server   |  POST /records/bulk
+--------+---------+
         |
    +----+----+
    |         |
 Success    Failure
    |         |
    v         v
+-------+ +------------------+
| Clear | | Show error toast |
| queue | | Keep in queue    |
|       | | Retry later      |
+-------+ +------------------+
```

### Flow 4: Offline Then Online

```
User goes offline
        |
        v
+------------------+
| User makes edits |  All changes go to IndexedDB + pendingMutations
| locally          |  UI works normally
+--------+---------+
         |
         v
+------------------+
| Network restored |  navigator.onLine or periodic check
+--------+---------+
         |
         v
+------------------+
| Push pending     |  POST /records/bulk with all queued mutations
| mutations        |
+--------+---------+
         |
         v
+------------------+
| Delta sync       |  GET /records/sync to get any server changes
+--------+---------+
         |
         v
+------------------+
| Conflict?        |  Last-write-wins or prompt user
+------------------+
```

---

## Component Responsibilities

### Layer 1: PostgreSQL/Supabase

| Component | Responsibility |
|-----------|---------------|
| `bookkeeping_records` table | Store authoritative record data |
| `updated_at` column | Track last modification time |
| `deleted_at` column | Soft delete for sync |
| Composite index | Enable efficient cursor queries |
| RLS policies | Multi-tenant security |
| Trigger | Auto-update `updated_at` |

### Layer 2: FastAPI API

| Component | Responsibility |
|-----------|---------------|
| `GET /records/paginated` | Return page of records with cursor |
| `GET /records/sync` | Return changes since timestamp |
| `POST /records/bulk` | Process batch mutations |
| Cursor encoder/decoder | Create opaque pagination tokens |
| Rate limiting | Prevent abuse |

### Layer 3: IndexedDB (Dexie.js)

| Component | Responsibility |
|-----------|---------------|
| `db.records` | Local record cache |
| `db.syncState` | Track sync progress per account |
| `db.pendingMutations` | Queue offline edits |
| `SyncEngine` | Orchestrate sync flow |
| `useLiveQuery()` | Reactive data binding |

### Layer 4: React Components

| Component | Responsibility |
|-----------|---------------|
| `RecordsTableVirtualized` | Render visible rows only |
| `InfiniteLoader` | Trigger pagination on scroll |
| `usePaginatedRecords` | Combine IndexedDB with pagination |
| `useRecordMutations` | Handle optimistic updates |
| `SyncStatusIndicator` | Show sync progress |

---

## Suggested Build Order

The layers have dependencies that dictate build order:

### Phase A: Server Foundation (Layer 1)

**Depends on:** Nothing (foundational)
**Delivers:** Schema changes, indexes, triggers

1. Add `updated_at` and `deleted_at` columns to tables
2. Create composite indexes for cursor pagination
3. Create trigger for auto-updating `updated_at`
4. Test queries directly in Supabase

### Phase B: API Endpoints (Layer 2)

**Depends on:** Phase A (database schema)
**Delivers:** New pagination and sync endpoints

1. Create `records_paginated.py` router with cursor pagination
2. Create `records_sync.py` router for delta sync
3. Add bulk write endpoint
4. Test with curl/Postman

### Phase C: Client Storage (Layer 3)

**Depends on:** Phase B (API endpoints to sync with)
**Delivers:** IndexedDB schema, sync engine

1. Install Dexie.js: `npm install dexie dexie-react-hooks`
2. Create database schema (`lib/db/schema.ts`)
3. Build SyncEngine class
4. Create React hooks for sync

### Phase D: Rendering Integration (Layer 4)

**Depends on:** Phase C (data source from IndexedDB)
**Delivers:** Virtualized table, complete integration

1. Create virtualized table component
2. Integrate with usePaginatedRecords hook
3. Add optimistic mutation handling
4. Add sync status UI
5. Replace existing `RecordsTable` component

### Dependency Diagram

```
Phase A -----> Phase B -----> Phase C -----> Phase D
(DB)           (API)          (IndexedDB)    (React)

No dependencies   Needs DB      Needs API     Needs IndexedDB
```

---

## File Structure Recommendation

```
apps/api/src/app/
  routers/
    records.py               # Existing (keep for now)
    records_paginated.py     # NEW: Cursor pagination
    records_sync.py          # NEW: Delta sync
  services/
    sync/
      __init__.py
      cursor.py              # Cursor encode/decode
      delta.py               # Delta detection logic

apps/web/src/
  lib/
    db/
      index.ts               # NEW: Export database
      schema.ts              # NEW: Dexie schema
      sync-engine.ts         # NEW: Sync orchestration
      migrations.ts          # NEW: Schema migrations
    api.ts                   # Existing (extend with new endpoints)

  hooks/
    use-paginated-records.ts # NEW: IndexedDB + pagination
    use-sync-engine.ts       # NEW: Sync engine React wrapper
    use-record-mutations.ts  # NEW: Optimistic updates
    use-online-status.ts     # NEW: Network detection

  components/
    bookkeeping/
      records-table.tsx             # Existing (deprecate later)
      records-table-virtualized.tsx # NEW: Virtualized version
      records-row.tsx               # NEW: Row component
      records-header.tsx            # NEW: Fixed header
    sync/
      sync-status-indicator.tsx     # NEW: Sync progress
      offline-banner.tsx            # NEW: Offline indicator
      pending-changes-badge.tsx     # NEW: Mutation queue count
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Offset Pagination for Large Datasets

**What:** Using `OFFSET 1000 LIMIT 50` for pagination
**Why bad:** Performance degrades linearly; O(n) for page n
**Instead:** Use cursor-based pagination with indexed columns

### Anti-Pattern 2: Full Refresh on Every Load

**What:** Fetching all records from server every time
**Why bad:** Wastes bandwidth, slow initial loads
**Instead:** Delta sync with `updated_since` timestamp

### Anti-Pattern 3: Keeping All Data in React State

**What:** Storing millions of records in `useState`
**Why bad:** Memory pressure, re-render performance
**Instead:** IndexedDB for storage, virtualization for rendering

### Anti-Pattern 4: Synchronous IndexedDB Access

**What:** Blocking main thread waiting for IndexedDB
**Why bad:** Janky UI, unresponsive scrolling
**Instead:** Async operations, Web Workers for heavy processing

### Anti-Pattern 5: No Conflict Resolution Strategy

**What:** Assuming offline edits never conflict
**Why bad:** Data loss when concurrent edits occur
**Instead:** Implement last-write-wins or merge strategy

---

## Sources

### Cursor Pagination
- [Speakeasy - Pagination Best Practices](https://www.speakeasy.com/api-design/pagination)
- [JSON API Cursor Pagination Profile](https://jsonapi.org/profiles/ethanresnick/cursor-pagination/)
- [FastAPI Pagination Library](https://uriyyo-fastapi-pagination.netlify.app/)

### IndexedDB and Dexie.js
- [Dexie.js React Tutorial](https://dexie.org/docs/Tutorial/React)
- [useLiveQuery() Documentation](https://dexie.org/docs/dexie-react-hooks/useLiveQuery())
- [Dexie.js with Next.js](https://medium.com/dexie-js/dexie-js-next-js-fd15556653e6)

### Delta Sync and Offline-First
- [AWS AppSync Delta Sync](https://docs.aws.amazon.com/appsync/latest/devguide/tutorial-delta-sync.html)
- [Offline-First Frontend Apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Android Offline-First Architecture Guide](https://developer.android.com/topic/architecture/data-layer/offline-first)

### Virtualization
- [react-window Documentation](https://blog.openreplay.com/virtualizing-large-data-lists-with-react-window/)
- [TanStack Virtual with React Query](https://dev.to/ainayeem/building-an-efficient-virtualized-table-with-tanstack-virtual-and-react-query-with-shadcn-2hhl)
- [Syncfusion - Rendering Large Datasets](https://www.syncfusion.com/blogs/post/render-large-datasets-in-react)

---

*Architecture research: 2026-01-23*
