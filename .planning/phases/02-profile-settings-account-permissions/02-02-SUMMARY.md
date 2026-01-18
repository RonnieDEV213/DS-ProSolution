---
phase: 02-profile-settings-account-permissions
plan: 02
subsystem: api, ui
tags: [rbac, permissions, accounts, react, fastapi]

# Dependency graph
requires:
  - phase: 01-access-code-foundation
    provides: RBAC permission system infrastructure
provides:
  - accounts.view permission key in RBAC system
  - VA-filtered /accounts endpoint
  - Permission-aware AccountsTable component
affects: [03-extension-core, va-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Permission-gated endpoints: check permission_keys before returning data"
    - "Role-aware components: use useUserRole hook to determine display mode"

key-files:
  created: []
  modified:
    - apps/api/src/app/permissions.py
    - apps/api/src/app/routers/accounts.py
    - apps/web/src/components/admin/accounts-table.tsx
    - apps/web/src/components/admin/department-role-dialog.tsx

key-decisions:
  - "accounts.view permission required for VAs to access /accounts endpoint"
  - "Admin and VA use same component with role-based rendering"
  - "VAs see 2 columns (Account Code, Name); Admins see 5 columns"

patterns-established:
  - "Permission check in endpoint: check permission_keys list for required permission"
  - "Role-aware table: useUserRole hook + isViewOnly pattern"

# Metrics
duration: 4min
completed: 2026-01-18
---

# Phase 2 Plan 2: Account View Permission Summary

**accounts.view RBAC permission with VA-filtered /accounts endpoint and role-aware AccountsTable component**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-18T23:36:09Z
- **Completed:** 2026-01-18T23:40:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Added accounts.view permission key to RBAC system (DEPT_ROLE_PERMISSION_KEYS and PERMISSION_LABELS)
- Created /accounts endpoint that returns only assigned accounts for VAs
- Modified AccountsTable to render in two modes: full admin view and restricted VA view

## Task Commits

Each task was committed atomically:

1. **Task 1: Add accounts.view permission to RBAC system** - `40ae22d` (feat)
2. **Task 2: Create VA-specific accounts endpoint** - `6162751` (feat)
3. **Task 3: Implement permission-aware accounts table** - `c397c30` (feat)

## Files Created/Modified
- `apps/api/src/app/permissions.py` - Added accounts.view to DEPT_ROLE_PERMISSION_KEYS and PERMISSION_LABELS
- `apps/api/src/app/routers/accounts.py` - Enhanced to filter by account_assignments for VAs, require accounts.view permission
- `apps/web/src/components/admin/accounts-table.tsx` - Added viewOnly prop, useUserRole integration, conditional column rendering
- `apps/web/src/components/admin/department-role-dialog.tsx` - Added accounts.view to AVAILABLE_PERMISSIONS under "Account Permissions" group

## Decisions Made
- **accounts.view permission check:** VAs must have accounts.view permission in their department role to access /accounts endpoint (403 if missing)
- **Service role for VA queries:** Use service role client to query account_assignments instead of RLS - simpler join and avoids RLS policy complexity
- **Shared component pattern:** AccountsTable serves both admin and VA use cases with conditional rendering rather than separate components

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- accounts.view permission ready for assignment via department roles
- AccountsTable can be reused in VA dashboard with viewOnly prop
- /accounts endpoint provides minimal data for VA account display

---
*Phase: 02-profile-settings-account-permissions*
*Completed: 2026-01-18*
