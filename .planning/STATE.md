# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** VAs can securely authenticate into the extension and see only the features their assigned roles permit
**Current focus:** Milestone complete - all phases executed

## Current Position

Phase: 5 of 5 (Presence System) - COMPLETE
Plan: 2 of 2 in current phase - COMPLETE
Status: Milestone complete
Last activity: 2026-01-20 — Phase 5 verified complete

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 5 min
- Total execution time: ~65 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-access-code-foundation | 2 | 11 min | 5.5 min |
| 02-profile-settings-account-permissions | 2 | 10 min | 5 min |
| 02.1-profile-ui-refinements | 1 | 4 min | 4 min |
| 03-extension-auth-flow | 2 | 11 min | 5.5 min |
| 04-extension-rbac | 1 | 12 min | 12 min |
| 04.1-auto-order-tab-organization | 2 | 5 min | 2.5 min |
| 05-presence-system | 2 | ~15 min | 7.5 min |

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
- [04.1-01]: auto_order.read follows existing permission naming convention (category.action)
- [04.1-01]: Auto Order Tab appears first in Ordering Permissions group
- [04.1-02]: Auto Order tab appears first in ADMIN_TABS (priority order)
- [04.1-02]: Profile and agent info sections persist across all tabs
- [04.1-02]: Tab content placeholder hidden by default, shown for non-Auto-Order tabs
- [05-01]: Upsert with (user_id, org_id) constraint for atomic presence swap
- [05-01]: Access code JWT auth dependency for extension endpoints
- [05-01]: RLS allows authenticated users to SELECT presence for their org
- [05-02]: Presence displays on Accounts page (not AccountSelector dropdown)
- [05-02]: Live duration timer updates every minute for admin view
- [05-02]: Extension sends account_id on clock-in for presence recording

### Pending Todos

- Run migration 036_presence_system.sql in Supabase SQL editor (if not already done)

### Blockers/Concerns

None.

### Roadmap Evolution

- Phase 2.1 inserted after Phase 2: Profile UI Refinements (URGENT) — COMPLETE
- Phase 4.1 inserted after Phase 4: Auto Order Tab Organization (URGENT) — COMPLETE

## Session Continuity

Last session: 2026-01-20
Stopped at: Milestone complete
Resume file: None
