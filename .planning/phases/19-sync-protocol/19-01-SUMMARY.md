---
phase: 19-sync-protocol
plan: 01
subsystem: ui
tags: [sync, offline, react, hooks, useSyncExternalStore, useMutationState, date-fns, framer-motion]

# Dependency graph
requires:
  - phase: 18-02
    provides: IndexedDB sync engine with _sync_meta table, useLiveQuery pattern
provides:
  - useOnlineStatus hook for network detection
  - useSyncStatus hook for aggregated global sync state
  - SyncStatusIndicator component rendered in admin sidebar
affects: [19-02-row-badges, 19-03-offline-queue, 19-04-conflict-resolution]

# Tech tracking
tech-stack:
  added: []
  patterns: [useSyncExternalStore for browser events, useMutationState for pending tracking]

key-files:
  created:
    - apps/web/src/hooks/sync/use-online-status.ts
    - apps/web/src/hooks/sync/use-sync-status.ts
    - apps/web/src/components/sync/sync-status-indicator.tsx
  modified:
    - apps/web/src/components/admin/sidebar.tsx

key-decisions:
  - "useSyncExternalStore for online/offline detection (proper cleanup, SSR-safe)"
  - "Status priority: offline > syncing > error > idle"
  - "Show 'Last synced X ago' even in idle state for user confidence"
  - "Hidden indicator when fully synced (unobtrusive UX per CONTEXT.md)"

patterns-established:
  - "Browser event subscription via useSyncExternalStore pattern"
  - "Sync status aggregation from TanStack Query + IndexedDB sources"

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 19 Plan 01: Sync Status Indicator Summary

**Global sync indicator using useOnlineStatus + useSyncStatus hooks with SyncStatusIndicator component in admin sidebar**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-24T20:03:26Z
- **Completed:** 2026-01-24T20:06:06Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Network online/offline detection via useSyncExternalStore pattern
- Global sync status aggregation from TanStack Query mutations and IndexedDB _sync_meta
- Visual sync indicator component with syncing/error/offline states
- Framer motion transitions between status states
- "Last synced X ago" relative timestamp using date-fns

## Task Commits

Each task was committed atomically:

1. **Task 1: Create online status and sync status hooks** - `1a99b0f` (feat)
2. **Task 2: Create sync status indicator component** - `be7a3fb` (feat)
3. **Task 3: Wire sync indicator into admin sidebar** - `b436a40` (feat)

## Files Created/Modified
- `apps/web/src/hooks/sync/use-online-status.ts` - Online/offline detection hook using useSyncExternalStore
- `apps/web/src/hooks/sync/use-sync-status.ts` - Global sync status aggregation hook
- `apps/web/src/components/sync/sync-status-indicator.tsx` - Visual sync status component
- `apps/web/src/components/admin/sidebar.tsx` - Added SyncStatusIndicator above Profile Settings

## Decisions Made
- **useSyncExternalStore pattern:** Chosen over useEffect for online/offline detection to properly handle subscription cleanup and avoid memory leaks
- **Status priority order:** offline takes precedence over syncing, which takes precedence over error, which takes precedence over idle - ensures most important state is always shown
- **Show timestamp in idle:** Even when fully synced, show "Last synced X ago" to give users confidence about data freshness
- **Hidden when idle (mostly):** Main indicator hidden when idle per CONTEXT.md, but timestamp still visible

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- useOnlineStatus and useSyncStatus hooks ready for reuse in row-level badges (19-02)
- SyncStatusIndicator pattern ready for extension with conflict resolution (19-04)
- Offline queue (19-03) will extend useSyncStatus with _pending_mutations table

---
*Phase: 19-sync-protocol*
*Completed: 2026-01-24*
