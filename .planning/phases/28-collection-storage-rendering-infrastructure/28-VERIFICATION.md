---
phase: 28-collection-storage-rendering-infrastructure
verified: 2026-01-27T23:33:34Z
status: passed
score: 14/14 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 14/14
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 28: Collection Storage & Rendering Infrastructure Verification Report

**Phase Goal:** Wire v3 sync infrastructure (IndexedDB, incremental sync, TanStack Query, mutation hooks) into the collection SellersGrid, replacing direct fetch+useState with cache-first offline-capable architecture
**Verified:** 2026-01-27T23:33:34Z
**Status:** PASSED
**Re-verification:** Yes -- confirming previous passed verification against actual codebase

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Query key factory includes sellers keys for cache management | VERIFIED | `apps/web/src/lib/query-keys.ts` lines 52-61: `sellers: { all, list, infinite }` with `SellerFilters` interface at lines 15-18 |
| 2 | api.ts exports typed seller CRUD functions (6 functions) and getAccessToken | VERIFIED | `apps/web/src/lib/api.ts` line 5: `export async function getAccessToken()`, lines 306-355: `sellerApi` with createSeller, createSellersBulk, updateSeller, deleteSeller, bulkDeleteSellers, flagSeller |
| 3 | executeMutation dispatches seller operations to correct API functions | VERIFIED | `apps/web/src/lib/db/pending-mutations.ts` lines 183-203: `case 'sellers':` with create/update/delete dispatch, flag via `sellerApi.flagSeller`, name via `sellerApi.updateSeller`, import of `sellerApi` at line 2 |
| 4 | Streaming CSV/JSON export endpoints for sellers exist on backend | VERIFIED | `apps/api/src/app/routers/export.py` lines 201-255: GET `/sellers/csv` and `/sellers/json` with `seller_collection.read` permission. `apps/api/src/app/services/export_service.py` lines 342-490: `generate_sellers_csv_stream` and `generate_sellers_json_stream` with cursor pagination |
| 5 | useSyncSellers returns sellers from IndexedDB via useLiveQuery | VERIFIED | `apps/web/src/hooks/sync/use-sync-sellers.ts` 127 lines: `useLiveQuery` reads from `db.sellers` (line 43), imports `syncSellers` from `@/lib/db/sync` (line 6), background sync on mount (line 113-115), returns `{ sellers, isLoading, isSyncing, error, totalCount, flaggedCount, refetch }` |
| 6 | Seller mutation hooks exist with optimistic updates and offline queue | VERIFIED | `use-flag-seller.ts` 53 lines: optimistic `db.sellers.update` + `sellerApi.flagSeller` + offline queue + rollback. `use-update-seller.ts` 62 lines: optimistic `db.sellers.update` + snapshot rollback. `use-delete-seller.ts` 87 lines: `db.sellers.bulkDelete` + bulk/single API dispatch + rollback + sync reset |
| 7 | SellersGrid reads from useSyncSellers, not fetch+useState | VERIFIED | `sellers-grid.tsx` line 28: `import { useSyncSellers }`, line 233: `useSyncSellers({ filters: ... })`. Zero `useState<Seller[]>` or `setSellers` calls. No `createClient` import. No `supabase` references |
| 8 | No direct fetch() calls for seller CRUD remain in SellersGrid | VERIFIED | grep for `setSellers` returns 0 matches. `API_BASE` used only at line 985 for server-side streaming export (not CRUD). No `fetch(*sellers` for CRUD operations |
| 9 | SellersGrid uses mutation hooks for all writes | VERIFIED | Line 240: `flagMutation = useFlagSeller()`, line 241: `updateMutation = useUpdateSeller()`, line 242: `deleteMutation = useDeleteSeller()`. `flagMutation.mutate` at lines 739, 757, 961. `updateMutation.mutate` at line 922. `deleteMutation.mutateAsync` at line 481. `sellerApi.createSeller/createSellersBulk` for add at lines 437, 439, 893, 895 |
| 10 | Large-dataset export routes to server-side streaming | VERIFIED | Line 40: `LARGE_EXPORT_THRESHOLD = 10_000`. Lines 1010-1012: CSV routes to `serverSideExport('csv')` when `totalCount > LARGE_EXPORT_THRESHOLD`. Lines 1038-1040: JSON same pattern. `serverSideExport` at line 981 fetches from `/export/sellers/{format}` with auth token |
| 11 | Collection run history loads from IndexedDB via useSyncRunHistory | VERIFIED | `use-sync-run-history.ts` 71 lines: `useLiveQuery` on `db.collection_runs` (line 28-34), `syncCollectionRuns()` on mount (line 48). `collection-history.tsx` line 10: import, line 57: `const { runs, isLoading, refetch } = useSyncRunHistory()`. `history-panel.tsx` line 5: import, line 68: `const { runs, isLoading: runsLoading } = useSyncRunHistory()` |
| 12 | useCollectionPolling uses TanStack Query with refetchInterval | VERIFIED | `use-collection-polling.ts` 142 lines: `import { useQuery }` from `@tanstack/react-query` (line 3), `queryKeys.collection.runs.active()` (line 55), `refetchInterval: pollingInterval` (lines 72, 113), `refetchIntervalInBackground: false` (lines 74, 114), `getAccessToken` from `@/lib/api` (line 6). Zero `setInterval`/`clearInterval` calls |
| 13 | collection_runs Dexie table exists with proper schema | VERIFIED | `apps/web/src/lib/db/index.ts` line 6: `SCHEMA_VERSION = 4` (bumped beyond plan's 3 due to later _query_cache addition), line 13: `collection_runs: EntityTable<CollectionRunRecord, 'id'>`, line 24: `collection_runs: 'id, status, started_at, updated_at'`. `schema.ts` lines 46-67: `CollectionRunRecord` interface with full run metadata |
| 14 | Authenticated user RLS SELECT policy on sellers table | VERIFIED | `apps/api/migrations/052_sellers_authenticated_rls.sql` 47 lines: `CREATE POLICY "authenticated_select_sellers" ON sellers FOR SELECT TO authenticated USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'))`. Service role policy not touched |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/query-keys.ts` | Seller query key factory + collection keys | VERIFIED | 99 lines, sellers namespace + collection.runs namespace |
| `apps/web/src/lib/api.ts` | sellerApi with 6 functions + exported getAccessToken | VERIFIED | sellerApi lines 306-355, getAccessToken exported line 5 |
| `apps/web/src/lib/db/pending-mutations.ts` | Seller mutation dispatch in executeMutation | VERIFIED | 228 lines, `case 'sellers':` lines 183-203 |
| `apps/web/src/lib/db/schema.ts` | SellerRecord + CollectionRunRecord types | VERIFIED | 95 lines, SellerRecord lines 33-43, CollectionRunRecord lines 46-67 |
| `apps/web/src/lib/db/index.ts` | Dexie schema with sellers + collection_runs tables | VERIFIED | 32 lines, SCHEMA_VERSION=4, both tables with indexes |
| `apps/web/src/lib/db/sync.ts` | syncSellers + syncCollectionRuns functions | VERIFIED | 322 lines, syncSellers lines 169-224, syncCollectionRuns lines 233-296 |
| `apps/web/src/hooks/sync/use-sync-sellers.ts` | Cache-first seller data hook | VERIFIED | 127 lines, exports useSyncSellers, uses useLiveQuery + syncSellers |
| `apps/web/src/hooks/sync/use-sync-run-history.ts` | Cache-first run history hook | VERIFIED | 71 lines, exports useSyncRunHistory, uses useLiveQuery + syncCollectionRuns |
| `apps/web/src/hooks/mutations/use-flag-seller.ts` | Flag toggle mutation hook | VERIFIED | 53 lines, optimistic IndexedDB update + API + offline queue + rollback |
| `apps/web/src/hooks/mutations/use-update-seller.ts` | Name update mutation hook | VERIFIED | 62 lines, optimistic IndexedDB update + snapshot rollback + offline queue |
| `apps/web/src/hooks/mutations/use-delete-seller.ts` | Bulk delete mutation hook | VERIFIED | 87 lines, optimistic bulkDelete + snapshot rollback + sync reset on error |
| `apps/web/src/hooks/use-collection-polling.ts` | TanStack Query polling hook | VERIFIED | 142 lines, useQuery with refetchInterval, getAccessToken, queryKeys.collection |
| `apps/web/src/components/admin/collection/sellers-grid.tsx` | Fully migrated SellersGrid | VERIFIED | 1415 lines, useSyncSellers for reads, mutation hooks for writes, no setSellers, no direct fetch CRUD |
| `apps/api/src/app/routers/export.py` | Streaming seller export endpoints | VERIFIED | GET /sellers/csv and /sellers/json with StreamingResponse, seller_collection.read permission |
| `apps/api/src/app/services/export_service.py` | Seller CSV/JSON stream generators | VERIFIED | generate_sellers_csv_stream (line 342) and generate_sellers_json_stream (line 426) with cursor pagination |
| `apps/api/migrations/052_sellers_authenticated_rls.sql` | Authenticated user RLS SELECT policy | VERIFIED | 47 lines, CREATE POLICY + updated_at backfill + schema reload |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| sellers-grid.tsx | use-sync-sellers.ts | useSyncSellers hook call | WIRED | Line 28: import, line 233: hook call with filters |
| sellers-grid.tsx | use-flag-seller.ts | useFlagSeller hook | WIRED | Line 29: import, line 240: init, lines 739/757/961: mutate calls |
| sellers-grid.tsx | use-update-seller.ts | useUpdateSeller hook | WIRED | Line 30: import, line 241: init, line 922: mutate call |
| sellers-grid.tsx | use-delete-seller.ts | useDeleteSeller hook | WIRED | Line 31: import, line 242: init, line 481: mutateAsync call |
| sellers-grid.tsx | api.ts sellerApi | sellerApi.createSeller/createSellersBulk | WIRED | Line 34: import, lines 437/439/893/895: API calls for add |
| sellers-grid.tsx | export.py endpoints | serverSideExport fetch | WIRED | Line 981-985: authenticated fetch to /export/sellers/{format} for >10K |
| use-sync-sellers.ts | db/sync.ts | syncSellers() import | WIRED | Line 6: import, line 101: await syncSellers() |
| use-sync-sellers.ts | db/index.ts | db.sellers via useLiveQuery | WIRED | Line 5: import db, lines 43-77: useLiveQuery on db.sellers |
| use-flag-seller.ts | api.ts | sellerApi.flagSeller | WIRED | Line 4: import, line 37: await sellerApi.flagSeller(id) |
| use-flag-seller.ts | db/index.ts | db.sellers.update | WIRED | Line 3: import db, line 24: db.sellers.update + line 41: rollback |
| use-flag-seller.ts | pending-mutations.ts | queueMutation | WIRED | Line 6: import, lines 27-33: queueMutation for offline |
| use-update-seller.ts | api.ts | sellerApi.updateSeller | WIRED | Line 4: import, line 40: await sellerApi.updateSeller |
| use-update-seller.ts | db/index.ts | db.sellers.update/put | WIRED | Line 3: import, line 28: update, line 49: rollback put |
| use-delete-seller.ts | api.ts | sellerApi.deleteSeller/bulkDeleteSellers | WIRED | Line 4: import, lines 42/44: single/bulk dispatch |
| use-delete-seller.ts | db/index.ts | db.sellers.bulkDelete | WIRED | Line 3: import, line 55: optimistic bulkDelete |
| pending-mutations.ts | api.ts | sellerApi function calls | WIRED | Line 2: import sellerApi, lines 187/192/194/199: dispatch calls |
| use-sync-run-history.ts | db/sync.ts | syncCollectionRuns() | WIRED | Line 6: import, line 48: await syncCollectionRuns() |
| use-sync-run-history.ts | db/index.ts | db.collection_runs | WIRED | Line 5: import, lines 29-33: useLiveQuery on db.collection_runs |
| collection-history.tsx | use-sync-run-history.ts | useSyncRunHistory hook | WIRED | Line 10: import, line 57: hook call |
| history-panel.tsx | use-sync-run-history.ts | useSyncRunHistory hook | WIRED | Line 5: import, line 68: hook call |
| use-collection-polling.ts | @tanstack/react-query | useQuery + refetchInterval | WIRED | Line 3: import useQuery, lines 72/113: refetchInterval config |
| use-collection-polling.ts | api.ts | getAccessToken | WIRED | Line 6: import, lines 57/89: await getAccessToken() |
| use-collection-polling.ts | query-keys.ts | queryKeys.collection.runs | WIRED | Line 5: import, lines 55/85: query key usage |
| export.py | export_service.py | generate_sellers_*_stream | WIRED | Lines 34-35: imports, lines 220/249: function calls |

### Requirements Coverage

All 7 plans' must_haves are covered by the 14 truths above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| sellers-grid.tsx | 1150, 1226, 1246, 1258 | `placeholder=` | Info | These are UI input placeholder attributes, not stub patterns |

No TODO, FIXME, or stub patterns detected in any phase-28 modified file. The only `placeholder` matches are HTML input element attributes (not code stubs).

### Human Verification Required

### 1. SellersGrid Interaction Smoke Test
**Test:** Navigate to the collection page, verify sellers load. Test click-select, shift-click, ctrl-click, drag-select, right-click flag paint, hover detail popup, Ctrl+A, Ctrl+Z (undo after delete).
**Expected:** All interactions work exactly as before migration. Seller data appears instantly on revisit (from IndexedDB cache). A "(syncing...)" indicator may briefly appear.
**Why human:** Visual behavior and interaction timing cannot be verified programmatically.

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

### 5. RLS Policy Verification
**Test:** Confirm migration 052 has been applied to the database. Navigate to sellers grid and verify all sellers load (not 0 rows).
**Expected:** Grid displays org's sellers (not empty).
**Why human:** Requires database migration status check and live app observation.

### Gaps Summary

No gaps found. All 14 must-haves are verified in the actual codebase. The phase goal -- wiring v3 sync infrastructure into the collection SellersGrid -- is achieved:

- **Data source replaced:** SellersGrid reads from IndexedDB via useSyncSellers (no fetch+useState). Zero `setSellers` calls remain.
- **Mutations migrated:** All CRUD operations use mutation hooks (flag, update, delete) or sellerApi directly (create) with optimistic IndexedDB updates and offline queue support.
- **No legacy patterns:** Zero `setSellers`, zero direct fetch for CRUD, zero `createClient`/`supabase.auth` in SellersGrid.
- **Server-side export:** Streaming CSV/JSON endpoints exist in Python backend and are wired for large datasets (>10K threshold) from the client.
- **Run history cached:** `collection_runs` Dexie table, `syncCollectionRuns()` function, `useSyncRunHistory` hook, wired into both `collection-history.tsx` and `history-panel.tsx`.
- **Polling modernized:** `useCollectionPolling` uses TanStack Query `useQuery` with `refetchInterval` (no `setInterval`/`clearInterval`).
- **Schema version bumped:** `SCHEMA_VERSION=4` with `collection_runs` and `_query_cache` tables.
- **RLS unblocked:** Migration 052 adds authenticated SELECT policy on sellers scoped to user's org via memberships.

---

_Verified: 2026-01-27T23:33:34Z_
_Verifier: Claude (gsd-verifier)_
