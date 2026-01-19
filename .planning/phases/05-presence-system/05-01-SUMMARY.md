---
phase: 05-presence-system
plan: 01
subsystem: api
tags: [presence, realtime, supabase, fastapi, rls]

# Dependency graph
requires:
  - phase: 01-access-code-foundation
    provides: access code validation flow
  - phase: 03-extension-auth-flow
    provides: clock-in/out session management
provides:
  - account_presence database table with Realtime enabled
  - Presence service (record/clear functions)
  - Presence integration with clock-in flow
  - Admin force-clear endpoint
  - Extension logout endpoint
affects: [05-02-frontend-presence-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Upsert for atomic presence replacement (one account per VA)"
    - "Access code JWT auth dependency for extension endpoints"

key-files:
  created:
    - apps/api/migrations/036_presence_system.sql
    - apps/api/src/app/services/presence.py
    - apps/api/src/app/routers/presence.py
  modified:
    - apps/api/src/app/models.py
    - apps/api/src/app/routers/access_codes.py
    - apps/api/src/app/routers/__init__.py
    - apps/api/src/app/main.py
    - apps/api/src/app/services/__init__.py

key-decisions:
  - "Upsert with (user_id, org_id) constraint for atomic presence swap"
  - "Access code JWT auth dependency for extension endpoints"
  - "RLS allows authenticated users to SELECT presence for their org"

patterns-established:
  - "get_access_code_user: auth dependency for extension JWT tokens"
  - "Presence service: async functions with explicit supabase parameter"

# Metrics
duration: 4min
completed: 2026-01-19
---

# Phase 5 Plan 1: Presence Backend Infrastructure Summary

**Presence tracking backend with account_presence table, service layer, and clock-in/out integration via Supabase Realtime**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-19T19:11:37Z
- **Completed:** 2026-01-19T19:15:41Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Created account_presence table with unique constraints (one VA per account, one account per VA per org)
- Enabled Supabase Realtime for real-time presence updates
- Integrated presence recording into access code validation (clock-in)
- Added logout endpoint for extension to clear presence on clock-out
- Created admin force-clear endpoint for orphaned presence entries

## Task Commits

Each task was committed atomically:

1. **Task 1: Create presence database schema** - `3ab930b` (feat)
2. **Task 2: Create presence service module** - `6f9b3ed` (feat)
3. **Task 3: Integrate presence into clock-in/out and add admin endpoint** - `6328fe7` (feat)

## Files Created/Modified
- `apps/api/migrations/036_presence_system.sql` - Presence table with RLS and Realtime
- `apps/api/src/app/services/presence.py` - record_presence, clear_presence, clear_presence_by_account functions
- `apps/api/src/app/services/__init__.py` - Export presence functions
- `apps/api/src/app/routers/presence.py` - Admin DELETE /presence/{account_id} endpoint
- `apps/api/src/app/routers/access_codes.py` - Added logout endpoint and presence recording on validate
- `apps/api/src/app/routers/__init__.py` - Export presence_router
- `apps/api/src/app/main.py` - Register presence router
- `apps/api/src/app/models.py` - Added account_id field to AccessCodeValidateRequest

## Decisions Made
- **Upsert for atomic presence swap:** Using `on_conflict="user_id,org_id"` ensures a VA can only be on one account at a time; clocking into a new account automatically clears the old presence
- **Separate auth dependency for extension tokens:** Created `get_access_code_user` to validate access code JWTs (type="access_code") separately from Supabase auth
- **RLS allows org-wide SELECT:** Both admins and VAs can see presence for their org; privacy filtering (admin sees name, VA sees "Occupied") happens in application layer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

**Migration required:** Run `apps/api/migrations/036_presence_system.sql` in Supabase SQL editor.

## Next Phase Readiness
- Backend presence infrastructure complete
- Ready for Plan 02: Frontend presence display with Realtime subscriptions
- Extension will need to pass `account_id` on validate and call `/access-codes/logout` on clock-out

---
*Phase: 05-presence-system*
*Completed: 2026-01-19*
