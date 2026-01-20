# Requirements Archive: v1 Extension Auth & RBAC

**Archived:** 2026-01-20
**Status:** SHIPPED

This is the archived requirements specification for v1.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

# Requirements: DS-ProSolution

**Defined:** 2026-01-18
**Core Value:** VAs can securely authenticate into the extension and see only the features their assigned roles permit

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Access Codes

- [x] **ACC-01**: User can generate access code with immutable prefix + rotatable secret
- [x] **ACC-02**: Access code displays masked by default (dots/asterisks)
- [x] **ACC-03**: User can reveal access code secret via toggle
- [x] **ACC-04**: User can copy access code to clipboard with visual feedback
- [x] **ACC-05**: User can rotate/regenerate secret (prefix remains unchanged)
- [x] **ACC-06**: User can set custom secret with basic validation (min length, alphanumeric)

### Profile Settings

- [x] **PROF-01**: Profile Settings modal uses existing sidebar-tabs pattern
- [x] **PROF-02**: Profile tab displays user info (name, email, role)
- [x] **PROF-03**: Extension tab shows install/download for all user types
- [x] **PROF-04**: Extension tab shows access code UI for Admin/VA only (Clients excluded)
- [x] **PROF-05**: Modal replaces bottom-left user info + sign-out trigger

### Extension Authentication

- [x] **EXT-01**: Extension requires access code entry after pairing approval
- [x] **EXT-02**: Extension validates access code against backend
- [x] **EXT-03**: Extension shows clear error messages (invalid code, rate limited)
- [x] **EXT-04**: Extension stores user JWT on successful auth
- [x] **EXT-05**: Extension loads RBAC permissions on auth success
- [x] **EXT-06**: Extension renders tabs based on assigned roles (one tab per role)
- [x] **EXT-07**: Admin sees all extension tabs (bypasses RBAC)
- [x] **EXT-08**: User can log out of extension (clears access code auth)
- [x] **EXT-09**: Extension auto-logs out after 1 hour of inactivity

### Account Permissions

- [x] **ACCT-01**: `account:view` permission grants view-only access to account list
- [x] **ACCT-02**: VA-assignment column hidden for users with only `account:view`
- [x] **ACCT-03**: Users with only `account:view` cannot create or edit accounts

### Presence

- [x] **PRES-01**: Account shows occupancy indicator (occupied/available)
- [x] **PRES-02**: Admin sees who is occupying the account
- [x] **PRES-03**: VA sees only "Occupied" indicator (not identity)
- [x] **PRES-04**: Presence updates in real-time (Supabase Realtime)

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Profile Enhancements

- **PROF-V2-01**: User can edit profile (display name)
- **PROF-V2-02**: User can change password

### Access Code Enhancements

- **ACC-V2-01**: Download access code as JSON (non-recoverable backup)
- **ACC-V2-02**: Customizable prefix (user-chosen)
- **ACC-V2-03**: Named/multiple access codes per user
- **ACC-V2-04**: Expiration dates on access codes

### Extension Enhancements

- **EXT-V2-01**: Remember device (skip access code re-entry on trusted device)
- **EXT-V2-02**: Session indicator in extension header
- **EXT-V2-03**: Admin-only extension tools

### Presence Enhancements

- **PRES-V2-01**: Activity timestamps (last active time)
- **PRES-V2-02**: Occupancy history/audit log

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full automation (removing VA clicks) | Future milestone, not this one |
| Mobile app / responsive redesign | Desktop-first for VA workflow |
| New user types or auth methods | Existing Admin/VA/Client model sufficient |
| OAuth / social login for extension | Access codes are the auth mechanism |
| Extension features beyond RBAC tabs | Extension internals unchanged except auth flow |
| Refactoring unrelated code | Keep changes focused on 4 features |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACC-01 | Phase 1 | Complete |
| ACC-02 | Phase 2 | Complete |
| ACC-03 | Phase 2 | Complete |
| ACC-04 | Phase 2 | Complete |
| ACC-05 | Phase 2 | Complete |
| ACC-06 | Phase 2 | Complete |
| PROF-01 | Phase 2 | Complete |
| PROF-02 | Phase 2 | Complete |
| PROF-03 | Phase 2 | Complete |
| PROF-04 | Phase 2 | Complete |
| PROF-05 | Phase 2 | Complete |
| EXT-01 | Phase 3 | Complete |
| EXT-02 | Phase 3 | Complete |
| EXT-03 | Phase 3 | Complete |
| EXT-04 | Phase 3 | Complete |
| EXT-05 | Phase 4 | Complete |
| EXT-06 | Phase 4 | Complete |
| EXT-07 | Phase 4 | Complete |
| EXT-08 | Phase 4 | Complete |
| EXT-09 | Phase 4 | Complete |
| ACCT-01 | Phase 2 | Complete |
| ACCT-02 | Phase 2 | Complete |
| ACCT-03 | Phase 2 | Complete |
| PRES-01 | Phase 5 | Complete |
| PRES-02 | Phase 5 | Complete |
| PRES-03 | Phase 5 | Complete |
| PRES-04 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0
- **All requirements shipped: 27/27**

---

## Milestone Summary

**Shipped:** 27 of 27 v1 requirements
**Adjusted:** None — all requirements implemented as specified
**Dropped:** None

---
*Archived: 2026-01-20 as part of v1 milestone completion*
