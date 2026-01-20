---
phase: 03-extension-auth-flow
plan: 01
subsystem: auth
tags: [chrome-extension, jwt, access-code, inactivity-timeout, service-worker]

# Dependency graph
requires:
  - phase: 01-access-code-foundation
    provides: Backend access code validation endpoint (POST /access-codes/validate)
provides:
  - Service worker clock-in/out state management
  - Access code validation against backend
  - JWT and RBAC context storage
  - Inactivity timeout with warning alarms
  - Session recovery on browser restart
affects: [03-02, 03-03, future-extension-plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inactivity timeout via chrome.alarms (55min warning, 60min timeout)"
    - "Auth state machine: null -> needs_clock_in -> clocked_in -> clocked_out"

key-files:
  created: []
  modified:
    - packages/extension/service-worker.js

key-decisions:
  - "auth_state set to 'needs_clock_in' after pairing approval (not null)"
  - "30-second buffer on token expiry check for clock skew"
  - "rbac_version stored for future cache invalidation"

patterns-established:
  - "Clock-in validates full access code, stores JWT + user context + permissions"
  - "Inactivity alarms persist across SW lifecycle via chrome.alarms"
  - "Session recovery checks token expiry and elapsed inactivity on startup"

# Metrics
duration: 3min
completed: 2026-01-19
---

# Phase 3 Plan 1: Clock-In State Management Summary

**Service worker access code auth with JWT storage, inactivity timeout alarms (1hr), and session recovery on browser restart**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-19T08:55:16Z
- **Completed:** 2026-01-19T08:57:52Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Extended state schema with auth_state, access_token, user_context, roles, permissions, and activity timestamps
- Implemented validateAccessCode() to call backend endpoint with proper error handling
- Added handleClockIn() that stores JWT, user context, RBAC data and starts inactivity timer
- Created clockOut() that clears all auth state and cancels alarms
- Implemented checkSessionOnStartup() for browser restart session recovery
- Added inactivity warning (5min before) and timeout (1hr) via chrome.alarms
- Set auth_state to 'needs_clock_in' after pairing approval

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend state schema and add auth state management** - `2730596` (feat)
2. **Task 2: Add clock-in handler with validation and inactivity management** - `221ba44` (feat)

## Files Created/Modified
- `packages/extension/service-worker.js` - Clock-in/out handlers, inactivity management, session recovery

## Decisions Made
- auth_state transitions: null -> needs_clock_in (after pairing) -> clocked_in -> clocked_out
- 30-second buffer on token expiry check to handle clock skew
- Storing rbac_version for potential future permission cache invalidation
- Inactivity alarms use absolute timestamps (when:) not delays for persistence

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Service worker clock-in/out logic complete
- Ready for side panel UI implementation (03-02)
- Message handlers ready: CLOCK_IN, CLOCK_OUT, RESET_ACTIVITY
- State summary exposes auth_state, user_context, clock_out_reason, session_started_at

---
*Phase: 03-extension-auth-flow*
*Completed: 2026-01-19*
