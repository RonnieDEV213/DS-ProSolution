---
phase: 27-sidebar-folder-reorganization
plan: 03
subsystem: ui
tags: [react, nextjs, typescript, tailwindcss, shadcn-ui, modal, table, automation]

# Dependency graph
requires:
  - phase: 27-01
    provides: Navigation structure with sidebar sections
provides:
  - Pairing Request modal on Accounts page (admin-only)
  - Expandable agent rows in AccountsTable
  - Agent data integrated with account management
affects: [27-05, automation-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Modal integration into page toolbar actions
    - Expandable table rows with nested data
    - Client-side filtering of API data for grouping

key-files:
  created:
    - apps/web/src/components/admin/pairing-request-modal.tsx
  modified:
    - apps/web/src/app/admin/accounts/page.tsx
    - apps/web/src/components/admin/accounts-table.tsx

key-decisions:
  - "Pairing Request button visible only to admin users via useUserRole hook"
  - "Agents fetched separately and grouped by account_id client-side"
  - "Expandable rows with Fragment wrapper for account + agent rows"
  - "Chevron icons only shown when account has linked agents"

patterns-established:
  - "Toolbar actions in PageHeader support conditional rendering"
  - "Agent rows display role, status, and last seen with visual nesting"
  - "Event stopPropagation on edit button prevents row expansion toggle"

# Metrics
duration: 10min
completed: 2026-01-27
---

# Phase 27 Plan 03: Pairing Request Modal & Agent Rows Summary

**Pairing Request modal integrated into Accounts page toolbar; agents display as expandable nested rows per account**

## Performance

- **Duration:** 10 min
- **Started:** 2026-01-27T05:32:19Z
- **Completed:** 2026-01-27T05:42:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- PairingRequestModal wrapper created around existing PairingRequestsTable
- Admin-only toolbar button added to Accounts page
- Expandable agent rows integrated into AccountsTable with chevron UI
- Agents fetched from automation API and grouped by account

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PairingRequestModal and add to Accounts page** - `881e787` (feat)
2. **Task 2: Add expandable agent rows to AccountsTable** - `d84d571` (feat)

## Files Created/Modified
- `apps/web/src/components/admin/pairing-request-modal.tsx` - Dialog wrapper for PairingRequestsTable
- `apps/web/src/app/admin/accounts/page.tsx` - Added Pairing Request toolbar button with modal state
- `apps/web/src/components/admin/accounts-table.tsx` - Added expandable agent rows with toggle state

## Decisions Made
- **Modal vs separate page:** Used modal to keep Pairing Requests accessible without navigation disruption
- **Client-side grouping:** Agents fetched once and filtered by account_id for performance
- **Conditional chevron:** Only show expand icon when account has agents to avoid UI clutter
- **Event handling:** Edit button uses stopPropagation to prevent row click from toggling expand

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pairing Request workflow fully accessible from Accounts page
- Agent visibility integrated into account management
- Ready for Phase 27-05 (Automation/Extension Hub page refactoring)

---
*Phase: 27-sidebar-folder-reorganization*
*Completed: 2026-01-27*
