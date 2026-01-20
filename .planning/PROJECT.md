# DS-ProSolution

## What This Is

An in-house eBay automation account management platform for agency operations — tracking orders, managing bookkeeping, coordinating VAs, and providing client dashboards. Currently in "semi-automation" phase where VAs use a Chrome extension to assist with tasks while monitoring stats. The platform supports three user types (Admin, VA, Client) with role-based access control for VAs.

## Core Value

VAs can securely authenticate into the extension and see only the features their assigned roles permit — enabling controlled, auditable account operations at scale.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

**Pre-existing (inferred from codebase):**
- ✓ User authentication via Supabase (login, session, role-based routing)
- ✓ Admin dashboard with user management, account management, VA assignment
- ✓ VA dashboard with order tracking and bookkeeping records
- ✓ Client dashboard with metrics/summary views
- ✓ Chrome extension with pairing flow (request → admin approval → install token)
- ✓ Automation agents (eBay creates jobs, Amazon claims/completes jobs)
- ✓ Department roles/access profiles with granular permissions for VAs
- ✓ Field-level permissions on bookkeeping records
- ✓ Audit logging for admin mutations

**v1 Extension Auth & RBAC (shipped 2026-01-20):**
- ✓ Access code system: immutable 4-char prefix + rotatable 12-char secret, Argon2id hashing
- ✓ Access code UI: masked display, hold-to-reveal, copy, rotate, custom secret with validation
- ✓ Profile Settings modal with sidebar tabs pattern (Profile, Security, Extension tabs)
- ✓ Security tab with access code UI for Admin/VA only (Clients excluded)
- ✓ Extension auth flow: require access code after pairing approval, JWT storage
- ✓ Extension RBAC: load roles/permissions, render tabs per assigned role
- ✓ Admin extension bypass: see all tabs without RBAC filtering
- ✓ Permission `accounts.view`: view-only account list for VAs, VA-assignment column hidden
- ✓ Permission `auto_order.read`: controls Auto Order tab visibility in extension
- ✓ Account presence/occupancy: real-time indicators, Admin sees VA name, VAs see "Occupied"
- ✓ Extension inactivity timeout: 1-hour with 5-minute warning, session recovery on restart
- ✓ Permission re-check: periodic alarm detects role changes, forces re-auth

### Active

<!-- Current scope. Building toward these. -->

(None — define next milestone with /gsd:new-milestone)

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
| Access code = 4-char prefix + 12-char secret | Prefix enables O(1) lookup, secret hashed with Argon2id for security | ✓ Good — v1 |
| One extension tab per role | Simplifies RBAC mapping; role name = tab name; VAs see tabs for their assigned roles | ✓ Good — v1 |
| Presence shows "Occupied" for VAs | Privacy/simplicity; VAs don't need to know who, just that account is in use | ✓ Good — v1 |
| Clients see extension download but no access code | Allows clients to install extension (future use?) but blocks auth today | ✓ Good — v1 |
| 15-minute JWT expiry for extension | Balance between security (short-lived tokens) and UX (not too frequent re-auth) | ✓ Good — v1 |
| 1-hour inactivity timeout with 5-min warning | Protects account access while allowing reasonable work sessions | ✓ Good — v1 |
| Service layer pattern for API | Business logic in services/, routes in routers/ — clean separation | ✓ Good — v1 |
| Upsert for presence with user/org constraint | Atomic presence swap ensures VA can only be on one account at a time | ✓ Good — v1 |

## Current State

**Shipped:** v1 Extension Auth & RBAC (2026-01-20)
**Tech Stack:** Next.js 14+, FastAPI, Supabase, Chrome Extension MV3
**Codebase:** ~16,500 lines added in v1 milestone across 74 files

---
*Last updated: 2026-01-20 after v1 milestone*
