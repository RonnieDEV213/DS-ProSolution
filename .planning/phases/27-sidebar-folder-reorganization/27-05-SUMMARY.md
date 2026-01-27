---
phase: 27-sidebar-folder-reorganization
plan: 05
subsystem: ui
tags: [sidebar, collapsible, radix-ui, cookie-persistence, role-based-visibility]

# Dependency graph
requires:
  - phase: 27-01
    provides: SidebarSection type and navigation structure definitions
  - phase: 27-04
    provides: ProfileSettingsDialog with sync status in Profile tab
provides:
  - AppSidebar with collapsible sections using Radix Collapsible
  - Cookie persistence for section state (sidebar:section:{id})
  - Role-based section visibility via getVisibleSections
  - Dashboard as top-level nav item above all sections
  - Cleaned-up sidebar footer (Profile Settings + Collapse only)
affects: [27-06, 27-07, future-phases-adding-sidebar-sections]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Collapsible sections with independent toggle state
    - Cookie persistence pattern for UI state (sidebar:section:{id})
    - Role-based component visibility via props
    - Section-based navigation grouping

key-files:
  created: []
  modified:
    - apps/web/src/components/layout/app-sidebar.tsx
    - apps/web/src/app/admin/layout.tsx
    - apps/web/src/app/va/layout.tsx
    - apps/web/src/app/client/layout.tsx

key-decisions:
  - "Collapsible sections use Radix Collapsible (not accordion) for independent toggle behavior"
  - "Section state persisted via cookies with 7-day max age"
  - "Dashboard rendered as top-level SidebarMenuItem above all sections"
  - "Theme picker removed from footer (moved to Profile Settings in Plan 04)"
  - "Sync status removed from footer (moved to Profile Settings in Plan 04)"
  - "Empty sections hidden automatically by getVisibleSections utility"
  - "VA without access profile shows empty sections array (only Dashboard visible)"

patterns-established:
  - "CollapsibleSection component pattern: wraps SidebarGroup with Radix Collapsible.Root"
  - "useSectionState hook: cookie-based state persistence with SSR safety check"
  - "Section filtering: getVisibleSections(sections, role) removes sections user shouldn't see"
  - "Icon-only mode: section labels hide via group-data-[collapsible=icon] CSS"

# Metrics
duration: 3min
completed: 2026-01-27
---

# Phase 27 Plan 05: Sidebar Collapsible Sections Summary

**Sidebar restructured with collapsible sections, cookie persistence, role-based visibility, and cleaned-up footer**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-27T06:08:46Z
- **Completed:** 2026-01-27T06:11:42Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Refactored AppSidebar from flat nav list to collapsible section-based structure
- Implemented cookie persistence for section open/closed state (7-day expiry)
- Added role-based section filtering with automatic empty section hiding
- Cleaned up footer by removing theme picker and sync status indicator
- Updated all three role layouts (admin, VA, client) to use new section-based props

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor AppSidebar with collapsible sections and footer cleanup** - `5e77cc8` (feat)
2. **Task 2: Update Admin layout to pass sections and role to AppSidebar** - `8a59d84` (feat)
3. **Task 3: Update VA and Client layouts to pass sections and role** - `1cfc4d4` (feat)

## Files Created/Modified
- `apps/web/src/components/layout/app-sidebar.tsx` - Complete rewrite: collapsible sections with Radix Collapsible, cookie persistence hook, role filtering, Dashboard above sections, cleaned footer
- `apps/web/src/app/admin/layout.tsx` - Pass adminSidebarSections, basePath="/admin", role="admin"
- `apps/web/src/app/va/layout.tsx` - Pass vaSidebarSections (or empty array if no access profile), basePath="/va", role="va"
- `apps/web/src/app/client/layout.tsx` - Pass clientSidebarSections (empty array), basePath="/client", role="client"

## Decisions Made

**Collapsible behavior:**
- Used Radix Collapsible (not Accordion) to allow independent section toggle (not mutually exclusive)
- Each section can be open/closed independently
- Section state persists across page loads via cookies

**Cookie persistence:**
- Cookie name pattern: `sidebar:section:{sectionId}` (e.g., `sidebar:section:admin`)
- Max age: 7 days (matches existing sidebar:state cookie)
- useSectionState hook handles SSR safety check and cookie read/write

**Dashboard positioning:**
- Dashboard rendered as top-level SidebarMenuItem above all sections
- Uses dashboardNavItem(basePath) from navigation.ts
- Active state: exact match only (pathname === basePath)

**Section visibility:**
- getVisibleSections utility filters sections by role
- Empty sections (no items) automatically hidden
- VA without access profile: empty sections array → only Dashboard visible

**Footer cleanup:**
- Removed theme picker Popover (theme now in Profile Settings)
- Removed SyncStatusIndicator (sync now in Profile Settings Profile tab)
- Footer now has only: Profile Settings button + Collapse toggle

**Icon-only mode:**
- Section labels hide when sidebar collapsed (existing CSS: group-data-[collapsible=icon]:opacity-0)
- Section items show as icon-only tooltips (existing SidebarMenuButton behavior)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully with TypeScript passing cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 06:**
- Sidebar structure complete with collapsible sections
- All role layouts updated and working
- Footer cleaned up (Profile Settings + Collapse only)
- Cookie persistence working
- Role-based filtering working

**Ready for Plan 07:**
- Section-based navigation structure in place
- Can now enforce skeleton/SVG/empty state consistency across pages

**What's available:**
- Dashboard as top-level nav item (always visible)
- 3 collapsible sections (Admin, Monitoring, Automation Hub) for admin role
- Monitoring section for VA role (if has access profile)
- Only Dashboard for client role
- Theme picker accessible via Profile Settings
- Sync status visible in Profile Settings Profile tab

**No blockers or concerns.**

---
*Phase: 27-sidebar-folder-reorganization*
*Completed: 2026-01-27*
