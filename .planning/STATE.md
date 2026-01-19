# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** VAs can securely authenticate into the extension and see only the features their assigned roles permit
**Current focus:** Phase 3 - Extension Auth Flow

## Current Position

Phase: 3 of 5 (Extension Auth Flow)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-01-18 — Phase 2.1 complete (verified)

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 5 min
- Total execution time: 25 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-access-code-foundation | 2 | 11 min | 5.5 min |
| 02-profile-settings-account-permissions | 2 | 10 min | 5 min |
| 02.1-profile-ui-refinements | 1 | 4 min | 4 min |

**Recent Trend:**
- Last 5 plans: 01-02 (3 min), 02-01 (6 min), 02-02 (4 min), 02.1-01 (4 min)
- Trend: Improving

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Access code = prefix + secret (prefix for lookup, secret hashed with Argon2)
- [Init]: One extension tab per role (role name = tab name)
- [Init]: Presence shows "Occupied" for VAs (privacy-first)
- [01-01]: 4-char prefix globally unique for O(1) lookup
- [01-01]: Progressive lockout: 5min -> 15min -> 1hr for brute force protection
- [01-01]: Service role RLS for now; user-facing policies deferred
- [01-02]: Service layer pattern: business logic in services/, routes in routers/
- [01-02]: JWT includes 'type' claim to distinguish from Supabase tokens
- [01-02]: 15-minute access token expiry for extension sessions
- [02-01]: Hold-to-reveal only works for newly generated codes
- [02-01]: Copy button copies full code if newly generated, only prefix otherwise
- [02-01]: Access code section hidden for client users
- [02-02]: accounts.view permission grants minimal account list access
- [02-02]: VA endpoint filters to assigned accounts only via account_assignments
- [02.1-01]: Security tab only visible to admin/va roles (clients don't have access codes)
- [02.1-01]: Sign Out button styled red for visual distinction
- [02.1-01]: Sidebar user info removed for cleaner UX - profile details in modal only

### Pending Todos

- Run migration 035_access_codes.sql in Supabase SQL editor
- Add ACCESS_CODE_JWT_SECRET environment variable

### Blockers/Concerns

None yet.

### Roadmap Evolution

- Phase 2.1 inserted after Phase 2: Profile UI Refinements (URGENT) — COMPLETE

## Session Continuity

Last session: 2026-01-18
Stopped at: Phase 2.1 complete, ready to plan Phase 3
Resume file: None
