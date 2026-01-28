# Phase 27: Sidebar Folder Reorganization - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize the sidebar from a flat nav list into 3 collapsible section groups with role-based visibility. Consolidate Access Profiles and Invites into modals on the Users page. Move Pairing Request to a modal on the Accounts page. Move Agents into expandable rows per account. Move sync status into Profile Settings. Remove theme picker from sidebar footer. Rename Extension Hub to Automation Hub. Move Order Tracking from standalone to Monitoring section.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Section Structure
- Dashboard remains a top-level nav item above all sections
- 3 collapsible sections below Dashboard:
  1. **Admin** — Users (single page; Access Profiles + Invites are modals within)
  2. **Monitoring** — Accounts, Order Tracking
  3. **Automation Hub** — Collection, Jobs (Jobs is future/in development)
- Extension Hub is renamed to Automation Hub
- Order Tracking lives in Monitoring, not Automation Hub
- Build sections to be extensible — more pages will be added/moved in future

### Collapse & Interaction Behavior
- Sections open/close independently (not accordion — all 3 can be open simultaneously)
- Open/closed state persists across sessions (cookie or localStorage, matching existing sidebar state pattern with 7-day cookie)
- Clicking a section expands/collapses it — does not navigate anywhere
- Clicking a sub-item within a section navigates to that page

### Role-Based Sidebar Visibility
- **Admin**: Dashboard + Admin + Monitoring + Automation Hub (full access, full read/write)
- **Client**: Dashboard + Monitoring (read-only — edit/write tools are hidden)
- **VA**: Dashboard + Monitoring + Automation Hub (RBAC-scoped — access profile determines which sections and pages are visible, and what actions are available within each page)
- Empty sections (where user has no permitted pages) are hidden entirely

### Page Consolidation — Users Page
- Access Profiles page becomes a modal accessible from toolbar button on Users page
- Invites page becomes a modal accessible from toolbar button on Users page
- Access Profiles and Invites are removed as standalone sidebar nav items/pages

### Page Consolidation — Accounts Page
- Pairing Request becomes a modal accessible from toolbar button on Accounts page (admin only)
- Agents move into expandable/dropdown rows within each account they are linked to (child relationship)
- Agent management (add/remove/edit) available in expanded rows for admins
- Clients and VAs see agent rows as read-only

### Sidebar Footer Changes
- Theme picker removed from sidebar footer (already lives in Profile Settings dialog)
- Sync status removed from sidebar footer, moved to Profile Settings
- Footer retains: Profile Settings button + Collapse toggle only

### Sync Status in Profile Settings
- Sync status appears as a section within the General tab of Profile Settings (not a new tab)
- Shows sync status, last sync time, and manual sync trigger

### Sub-Page Navigation
- Each sub-item within a section is a single page view (no internal tabs or sub-navigation within pages)

### Claude's Discretion
- Exact section icons in sidebar
- Collapsible animation style/duration
- Cookie key naming for section state persistence
- Visual treatment of expanded vs collapsed sections
- Toolbar button styling for Access Profiles/Invites/Pairing Request modals

</decisions>

<specifics>
## Specific Ideas

- Sections should use existing shadcn/ui SidebarGroup / SidebarGroupLabel / SidebarGroupContent primitives (already in codebase, currently unused)
- Cookie persistence pattern should match existing sidebar:state cookie (7-day max age)
- Lucide icon name strings in PascalCase for navigation config (Phase 24 pattern)
- Navigation configs in `lib/navigation.ts` will need restructuring from flat arrays to grouped structure

</specifics>

<deferred>
## Deferred Ideas

- Jobs page inside Automation Hub — still in development, not part of this phase's implementation
- Skeleton/SVG/empty state consistency enforcement — originally in Phase 27 description but deferred since discussion focused on structural reorganization
- Additional pages that will be added to sections in future phases

</deferred>

---

*Phase: 27-sidebar-folder-reorganization*
*Context gathered: 2026-01-26*
