---
phase: 29-app-wide-persistent-cache
plan: 03
subsystem: data
tags: [accounts, indexeddb, v3-sync, dexie, live-query]

# Dependency graph
requires:
  - phase: 18
    provides: db.accounts table, syncAccounts() function, Dexie.js infrastructure
  - phase: 29-01
    provides: useCachedQuery hook for admin mode
provides:
  - useSyncAccounts hook with reactive IndexedDB reads and background sync
  - /va/accounts loads instantly from IndexedDB
  - accounts-table dual-mode: admin (useCachedQuery) and VA (useSyncAccounts)
affects: [30-*]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useLiveQuery for reactive IndexedDB reads (auto-updates when db.accounts changes)"
    - "syncAccounts() on mount for background sync"
    - "In-memory search filter and sort on IndexedDB results"
    - "Dual-mode component: useCachedQuery (admin) vs useSyncAccounts (VA)"

key-files:
  created:
    - apps/web/src/hooks/sync/use-sync-accounts.ts
  modified:
    - apps/web/src/app/va/accounts/page.tsx
    - apps/web/src/components/admin/accounts-table.tsx

key-decisions:
  - "Full V3 sync for accounts (not useCachedQuery) because db.accounts + syncAccounts() already exist"
  - "useLiveQuery provides reactive updates — when syncAccounts writes to IndexedDB, UI updates automatically"
  - "In-memory search filtering acceptable for accounts dataset size (typically <500 records)"
  - "Concurrent sync guard via useRef prevents duplicate syncAccounts() calls"

patterns-established:
  - "useSyncAccounts as the account data access pattern (replaces direct API fetch)"
  - "Dual-mode component pattern for admin/VA role-based data loading"

# Metrics
duration: retroactive
completed: 2026-01-27
---

# Phase 29 Plan 03: Complete Accounts V3 Wiring Summary

**useSyncAccounts hook + /va/accounts and accounts-table wired to IndexedDB-first loading**

## Performance

- **Duration:** Retroactive documentation (implemented ad-hoc)
- **Completed:** 2026-01-27
- **Tasks:** 3
- **Files created:** 1
- **Files modified:** 2

## Accomplishments
- Created useSyncAccounts hook using useLiveQuery for reactive IndexedDB reads from db.accounts
- Background syncAccounts() call on mount with concurrent sync guard (useRef)
- In-memory search filtering and account_code sorting on IndexedDB results
- Wired /va/accounts page to use useSyncAccounts instead of direct API fetch
- Updated accounts-table with dual mode: useCachedQuery for admin, useSyncAccounts for VA

## Files Created/Modified
- `apps/web/src/hooks/sync/use-sync-accounts.ts` — useSyncAccounts hook (new)
- `apps/web/src/app/va/accounts/page.tsx` — Uses useSyncAccounts for instant loading
- `apps/web/src/components/admin/accounts-table.tsx` — Dual admin/VA data loading modes

## Decisions Made

**1. Full V3 sync for accounts, not useCachedQuery**
- **Rationale:** db.accounts table and syncAccounts() already existed from Phase 18 (90% wired). useLiveQuery provides reactive updates that useCachedQuery can't — when sync writes new data, the UI updates automatically without a rerender.
- **Impact:** Accounts get the best possible UX — reactive, instant, live-updating.

**2. useLiveQuery for reactive reads**
- **Rationale:** Dexie's useLiveQuery re-runs the query whenever the underlying IndexedDB table changes. This means syncAccounts() writes trigger automatic UI updates.
- **Impact:** No manual refetch needed — data stays in sync with IndexedDB.

**3. In-memory search filtering**
- **Rationale:** Accounts dataset is small (typically <500 records). IndexedDB compound indexes for full-text search are complex and unnecessary at this scale.
- **Impact:** Simple, fast, no index management overhead.

**4. Concurrent sync guard via useRef**
- **Rationale:** React Strict Mode double-mounts effects. Without the guard, syncAccounts() could run twice concurrently.
- **Impact:** Single sync operation at a time, preventing race conditions.

## Deviations from Plan

None — retroactive documentation of ad-hoc implementation.

## Issues Encountered

None.

## Next Phase Readiness

**Ready for Phase 30 (Skeletons & Empty States):**
- All data pages now have cache-first or sync-first patterns
- Skeleton loading states work with the new data loading hooks

**Blockers/Concerns:**
- None

---
*Phase: 29-app-wide-persistent-cache*
*Completed: 2026-01-27*
