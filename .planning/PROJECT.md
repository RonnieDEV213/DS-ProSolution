# DS-ProSolution

## What This Is

An in-house eBay automation account management platform for agency operations — tracking orders, managing bookkeeping, coordinating VAs, and providing client dashboards. Currently in "semi-automation" phase where VAs use a Chrome extension to assist with tasks while monitoring stats. The platform supports three user types (Admin, VA, Client) with role-based access control for VAs.

## Core Value

VAs can securely authenticate into the extension and see only the features their assigned roles permit — enabling controlled, auditable account operations at scale.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ User authentication via Supabase (login, session, role-based routing) — existing
- ✓ Admin dashboard with user management, account management, VA assignment — existing
- ✓ VA dashboard with order tracking and bookkeeping records — existing
- ✓ Client dashboard with metrics/summary views — existing
- ✓ Chrome extension with pairing flow (request → admin approval → install token) — existing
- ✓ Automation agents (eBay creates jobs, Amazon claims/completes jobs) — existing
- ✓ Department roles/access profiles with granular permissions for VAs — existing
- ✓ Field-level permissions on bookkeeping records — existing
- ✓ Audit logging for admin mutations — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Profile Settings modal replacing bottom-left user info + sign-out (sidebar tabs pattern)
- [ ] Access code system: immutable user prefix + rotatable secret portion
- [ ] Access code UI: masked display, reveal toggle, copy, rotate, customize with validation
- [ ] Extension tab in Profile Settings: install/download for all; access code UI for Admin/VA only
- [ ] Extension auth flow: require access code after pairing approval
- [ ] Extension RBAC: load roles/permissions on auth success, render tabs per assigned role
- [ ] Admin extension access: bypass RBAC, see all tabs
- [ ] Permission `account:view`: view-only account list, hide VA-assignment column
- [ ] Account presence/occupancy: Admin sees who, VAs see "Occupied"

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Full automation (removing VA clicks) — future milestone, not this one
- Refactoring unrelated code — keep changes focused on the 4 features
- New user types or auth methods — existing Admin/VA/Client model is sufficient
- Extension features beyond RBAC tabs — extension internals unchanged except auth flow
- Mobile app or responsive redesign — desktop-first for VA workflow

## Context

**Technical Environment:**
- Monorepo: `apps/web` (Next.js 14+), `apps/api` (FastAPI), `packages/extension` (Chrome MV3)
- Supabase for auth, database (PostgreSQL + RLS), and real-time
- RBAC already implemented for VAs via department roles/access profiles
- Extension already has pairing flow; this adds access code as second auth factor

**Existing Patterns to Follow:**
- "Sidebar tabs" modal pattern exists in codebase — reuse for Profile Settings
- Permission keys like `order_tracking.read`, `order_tracking.write.basic_fields`
- User types via `UserRole` enum in `apps/api/src/app/models.py`
- JWT tokens for both user auth (Supabase) and agent auth (self-issued)

**User Types (source of truth = codebase):**
- Admin: Superuser, bypasses RBAC, full access to web app and extension
- VA: RBAC applies, access controlled by assigned roles/permissions
- Client: Read-only dashboard, no RBAC, no extension access or access codes

## Constraints

- **Tech stack**: Next.js 14+ / FastAPI / Supabase / Chrome Extension (MV3) — no new frameworks
- **UI patterns**: Use existing shadcn/ui components and sidebar tabs modal pattern
- **Scope**: Only the 4 features described; no scope creep
- **Access codes**: Treat as secrets (hashed storage, masked display, secure rotation)
- **RBAC**: Only applies to VAs; Admins bypass, Clients excluded

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Access code = prefix + secret | Prefix provides user identification, secret provides rotatability without breaking integrations that might cache prefix | — Pending |
| One extension tab per role | Simplifies RBAC mapping; role name = tab name; VAs see tabs for their assigned roles | — Pending |
| Presence shows "Occupied" for VAs | Privacy/simplicity; VAs don't need to know who, just that account is in use | — Pending |
| Clients see extension download but no access code | Allows clients to install extension (future use?) but blocks auth today | — Pending |

---
*Last updated: 2026-01-18 after initialization*
