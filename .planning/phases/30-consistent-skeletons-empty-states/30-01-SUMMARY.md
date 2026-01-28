---
phase: 30-consistent-skeletons-empty-states
plan: 01
subsystem: ui
tags: [skeleton, loading-states, react, tailwindcss, shadcn]

# Dependency graph
requires:
  - phase: 29-app-wide-persistent-cache
    provides: "useCachedQuery hook and skeleton components (TableSkeleton, DashboardSkeleton)"
provides:
  - "VA layout skeleton loading state with sidebar shell"
  - "Skeleton loading states for all 3 automation sub-tables (jobs, agents, pairing requests)"
  - "Zero 'Loading...' text in VA layout and automation tables"
affects: [30-02, 30-03, 30-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skeleton-in-table: render TableSkeleton inside TableCell with p-0 for seamless appearance"
    - "Layout skeleton: render sidebar with empty sections + DashboardSkeleton during auth/role check"

key-files:
  created: []
  modified:
    - apps/web/src/app/va/layout.tsx
    - apps/web/src/components/admin/automation/jobs-table.tsx
    - apps/web/src/components/admin/automation/agents-table.tsx
    - apps/web/src/components/admin/automation/pairing-requests-table.tsx

key-decisions:
  - "Preserved loading && !data guard pattern so cached data displays instantly on revisits"
  - "VA layout renders empty sidebar sections during loading to maintain structural familiarity"

patterns-established:
  - "Skeleton guard pattern: always use `loading && !data` not just `loading` to avoid skeleton flash with cached data"

# Metrics
duration: 2min
completed: 2026-01-28
---

# Phase 30 Plan 01: VA Layout & Automation Tables Skeleton Loading States

**Replaced 4 "Loading..." text strings with structured skeleton components (DashboardSkeleton for VA layout, TableSkeleton for 3 automation sub-tables)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-28T00:59:33Z
- **Completed:** 2026-01-28T01:02:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- VA layout now renders sidebar shell + DashboardSkeleton during role-check loading instead of centered "Loading..." text
- Jobs table shows TableSkeleton(columns=5, rows=5) during initial data fetch
- Agents table shows TableSkeleton(columns=6, rows=4) during initial data fetch
- Pairing requests table shows TableSkeleton(columns=5, rows=3) during initial data fetch
- All `loading && !data` guard patterns preserved for instant cached data display

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace VA layout and automation table "Loading..." with skeletons** - `00e1569` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `apps/web/src/app/va/layout.tsx` - VA layout with sidebar shell + DashboardSkeleton during loading
- `apps/web/src/components/admin/automation/jobs-table.tsx` - Jobs table with TableSkeleton(5 cols, 5 rows)
- `apps/web/src/components/admin/automation/agents-table.tsx` - Agents table with TableSkeleton(6 cols, 4 rows)
- `apps/web/src/components/admin/automation/pairing-requests-table.tsx` - Pairing requests table with TableSkeleton(5 cols, 3 rows)

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 30-02 can proceed: remaining "Loading..." text in sellers grid and history panel are next targets
- All skeleton components (TableSkeleton, DashboardSkeleton) are proven and reusable
- No blockers or concerns

---
*Phase: 30-consistent-skeletons-empty-states*
*Completed: 2026-01-28*
