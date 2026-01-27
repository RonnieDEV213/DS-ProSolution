---
status: diagnosed
phase: 28-collection-storage-rendering-infrastructure
source: 28-01-SUMMARY.md, 28-02-SUMMARY.md, 28-03-SUMMARY.md, 28-04-SUMMARY.md, 28-05-SUMMARY.md, 28-06-SUMMARY.md
started: 2026-01-27T18:00:00Z
updated: 2026-01-27T18:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sellers Grid Loads from IndexedDB Cache
expected: Navigate to the Collection/Sellers page. Sellers load and display. On revisit or refresh, sellers appear instantly from cache (no loading spinner for cached data). Background sync refreshes silently.
result: issue
reported: "The grid of sellers are gone, it says no sellers but in the database there are 4700 sellers stored. When adding a new seller it doesn't appear either, but when adding an existing seller it says failed to add seller."
severity: blocker

### 2. Seller Search is Debounced
expected: Type in the seller search input. There should be a ~300ms delay before the grid filters, preventing excessive filtering on every keystroke. The results update after you stop typing briefly.
result: skipped
reason: Blocked by Test 1 — no sellers showing

### 3. Flag a Single Seller
expected: Click the flag toggle on a seller. The flag state should update optimistically (immediately in the UI) without waiting for the server response. The flagged state persists on page refresh.
result: skipped
reason: Blocked by Test 1 — no sellers showing

### 4. Bulk Flag Paint (Drag Select + Flag)
expected: Drag-select multiple sellers, then apply flag paint. All selected sellers update their flag state immediately (optimistic). The changes persist on refresh.
result: skipped
reason: Blocked by Test 1 — no sellers showing

### 5. Edit Seller Display Name
expected: Click to edit a seller's display name, change it, and save. The new name appears immediately in the grid (optimistic update). The change persists on refresh.
result: skipped
reason: Blocked by Test 1 — no sellers showing

### 6. Delete Sellers with Undo
expected: Select one or more sellers and delete them. They disappear immediately from the grid. An undo option should be available. Clicking undo restores the deleted sellers. Only single-level undo (no redo).
result: skipped
reason: Blocked by Test 1 — no sellers showing

### 7. Add a New Seller
expected: Use the add seller functionality to create a new seller. After the server responds, the new seller appears in the grid (synced from server into IndexedDB). The new seller persists on refresh.
result: skipped
reason: Blocked by Test 1 — no sellers showing

### 8. Export Sellers (Small Dataset)
expected: With fewer than 10,000 sellers, trigger an export (CSV or JSON). The export should generate client-side from IndexedDB data and download a file with seller fields (display_name, normalized_name, platform, platform_id, times_seen, flagged, etc.). Internal fields (id, org_id, run IDs) should NOT appear in the export.
result: skipped
reason: Blocked by Test 1 — no sellers showing

### 9. Syncing Indicator in Header
expected: When the sellers grid is performing a background sync, a "(syncing...)" indicator should appear in the header area. It disappears once sync completes.
result: pass

### 10. Collection Run History Loads from Cache
expected: Navigate to the Collection History page/panel. Run history should load. On revisit, previously loaded run history appears instantly from IndexedDB cache before any server refresh.
result: skipped
reason: Requires running collection on separate device first; scope unclear due to blocker

### 11. Collection Polling Status
expected: When a collection run is active, the polling mechanism should show active run progress. When no run is active, polling should be idle. The status updates reflect in the collection progress UI.
result: skipped
reason: No active collection run available to test

### 12. Offline Mutation Queuing
expected: If you toggle a seller's flag while offline (or with network disconnected), the UI should update optimistically. The mutation should be queued. When connectivity returns, the queued mutation is sent to the server.
result: skipped
reason: Blocked by Test 1 — no sellers showing

## Summary

total: 12
passed: 1
issues: 1
pending: 0
skipped: 10

## Gaps

- truth: "Sellers grid loads 4700 sellers from IndexedDB cache and displays them"
  status: failed
  reason: "User reported: The grid of sellers are gone, it says no sellers but in the database there are 4700 sellers stored. When adding a new seller it doesn't appear either, but when adding an existing seller it says failed to add seller."
  severity: blocker
  test: 1
  root_cause: "GET /sync/sellers endpoint uses get_supabase_for_user(user['token']) which is subject to RLS, but the sellers table has NO authenticated user SELECT policy — only a service_role policy. Supabase silently returns 0 rows. The old SellersGrid worked because it called GET /sellers (service role), not the sync endpoint."
  artifacts:
    - path: "apps/api/src/app/routers/sync.py"
      issue: "Line 276: Uses get_supabase_for_user() — user-scoped client subject to RLS"
    - path: "apps/api/migrations/037_collection_infrastructure.sql"
      issue: "Lines 145, 157-158: Only service_role RLS policy on sellers table, no authenticated user policy"
  missing:
    - "Add authenticated user RLS SELECT policy on sellers table scoped to org_id via memberships"
  debug_session: ".planning/debug/sellers-grid-no-data.md"
