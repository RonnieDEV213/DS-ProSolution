---
phase: 24-layout-component-consolidation
plan: 03
subsystem: ui
tags: [react, nextjs, sidebar, layout, navigation, breadcrumbs, shadcn-ui, lucide-icons]

# Dependency graph
requires:
  - phase: 24-02
    provides: Unified AppSidebar component, BreadcrumbNav component, navigation configs
provides:
  - All three dashboard layouts (Admin, VA, Client) refactored to use unified components
  - ~480 lines of duplicated sidebar code eliminated
  - Consistent layout UX across all dashboards with keyboard shortcut support
affects: [future-layout-additions, dashboard-ui-changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dashboard layouts use SidebarProvider + AppSidebar + BreadcrumbNav pattern"
    - "RBAC filtering preserved in VA layout via navItemsToShow computed prop"
    - "All layouts maintain existing providers and wiring (SyncProvider, AdminLayoutClient)"

key-files:
  created: []
  modified:
    - apps/web/src/app/admin/layout.tsx
    - apps/web/src/app/va/layout.tsx
    - apps/web/src/app/client/layout.tsx
  deleted:
    - apps/web/src/components/admin/sidebar.tsx

key-decisions:
  - "Made layouts 'use client' components because SidebarProvider requires client context"
  - "Preserved all existing RBAC logic in VA layout (hasAccessProfile filtering, redirect)"
  - "Preserved SyncProvider, AdminLayoutClient, and ConflictResolutionModal wiring in admin layout"

patterns-established:
  - "Layout pattern: SidebarProvider wrapper → AppSidebar + main with overflow-auto → BreadcrumbNav + content"
  - "Semantic color tokens (bg-background, text-muted-foreground) replace hardcoded gray-* classes"

# Metrics
duration: 3min
completed: 2026-01-26
---

# Phase 24 Plan 03: Dashboard Layout Integration Summary

**All three dashboard layouts refactored to use unified AppSidebar, BreadcrumbNav, and SidebarProvider — eliminating ~480 lines of duplicated sidebar code with Cmd+B/Ctrl+B keyboard shortcut support**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-26T09:16:40Z
- **Completed:** 2026-01-26T09:19:39Z
- **Tasks:** 2
- **Files modified:** 3
- **Files deleted:** 1

## Accomplishments
- Admin layout refactored to use AppSidebar with sync status indicator and theme picker
- VA layout refactored with RBAC filtering preserved (hasAccessProfile conditional, redirect logic)
- Client layout refactored to use unified sidebar components
- Old AdminSidebar component deleted (~240 lines)
- All inline SVG icons eliminated (~240 lines across VA and client layouts)
- All three dashboards now have consistent keyboard shortcut support (Cmd+B/Ctrl+B to toggle sidebar)
- All hardcoded gray-* colors replaced with semantic tokens (bg-background, text-muted-foreground)

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor Admin layout to use AppSidebar** - `7dde0f5` (refactor)
2. **Task 2: Refactor VA and Client layouts to use AppSidebar** - `bf46743` (refactor)

## Files Created/Modified

### Modified
- `apps/web/src/app/admin/layout.tsx` - Refactored to use SidebarProvider + AppSidebar with adminNavItems and showSyncStatus=true, preserved SyncProvider/AdminLayoutClient/ConflictResolutionModal wiring
- `apps/web/src/app/va/layout.tsx` - Refactored to use AppSidebar with RBAC-filtered navItemsToShow, preserved hasAccessProfile filtering and redirect logic
- `apps/web/src/app/client/layout.tsx` - Refactored to use AppSidebar with clientNavItems

### Deleted
- `apps/web/src/components/admin/sidebar.tsx` - Old AdminSidebar component replaced by unified AppSidebar

## Decisions Made

**Layout architecture:**
- Made all three layouts "use client" components because SidebarProvider requires client context (uses React context, hooks, and event listeners for keyboard shortcuts)
- Placed BreadcrumbNav inside main content area rather than in sidebar to maintain consistent positioning across all layouts

**RBAC preservation:**
- VA layout RBAC logic fully preserved: `navItemsToShow` computed from `hasAccessProfile`, redirect logic in useEffect, loading state handling
- Admin layout providers preserved: SyncProvider wrapper, AdminLayoutClient for collection progress, ConflictResolutionModal

**Semantic colors:**
- Replaced all bg-gray-950 with bg-background for theme compatibility
- Replaced text-gray-400 with text-muted-foreground for semantic token usage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all layouts refactored smoothly with TypeScript compilation passing.

## Next Phase Readiness

Layout consolidation complete. All three dashboards now use shared sidebar components with consistent UX.

**Ready for:**
- Phase 24-04 (if additional layout work planned)
- Any future layout additions can now use the unified AppSidebar pattern

**Benefits delivered:**
- ~480 lines of code eliminated (240 from AdminSidebar deletion, 240 from inline SVG removal)
- Consistent sidebar UX across all dashboards
- Keyboard shortcut support (Cmd+B/Ctrl+B) now works in all three layouts
- Theme compatibility via semantic color tokens
- Single source of truth for navigation items in lib/navigation.ts

---
*Phase: 24-layout-component-consolidation*
*Completed: 2026-01-26*
