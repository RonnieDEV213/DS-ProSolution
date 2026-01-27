---
phase: 28-collection-storage-rendering-infrastructure
verified: 2026-01-27T18:00:00Z
status: passed
score: 14/14 must-haves verified
---

# Phase 28: Collection Storage & Rendering Infrastructure Verification Report

**Phase Goal:** Wire v3 sync infrastructure (IndexedDB, incremental sync, TanStack Query, mutation hooks) into the collection SellersGrid, replacing direct fetch+useState with cache-first offline-capable architecture
**Verified:** 2026-01-27T18:00:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Query key factory includes sellers keys | VERIFIED | `query-keys.ts` lines 52-61: `sellers: { all, list, infinite }` with `SellerFilters` interface |
| 2 | Typed seller API functions exist in api.ts | VERIFIED | `api.ts` lines 306-355: `sellerApi` object with 6 functions: `createSeller`, `createSellersBulk`, `updateSeller`, `deleteSeller`, `bulkDeleteSellers`, `flagSeller` |
| 3 | executeMutation dispatches seller operations | VERIFIED | `pending-mutations.ts` lines 183-203: `case 'sellers':` with create/update/delete handling, flag via `sellerApi.flagSeller`, name via `sellerApi.updateSeller` |
| 4 | Streaming CSV/JSON export endpoints for sellers exist | VERIFIED | `export.py` lines 201-255: `GET /sellers/csv` and `GET /sellers/json` with `seller_collection.read` permission and `flagged` filter. `export_service.py` lines 342-480+: `generate_sellers_csv_stream` and `generate_sellers_json_stream` with cursor pagination |
| 5 | useSyncSellers returns sellers from IndexedDB via useLiveQuery | VERIFIED | `use-sync-sellers.ts` lines 43-77: `useLiveQuery` reads from `db.sellers`, imports `syncSellers` from `@/lib/db/sync`, background sync on mount |
| 6 | useFlagSeller/useUpdateSeller/useDeleteSeller mutation hooks exist with optimistic updates | VERIFIED | `use-flag-seller.ts`: optimistic `db.sellers.update` + `sellerApi.flagSeller` + offline queue. `use-update-seller.ts`: optimistic `db.sellers.update` + snapshot rollback. `use-delete-seller.ts`: `db.sellers.bulkDelete` + bulk/single API dispatch + rollback |
| 7 | SellersGrid reads from useSyncSellers, not fetch+useState | VERIFIED | `sellers-grid.tsx` line 18: `import { useSyncSellers }`, line 223: `useSyncSellers({ filters: ... })`. Zero `useState<Seller[]>` or `setSellers` calls found |
| 8 | No direct fetch() calls for seller CRUD remain in SellersGrid | VERIFIED | Grep for `fetch(` in sellers-grid.tsx returns only line 956 (server-side streaming export blob download) and `refetch()` calls to the sync hook. Zero `fetch(*API_BASE*sellers` for CRUD |
| 9 | No setSellers() calls remain in SellersGrid | VERIFIED | Grep for `setSellers` in sellers-grid.tsx returns zero matches |
| 10 | SSE handlers use db.sellers or refetch, not setSellers | VERIFIED | Line 205 comment confirms: "No SSE handlers push seller data directly; parent refreshTrigger triggers re-sync". SSE handlers in `activity-feed.tsx` and `progress-detail-modal.tsx` only handle activity stream display, not seller data |
| 11 | Large-dataset export routes to server-side streaming | VERIFIED | `sellers-grid.tsx` line 30: `LARGE_EXPORT_THRESHOLD = 10_000`, lines 979/1007: `if (totalCount > LARGE_EXPORT_THRESHOLD)` routes to `serverSideExport('csv'/'json')` which calls `/export/sellers/{format}` |
| 12 | Collection run history loads from IndexedDB (useSyncRunHistory) | VERIFIED | `use-sync-run-history.ts`: full hook with `useLiveQuery` on `db.collection_runs`, `syncCollectionRuns()` on mount. `collection-history.tsx` line 57: `const { runs, isLoading, refetch } = useSyncRunHistory()`. `history-panel.tsx` line 68: `const { runs, isLoading: runsLoading } = useSyncRunHistory()` |
| 13 | useCollectionPolling uses TanStack Query with refetchInterval | VERIFIED | `use-collection-polling.ts`: imports `useQuery` from `@tanstack/react-query`, uses `queryKeys.collection.runs.active()`, `refetchInterval: pollingInterval`, `refetchIntervalInBackground: false`. Zero `setInterval`/`clearInterval` calls. Uses `getAccessToken` from `@/lib/api` |
| 14 | collection_runs Dexie table exists | VERIFIED | `index.ts` line 6: `SCHEMA_VERSION = 3`, line 13: `collection_runs: EntityTable<CollectionRunRecord, 'id'>`, line 23: `collection_runs: 'id, status, started_at, updated_at'`. `schema.ts` lines 46-67: `CollectionRunRecord` interface with full run metadata |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/query-keys.ts` | Seller query key factory | VERIFIED | 81 lines, sellers namespace with all/list/infinite + collection.runs keys |
| `apps/web/src/lib/api.ts` | sellerApi with 6 typed functions + exported getAccessToken | VERIFIED | 935 lines, sellerApi lines 306-355, getAccessToken exported line 5 |
| `apps/web/src/lib/db/pending-mutations.ts` | Seller mutation dispatch in executeMutation | VERIFIED | 228 lines, `case 'sellers':` lines 183-203 with create/update/delete/flag dispatch |
| `apps/web/src/lib/db/schema.ts` | SellerRecord + CollectionRunRecord types | VERIFIED | 88 lines, SellerRecord lines 33-43, CollectionRunRecord lines 46-67 |
| `apps/web/src/lib/db/index.ts` | Dexie schema with sellers + collection_runs tables, SCHEMA_VERSION=3 | VERIFIED | 30 lines, SCHEMA_VERSION=3, both tables with indexes |
| `apps/web/src/lib/db/sync.ts` | syncSellers + syncCollectionRuns functions | VERIFIED | 321 lines, syncSellers lines 169-224, syncCollectionRuns lines 233-296 |
| `apps/web/src/hooks/sync/use-sync-sellers.ts` | Cache-first seller data hook | VERIFIED | 127 lines, exports useSyncSellers, uses useLiveQuery + syncSellers |
| `apps/web/src/hooks/sync/use-sync-run-history.ts` | Cache-first run history hook | VERIFIED | 71 lines, exports useSyncRunHistory, uses useLiveQuery + syncCollectionRuns |
| `apps/web/src/hooks/mutations/use-flag-seller.ts` | Flag toggle mutation hook | VERIFIED | 53 lines, optimistic IndexedDB update + API call + offline queue + rollback |
| `apps/web/src/hooks/mutations/use-update-seller.ts` | Name update mutation hook | VERIFIED | 62 lines, optimistic IndexedDB update + snapshot rollback + offline queue |
| `apps/web/src/hooks/mutations/use-delete-seller.ts` | Bulk delete mutation hook | VERIFIED | 73 lines, optimistic bulkDelete + snapshot rollback + single/bulk API dispatch |
| `apps/web/src/hooks/use-collection-polling.ts` | TanStack Query polling hook | VERIFIED | 142 lines, useQuery with refetchInterval, getAccessToken, queryKeys.collection |
| `apps/web/src/components/admin/collection/sellers-grid.tsx` | Fully migrated SellersGrid | VERIFIED | 1360 lines, useSyncSellers for reads, mutation hooks for writes, no setSellers, no direct fetch CRUD |
| `apps/api/src/app/routers/export.py` | Streaming seller export endpoints | VERIFIED | GET /sellers/csv and /sellers/json with StreamingResponse, seller_collection.read permission |
| `apps/api/src/app/services/export_service.py` | Seller CSV/JSON stream generators | VERIFIED | generate_sellers_csv_stream and generate_sellers_json_stream with cursor pagination |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| sellers-grid.tsx | use-sync-sellers.ts | useSyncSellers hook call | WIRED | Line 18: import, line 223: hook call with filters |
| sellers-grid.tsx | use-flag-seller.ts | useFlagSeller hook | WIRED | Line 19: import, line 230: init, lines 708/726/930: mutate calls |
| sellers-grid.tsx | use-update-seller.ts | useUpdateSeller hook | WIRED | Line 20: import, line 231: init, line 891: mutate call |
| sellers-grid.tsx | use-delete-seller.ts | useDeleteSeller hook | WIRED | Line 21: import, line 232: init, line 456: mutate call |
| sellers-grid.tsx | export.py server endpoints | serverSideExport fetch | WIRED | Lines 950-971: authenticated fetch to /export/sellers/{format} for >10K sellers |
| use-sync-sellers.ts | db/sync.ts | syncSellers() import | WIRED | Line 6: import, line 101: await syncSellers() |
| use-sync-sellers.ts | db/index.ts | db.sellers via useLiveQuery | WIRED | Line 5: import db, lines 43-77: useLiveQuery on db.sellers |
| use-flag-seller.ts | api.ts | sellerApi.flagSeller | WIRED | Line 4: import, line 37: await sellerApi.flagSeller(id) |
| use-flag-seller.ts | db/index.ts | db.sellers.update | WIRED | Line 3: import db, line 24: db.sellers.update + line 41: rollback |
| pending-mutations.ts | api.ts | sellerApi function calls | WIRED | Line 2: import sellerApi, lines 187/192/194/199: dispatch calls |
| use-sync-run-history.ts | db/sync.ts | syncCollectionRuns() | WIRED | Line 6: import, line 48: await syncCollectionRuns() |
| collection-history.tsx | use-sync-run-history.ts | useSyncRunHistory hook | WIRED | Line 10: import, line 57: hook call |
| history-panel.tsx | use-sync-run-history.ts | useSyncRunHistory hook | WIRED | Line 5: import, line 68: hook call |
| use-collection-polling.ts | @tanstack/react-query | useQuery + refetchInterval | WIRED | Line 3: import useQuery, lines 72/113: refetchInterval config |
| use-collection-polling.ts | api.ts | getAccessToken | WIRED | Line 6: import, lines 57/89: await getAccessToken() |
| export.py | export_service.py | generate_sellers_*_stream | WIRED | Lines 34-35: imports, lines 220/249: function calls in endpoints |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none found) | - | - | - | No TODO, FIXME, placeholder, or stub patterns detected in any modified file |

### Human Verification Required

### 1. SellersGrid Interaction Smoke Test
**Test:** Navigate to the collection page, verify sellers load, try click-select, shift-click, drag-select, right-click flag paint, hover detail popup, Ctrl+A, Ctrl+Z (undo after delete)
**Expected:** All interactions work exactly as before migration. Seller data appears instantly on revisit (from IndexedDB cache). A "(syncing...)" indicator may briefly appear.
**Why human:** Visual behavior and interaction patterns cannot be verified programmatically.

### 2. Offline Flag Queuing
**Test:** Disconnect network, flag a seller, reconnect. Verify the flag persists after reconnect and sync.
**Expected:** Flag immediately reflects in UI (IndexedDB optimistic update), queues for server sync, syncs on reconnect.
**Why human:** Requires network manipulation and observation of offline/online transitions.

### 3. Large Export Routing
**Test:** If >10K sellers exist, trigger CSV export and verify it downloads via streaming (server-side). If <10K, verify client-side export still works.
**Expected:** Large datasets route to `/export/sellers/csv` server endpoint; small datasets export client-side.
**Why human:** Requires specific dataset size conditions.

### 4. Collection Run History Cache
**Test:** Navigate to collection history, observe load. Navigate away, return. Second visit should load instantly from IndexedDB.
**Expected:** First visit syncs from server. Second visit shows cached data immediately with background sync.
**Why human:** Requires page navigation timing observation.

### Gaps Summary

No gaps found. All 14 must-haves are verified in the actual codebase. The phase goal -- wiring v3 sync infrastructure into the collection SellersGrid -- is achieved:

- **Data source replaced:** SellersGrid reads from IndexedDB via useSyncSellers (no fetch+useState)
- **Mutations migrated:** All CRUD operations use mutation hooks with optimistic IndexedDB updates + offline queue
- **No legacy patterns:** Zero setSellers, zero direct fetch for CRUD, zero createClient/supabase.auth in SellersGrid
- **Server-side export:** Streaming CSV/JSON endpoints exist and are wired for large datasets (>10K threshold)
- **Run history cached:** collection_runs Dexie table, useSyncRunHistory hook, wired into both collection-history.tsx and history-panel.tsx
- **Polling modernized:** useCollectionPolling uses TanStack Query with refetchInterval (no setInterval)
- **Schema version bumped:** SCHEMA_VERSION=3 with collection_runs table

---

_Verified: 2026-01-27T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
