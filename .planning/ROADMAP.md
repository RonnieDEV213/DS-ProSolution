# Roadmap: DS-ProSolution Extension Auth & RBAC

## Overview

This milestone extends DS-ProSolution's extension pairing system with access code authentication (second factor) and RBAC-driven tab visibility. VAs will authenticate into the extension using a personal access code, then see only the tabs their assigned roles permit. Admins bypass RBAC entirely. The journey starts with backend infrastructure for secure access code storage, proceeds through web UI for code management, then extension authentication, RBAC rendering, and finally presence tracking.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Access Code Foundation** - Backend infrastructure for secure access code generation, hashing, and validation
- [x] **Phase 2: Profile Settings & Account Permissions** - Web UI for profile modal, access code management, and account:view permission
- [x] **Phase 2.1: Profile UI Refinements** - Sidebar trigger cleanup, Security tab with access code (INSERTED)
- [x] **Phase 3: Extension Auth Flow** - Extension authentication using access codes with JWT storage
- [x] **Phase 4: Extension RBAC** - Permission-based tab rendering with admin bypass
- [x] **Phase 4.1: Auto Order Tab Organization** - Move hub content under auto_order permission, reorganize layout (INSERTED)
- [ ] **Phase 5: Presence System** - Account occupancy indicators with privacy-aware display

## Phase Details

### Phase 1: Access Code Foundation
**Goal**: Backend securely generates, stores, and validates access codes using Argon2 hashing
**Depends on**: Nothing (first phase)
**Requirements**: ACC-01
**Success Criteria** (what must be TRUE):
  1. API endpoint generates access code with immutable prefix and random secret
  2. Access code secret is hashed with Argon2 before database storage (never stored plaintext)
  3. API endpoint validates access code and returns user context on success
  4. Rate limiting prevents brute force attacks on validation endpoint
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md - Database schema, dependencies, Pydantic models
- [x] 01-02-PLAN.md - Service layer and API endpoints

### Phase 2: Profile Settings & Account Permissions
**Goal**: Users can view and manage their access codes in a Profile Settings modal; account:view permission restricts account list access
**Depends on**: Phase 1
**Requirements**: ACC-02, ACC-03, ACC-04, ACC-05, ACC-06, PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, ACCT-01, ACCT-02, ACCT-03
**Success Criteria** (what must be TRUE):
  1. Profile Settings modal opens from sidebar (replacing bottom-left user info trigger)
  2. Profile tab shows user name, email, and role
  3. Extension tab shows download/install for all user types
  4. Extension tab shows access code UI (masked, reveal, copy, rotate, custom) for Admin/VA only
  5. Users with only account:view permission see account list but cannot edit or see VA assignments
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md - Profile Settings modal with access code UI
- [x] 02-02-PLAN.md - accounts.view permission and restricted account table

### Phase 2.1: Profile UI Refinements (INSERTED)
**Goal**: Clean up sidebar profile trigger and reorganize modal tabs for better UX
**Depends on**: Phase 2
**Requirements**: None (UI polish)
**Success Criteria** (what must be TRUE):
  1. Profile modal close button replaced with Sign Out button
  2. Sidebar bottom-left shows "Profile Settings" text with icon (no name/email/sign out)
  3. Profile modal has Security tab containing access code UI
  4. Extension tab no longer contains access code section
**Plans**: 1 plan

Plans:
- [x] 02.1-01-PLAN.md — Reorganize modal tabs, sign out button, simplify sidebars

### Phase 3: Extension Auth Flow
**Goal**: Extension requires and validates access code entry after pairing approval, storing user JWT on success
**Depends on**: Phase 1
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04
**Success Criteria** (what must be TRUE):
  1. Extension prompts for access code after pairing is approved (before showing main UI)
  2. Extension validates code against backend and shows clear error messages on failure
  3. Extension stores user JWT in chrome.storage.local on successful validation
  4. Extension retrieves stored JWT on subsequent launches (no re-entry required until logout/rotation)
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Service worker auth state, clock-in/out handlers, inactivity timeout
- [x] 03-02-PLAN.md — Side panel clock-in UI, validation overlay, error messages

### Phase 4: Extension RBAC
**Goal**: Extension renders tabs based on user permissions; Admins see all tabs; users can log out
**Depends on**: Phase 3
**Requirements**: EXT-05, EXT-06, EXT-07, EXT-08, EXT-09
**Success Criteria** (what must be TRUE):
  1. Extension loads RBAC permissions from JWT/user context on auth success
  2. Extension renders only tabs matching user's assigned roles (one tab per role)
  3. Admin users see all extension tabs (bypass RBAC check)
  4. User can log out of extension (clears auth state, returns to code entry)
  5. Extension auto-logs out after 1 hour of inactivity
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md — Profile section, RBAC tab bar, admin bypass, permission re-check

### Phase 4.1: Auto Order Tab Organization (INSERTED)
**Goal**: Reorganize extension hub content under a new auto_order permission; establish persistent vs tab-specific UI sections
**Depends on**: Phase 4
**Requirements**: None (organization/refactor)
**Success Criteria** (what must be TRUE):
  1. New permission auto_order.read exists in Ordering Permissions category
  2. Extension hub content (stats, current task, attention, queue, quick actions, hotkeys) displays only in Auto Order tab
  3. Profile section moved below tabs showing user name, type badge, Clock Out
  4. Agent/account info section (label, account, role) appears below profile section
  5. Tab content area displays below both profile and agent sections
  6. Hotkeys display only in Auto Order tab (auto-order specific actions)
  7. VA with auto_order.read permission assigned to their role sees Auto Order tab
**Plans**: 2 plans

Plans:
- [x] 04.1-01-PLAN.md — Add auto_order.read permission to backend and frontend
- [x] 04.1-02-PLAN.md — Reorganize extension layout, add Auto Order tab

### Phase 5: Presence System
**Goal**: Account occupancy is visible with privacy-aware display (Admins see who, VAs see "Occupied")
**Depends on**: Phase 1, Phase 3
**Requirements**: PRES-01, PRES-02, PRES-03, PRES-04
**Success Criteria** (what must be TRUE):
  1. Account list shows occupancy indicator (occupied/available) for each account
  2. Admin users see the name of who is occupying each account
  3. VA users see only "Occupied" indicator (no identity revealed)
  4. Presence updates in near real-time (within a few seconds of changes)
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — Backend presence schema, service, clock-in/out integration
- [ ] 05-02-PLAN.md — Frontend usePresence hook, OccupancyBadge, AccountSelector integration

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 2.1 -> 3 -> 4 -> 4.1 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Access Code Foundation | 2/2 | Complete | 2026-01-18 |
| 2. Profile Settings & Account Permissions | 2/2 | Complete | 2026-01-18 |
| 2.1. Profile UI Refinements (INSERTED) | 1/1 | Complete | 2026-01-18 |
| 3. Extension Auth Flow | 2/2 | Complete | 2026-01-19 |
| 4. Extension RBAC | 1/1 | Complete | 2026-01-19 |
| 4.1. Auto Order Tab Organization (INSERTED) | 2/2 | Complete | 2026-01-19 |
| 5. Presence System | 0/2 | Ready for execution | - |

---
*Roadmap created: 2026-01-18*
*Last updated: 2026-01-19 — Phase 5 planned*
