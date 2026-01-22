---
phase: 12-live-activity-feed-concurrency
plan: 04
subsystem: api
tags: [fastapi, jwt, sse, eventsource, auth]

# Dependency graph
requires:
  - phase: 12-02
    provides: Parallel collection execution with activity streaming
  - phase: 12-03
    provides: SSE endpoint, seller_count_snapshot fields in models and services
provides:
  - Flexible auth dependency for SSE endpoints (header or query param)
  - SSE endpoint using require_permission_key_flexible
  - Centralized flexible auth in auth.py (reusable)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - require_permission_key_flexible factory for SSE-compatible auth
    - get_token_from_request for extracting token from header or query

key-files:
  created: []
  modified:
    - apps/api/src/app/auth.py
    - apps/api/src/app/routers/collection.py

key-decisions:
  - "Flexible auth centralized in auth.py (not in each router)"
  - "Factory pattern matches existing require_permission_key API"
  - "Deprecated verify_token_for_sse rather than deleting (per CLAUDE.md)"

patterns-established:
  - "require_permission_key_flexible: SSE-compatible auth dependency factory"
  - "get_token_from_request: Token extraction from header (Bearer) or query param"

# Metrics
duration: 2min
completed: 2026-01-22
---

# Phase 12 Plan 04: SSE Auth & Seller Snapshot API Summary

**Flexible auth dependency for SSE endpoints supporting both Authorization header and query parameter token**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-22T23:26:59Z
- **Completed:** 2026-01-22T23:28:57Z
- **Tasks:** 3 (2 executed, 1 already complete from 12-03)
- **Files modified:** 2

## Accomplishments

- Added get_token_from_request for extracting JWT from header or query param
- Added require_permission_key_flexible factory function for SSE-compatible auth
- Updated SSE activity endpoint to use flexible auth dependency
- Verified seller_count_snapshot already in history and audit-log responses (from 12-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add flexible auth support for SSE endpoints** - `749821d` (feat)
2. **Task 2: Update SSE endpoint to use flexible auth** - `b4dc2b9` (feat)
3. **Task 3: Update audit-log endpoint** - Already complete from 12-03 (no commit needed)

## Files Created/Modified

- `apps/api/src/app/auth.py` - Added get_token_from_request, require_permission_flexible, require_permission_key_flexible
- `apps/api/src/app/routers/collection.py` - Import flexible auth, update stream_activity endpoint, deprecate verify_token_for_sse

## Decisions Made

1. **Centralized flexible auth** - Put new auth functions in auth.py rather than router-specific helpers
2. **Factory pattern consistency** - require_permission_key_flexible mirrors require_permission_key API
3. **Deprecation over deletion** - Per CLAUDE.md guardrails, marked verify_token_for_sse as deprecated

## Deviations from Plan

None - plan executed as written. Task 3 was already complete from 12-03 plan execution.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 12 complete - all 4 plans executed
- SSE endpoints now have centralized flexible auth support
- Seller snapshots available in all history/audit-log responses
- Ready for production testing

---
*Phase: 12-live-activity-feed-concurrency*
*Completed: 2026-01-22*
