# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** VAs can securely authenticate into the extension and see only the features their assigned roles permit
**Current focus:** Phase 4 - Extension RBAC

## Current Position

Phase: 4 of 5 (Extension RBAC)
Plan: 1 of TBD in current phase
Status: In progress
Last activity: 2026-01-19 — Completed 04-01-PLAN.md (Tab Shell - RBAC UI)

Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 6 min
- Total execution time: 48 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-access-code-foundation | 2 | 11 min | 5.5 min |
| 02-profile-settings-account-permissions | 2 | 10 min | 5 min |
| 02.1-profile-ui-refinements | 1 | 4 min | 4 min |
| 03-extension-auth-flow | 2 | 11 min | 5.5 min |
| 04-extension-rbac | 1 | 12 min | 12 min |

**Recent Trend:**
- Last 5 plans: 02.1-01 (4 min), 03-01 (3 min), 03-02 (8 min), 04-01 (12 min)
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
- [02-01]: Hold-to-reveal only works for newly generated codes
- [02-01]: Copy button copies full code if newly generated, only prefix otherwise
- [02-01]: Access code section hidden for client users
- [02-02]: accounts.view permission grants minimal account list access
- [02-02]: VA endpoint filters to assigned accounts only via account_assignments
- [02.1-01]: Security tab only visible to admin/va roles (clients don't have access codes)
- [02.1-01]: Sign Out button styled red for visual distinction
- [02.1-01]: Sidebar user info removed for cleaner UX - profile details in modal only
- [03-01]: auth_state set to 'needs_clock_in' after pairing approval
- [03-01]: 30-second buffer on token expiry check for clock skew
- [03-01]: Inactivity timeout 1hr with 5min warning via chrome.alarms
- [03-02]: Password input with toggle visibility for access code
- [03-02]: Clear input on validation error for fresh start
- [03-02]: Activity tracking on click and keydown events
- [04-01]: ADMIN_TABS constant defines all extension tabs for admin bypass
- [04-01]: Permission re-check every 5 minutes via chrome.alarms
- [04-01]: rbac_version comparison triggers forced re-auth on role changes

### Pending Todos

- Run migration 035_access_codes.sql in Supabase SQL editor (if not already done)
- ~~Add ACCESS_CODE_JWT_SECRET environment variable~~ (done)

### Blockers/Concerns

None yet.

### Roadmap Evolution

- Phase 2.1 inserted after Phase 2: Profile UI Refinements (URGENT) — COMPLETE

## Session Continuity

Last session: 2026-01-19
Stopped at: Completed 04-01-PLAN.md (Tab Shell - RBAC UI)
Resume file: None
