# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** VAs can securely authenticate into the extension and see only the features their assigned roles permit
**Current focus:** Phase 2 - Profile Settings & Account Permissions

## Current Position

Phase: 2 of 5 (Profile Settings & Account Permissions)
Plan: 2 of TBD in current phase
Status: In progress
Last activity: 2026-01-18 - Completed 02-02-PLAN.md (Account View Permission)

Progress: [███░░░░░░░] 30%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 5 min
- Total execution time: 15 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-access-code-foundation | 2 | 11 min | 5.5 min |
| 02-profile-settings-account-permissions | 1 | 4 min | 4 min |

**Recent Trend:**
- Last 5 plans: 01-01 (8 min), 01-02 (3 min), 02-02 (4 min)
- Trend: Stable

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
- [02-02]: accounts.view permission required for VAs to access /accounts endpoint
- [02-02]: Admin and VA use same AccountsTable component with role-based rendering
- [02-02]: VAs see 2 columns (Account Code, Name); Admins see 5 columns

### Pending Todos

- Run migration 035_access_codes.sql in Supabase SQL editor
- Add ACCESS_CODE_JWT_SECRET environment variable

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-18T23:40:00Z
Stopped at: Completed 02-02-PLAN.md
Resume file: None
