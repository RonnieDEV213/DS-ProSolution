# Milestone v1: Extension Auth & RBAC

**Status:** SHIPPED 2026-01-20
**Phases:** 1-5 (plus 2.1, 4.1)
**Total Plans:** 12

## Overview

This milestone extended DS-ProSolution's extension pairing system with access code authentication (second factor) and RBAC-driven tab visibility. VAs authenticate into the extension using a personal access code, then see only the tabs their assigned roles permit. Admins bypass RBAC entirely. The journey started with backend infrastructure for secure access code storage, proceeded through web UI for code management, then extension authentication, RBAC rendering, and finally presence tracking.

## Phases

### Phase 1: Access Code Foundation

**Goal:** Backend securely generates, stores, and validates access codes using Argon2 hashing
**Depends on:** Nothing (first phase)
**Requirements:** ACC-01
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md - Database schema, dependencies, Pydantic models
- [x] 01-02-PLAN.md - Service layer and API endpoints

**Details:**
- Created access_codes, access_code_attempts, access_code_lockouts tables
- Implemented Argon2id hashing via argon2-cffi
- Built 4 API endpoints: generate, rotate, info, validate
- Added progressive rate limiting (5min → 15min → 1hr lockout)

### Phase 2: Profile Settings & Account Permissions

**Goal:** Users can view and manage their access codes in a Profile Settings modal; account:view permission restricts account list access
**Depends on:** Phase 1
**Requirements:** ACC-02, ACC-03, ACC-04, ACC-05, ACC-06, PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, ACCT-01, ACCT-02, ACCT-03
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md - Profile Settings modal with access code UI
- [x] 02-02-PLAN.md - accounts.view permission and restricted account table

**Details:**
- ProfileSettingsDialog with vertical tabs (Profile, Extension)
- AccessCodeDisplay: masked, hold-to-reveal, copy, rotate, custom secret
- accounts.view permission for VA dashboard access
- AccountsTable with role-aware column visibility

### Phase 2.1: Profile UI Refinements (INSERTED)

**Goal:** Clean up sidebar profile trigger and reorganize modal tabs for better UX
**Depends on:** Phase 2
**Requirements:** None (UI polish)
**Plans:** 1 plan

Plans:
- [x] 02.1-01-PLAN.md - Reorganize modal tabs, sign out button, simplify sidebars

**Details:**
- Created SecurityTab with AccessCodeDisplay
- Moved Sign Out into profile modal (red styling)
- Simplified sidebars to "Profile Settings" button with cog icon

### Phase 3: Extension Auth Flow

**Goal:** Extension requires and validates access code entry after pairing approval, storing user JWT on success
**Depends on:** Phase 1
**Requirements:** EXT-01, EXT-02, EXT-03, EXT-04
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md - Service worker auth state, clock-in/out handlers, inactivity timeout
- [x] 03-02-PLAN.md - Side panel clock-in UI, validation overlay, error messages

**Details:**
- Auth state machine: null → needs_clock_in → clocked_in → clocked_out
- Clock-in validates access code, stores JWT + user context + RBAC
- 1-hour inactivity timeout with 5-minute warning via chrome.alarms
- Session recovery on browser restart

### Phase 4: Extension RBAC

**Goal:** Extension renders tabs based on user permissions; Admins see all tabs; users can log out
**Depends on:** Phase 3
**Requirements:** EXT-05, EXT-06, EXT-07, EXT-08, EXT-09
**Plans:** 1 plan

Plans:
- [x] 04-01-PLAN.md - Profile section, RBAC tab bar, admin bypass, permission re-check

**Details:**
- ADMIN_TABS constant defines all extension tabs for admin bypass
- Dynamic tab rendering from roles array
- Empty state for VAs with no assigned roles
- 5-minute permission re-check alarm

### Phase 4.1: Auto Order Tab Organization (INSERTED)

**Goal:** Reorganize extension hub content under a new auto_order permission; establish persistent vs tab-specific UI sections
**Depends on:** Phase 4
**Requirements:** None (organization/refactor)
**Plans:** 2 plans

Plans:
- [x] 04.1-01-PLAN.md - Add auto_order.read permission to backend and frontend
- [x] 04.1-02-PLAN.md - Reorganize extension layout, add Auto Order tab

**Details:**
- auto_order.read permission for controlling Auto Order tab visibility
- Hub content (stats, task, queue, actions, hotkeys) wrapped in Auto Order container
- Profile and agent info sections persist across all tabs

### Phase 5: Presence System

**Goal:** Account occupancy is visible with privacy-aware display (Admins see who, VAs see "Occupied")
**Depends on:** Phase 1, Phase 3
**Requirements:** PRES-01, PRES-02, PRES-03, PRES-04
**Plans:** 2 plans

Plans:
- [x] 05-01-PLAN.md - Backend presence schema, service, clock-in/out integration
- [x] 05-02-PLAN.md - Frontend usePresence hook, OccupancyBadge, AccountsTable integration

**Details:**
- account_presence table with Supabase Realtime enabled
- Upsert with (user_id, org_id) constraint for atomic presence swap
- OccupancyBadge: admin sees "Name · Time · Duration", VA sees "Occupied"
- VA Accounts page at /va/accounts

---

## Milestone Summary

**Decimal Phases:**
- Phase 2.1: Profile UI Refinements (inserted after Phase 2 for UX cleanup)
- Phase 4.1: Auto Order Tab Organization (inserted after Phase 4 for layout reorganization)

**Key Decisions:**
- Access code = 4-char prefix + 12-char secret (Rationale: O(1) lookup + secure rotation)
- Service layer pattern for API (Rationale: Clean separation of concerns)
- 1-hour inactivity timeout (Rationale: Balance security and UX)
- Upsert for presence (Rationale: Atomic presence swap)

**Issues Resolved:**
- Extension auth flow required auth_state machine for clean transitions
- Presence privacy required application-layer filtering (not RLS)
- VA accounts page needed for accounts.view permission feature

**Issues Deferred:**
- None

**Technical Debt Incurred:**
- extension-tab.tsx has TODO for Chrome Web Store URL (expected placeholder)
- service-worker.js has hardcoded localhost API_BASE (expected for dev)

---

*For current project status, see .planning/PROJECT.md*
*Archived: 2026-01-20*
