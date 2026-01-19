# Phase 4: Extension RBAC - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Extension renders tabs based on user permissions; Admins bypass RBAC and see all tabs. Users can log out of the extension (clears auth state, returns to code entry). This phase does NOT include web admin UI for role management or the presence system.

</domain>

<decisions>
## Implementation Decisions

### Tab visibility logic
- One tab per role — role name = tab name
- If VA has zero roles assigned, show empty state message: "No features assigned. Contact your admin."
- Admins see all tabs and have a subtle indicator (badge or text) showing they're in admin view
- If VA's roles change mid-session, force re-authentication (detect change, require re-entering access code)

### Permission loading
- Claude's discretion on source (JWT claims vs API call) — must be consistent with existing roles/permissions system
- Always fetch permissions fresh on each launch (no caching) — ensures up-to-date roles
- If permission fetch fails (network error), force logout and return to clock-in screen
- Periodic permission re-check during session — if roles changed, force re-auth

### Logout experience
- Existing clock-out button from Phase 3 to be repositioned
- New profile/identity section in header showing user type and name, with clock-out button adjacent
- No confirmation prompt on logout — immediate action
- Clear auth state only (JWT and auth state) — keep pairing intact
- After logout, show brief "Logged out successfully" confirmation, then return to clock-in screen

### Tab rendering
- Tabs ordered by role assignment order (when roles were assigned to the user)
- Tabs have icons alongside role name — icon comes from role definition
- Skeleton tabs shown while permissions are loading
- Prominent visual highlight on active tab (bold color, clear distinction)

### Claude's Discretion
- Permission source implementation (JWT claims vs separate API call)
- Periodic re-check interval timing
- Exact styling of admin indicator badge
- Skeleton tab animation/design
- Profile section layout details

</decisions>

<specifics>
## Specific Ideas

- Profile/identity section in the extension header should show user type and name with clock-out button right next to it
- Active tab should have a very clear visual distinction — not subtle

</specifics>

<deferred>
## Deferred Ideas

- Icon selection and name length limits for role/profile creation in web admin — affects Phase 4 but implementation belongs in web admin UI, not extension
- Presence system showing account occupancy — Phase 5

</deferred>

---

*Phase: 04-extension-rbac*
*Context gathered: 2026-01-19*
