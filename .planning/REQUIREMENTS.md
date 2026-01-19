# Requirements: DS-ProSolution

**Defined:** 2026-01-18
**Core Value:** VAs can securely authenticate into the extension and see only the features their assigned roles permit

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Access Codes

- [ ] **ACC-01**: User can generate access code with immutable prefix + rotatable secret
- [ ] **ACC-02**: Access code displays masked by default (dots/asterisks)
- [ ] **ACC-03**: User can reveal access code secret via toggle
- [ ] **ACC-04**: User can copy access code to clipboard with visual feedback
- [ ] **ACC-05**: User can rotate/regenerate secret (prefix remains unchanged)
- [ ] **ACC-06**: User can set custom secret with basic validation (min length, alphanumeric)

### Profile Settings

- [ ] **PROF-01**: Profile Settings modal uses existing sidebar-tabs pattern
- [ ] **PROF-02**: Profile tab displays user info (name, email, role)
- [ ] **PROF-03**: Extension tab shows install/download for all user types
- [ ] **PROF-04**: Extension tab shows access code UI for Admin/VA only (Clients excluded)
- [ ] **PROF-05**: Modal replaces bottom-left user info + sign-out trigger

### Extension Authentication

- [ ] **EXT-01**: Extension requires access code entry after pairing approval
- [ ] **EXT-02**: Extension validates access code against backend
- [ ] **EXT-03**: Extension shows clear error messages (invalid code, rate limited)
- [ ] **EXT-04**: Extension stores user JWT on successful auth
- [ ] **EXT-05**: Extension loads RBAC permissions on auth success
- [ ] **EXT-06**: Extension renders tabs based on assigned roles (one tab per role)
- [ ] **EXT-07**: Admin sees all extension tabs (bypasses RBAC)
- [ ] **EXT-08**: User can log out of extension (clears access code auth)
- [ ] **EXT-09**: Extension auto-logs out after 1 hour of inactivity

### Account Permissions

- [ ] **ACCT-01**: `account:view` permission grants view-only access to account list
- [ ] **ACCT-02**: VA-assignment column hidden for users with only `account:view`
- [ ] **ACCT-03**: Users with only `account:view` cannot create or edit accounts

### Presence

- [ ] **PRES-01**: Account shows occupancy indicator (occupied/available)
- [ ] **PRES-02**: Admin sees who is occupying the account
- [ ] **PRES-03**: VA sees only "Occupied" indicator (not identity)
- [ ] **PRES-04**: Presence updates in real-time (Supabase Realtime)

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

Which phases cover which requirements. Updated during roadmap creation.

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
| EXT-05 | Phase 4 | Pending |
| EXT-06 | Phase 4 | Pending |
| EXT-07 | Phase 4 | Pending |
| EXT-08 | Phase 4 | Pending |
| EXT-09 | Phase 4 | Pending |
| ACCT-01 | Phase 2 | Complete |
| ACCT-02 | Phase 2 | Complete |
| ACCT-03 | Phase 2 | Complete |
| PRES-01 | Phase 5 | Pending |
| PRES-02 | Phase 5 | Pending |
| PRES-03 | Phase 5 | Pending |
| PRES-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-01-19 — Phase 3 complete*
