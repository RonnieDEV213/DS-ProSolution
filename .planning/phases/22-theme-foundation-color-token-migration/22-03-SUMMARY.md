---
phase: 22-theme-foundation-color-token-migration
plan: 03
subsystem: ui
tags: [css, tailwind, design-tokens, scrollbar, gap-closure, uat-fixes]

# Dependency graph
requires:
  - phase: 22-01
    provides: Semantic CSS token system and scrollbar-thin utility
  - phase: 22-02
    provides: ThemeProvider with data-theme attribute management
provides:
  - UAT-verified components using semantic tokens consistently
  - Complete scrollbar migration without old plugin classes
  - Badge outline variant with visible themed border
  - Account selector with theme-aware popover styling
affects: [23-*, 24-*, 25-*, 26-*]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "bg-popover/border-border for popovers instead of hardcoded grays"
    - "scrollbar-thin only (no plugin classes) for theme-aware scrollbars"

key-files:
  created: []
  modified:
    - apps/web/src/components/bookkeeping/account-selector.tsx
    - apps/web/src/components/ui/badge.tsx
    - apps/web/src/components/admin/collection/sellers-grid.tsx
    - apps/web/src/components/admin/collection/history-panel.tsx
    - apps/web/src/components/admin/collection/recent-logs-sidebar.tsx
    - apps/web/src/components/admin/collection/activity-feed.tsx

key-decisions:
  - "Remove text-white from account selector to inherit popover-foreground"
  - "Add border-border to badge outline variant for visible themed border"
  - "Remove all tailwind-scrollbar plugin classes (scrollbar-thumb-*, scrollbar-track-*)"
  - "Use scrollbar-thin utility exclusively for CSS-first scrollbar styling"

patterns-established:
  - "Popover components use bg-popover/border-border tokens, not hardcoded grays"
  - "Scrollable containers use scrollbar-thin class for theme-aware scrollbars"

# Metrics
duration: 2min 9sec
completed: 2026-01-25
---

# Phase 22 Plan 03: Gap Closure Summary

**UAT fixes: semantic tokens for account-selector and badge, CSS-first scrollbar migration for 4 collection panels**

## Performance

- **Duration:** 2 min 9 sec
- **Started:** 2026-01-25T22:04:19Z
- **Completed:** 2026-01-25T22:06:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Fixed text readability regression by replacing hardcoded bg-gray-800/text-white with semantic tokens (bg-popover, border-border)
- Completed scrollbar migration by removing old tailwind-scrollbar plugin classes
- Added scrollbar-thin utility to 3 missing collection panels (history, recent-logs, activity-feed)
- Badge outline variant now has visible themed border via border-border
- Account selector uses theme-aware popover tokens for consistent light/dark mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix account-selector and badge hardcoded colors** - `bbb7315` (fix)
2. **Task 2: Remove old scrollbar plugin classes and add scrollbar-thin** - `9c32fc9` (refactor)

## Files Created/Modified
- `apps/web/src/components/bookkeeping/account-selector.tsx` - Replaced bg-gray-800/border-gray-700 with bg-popover/border-border, removed text-white override
- `apps/web/src/components/ui/badge.tsx` - Added border-border to outline variant for visible themed border
- `apps/web/src/components/admin/collection/sellers-grid.tsx` - Removed scrollbar-thumb-gray-700/scrollbar-track-transparent plugin classes
- `apps/web/src/components/admin/collection/history-panel.tsx` - Added scrollbar-thin to scrollable container
- `apps/web/src/components/admin/collection/recent-logs-sidebar.tsx` - Added scrollbar-thin to scrollable container
- `apps/web/src/components/admin/collection/activity-feed.tsx` - Added scrollbar-thin to scrollable container

## Decisions Made

**1. Remove text-white override from account selector items**
- **Rationale:** Text color should inherit from popover-foreground token for theme awareness
- **Impact:** Text automatically adjusts to theme (dark in light mode, light in dark mode)

**2. Add border-border to badge outline variant**
- **Rationale:** Outline variant had no explicit border color, relying on transparent default
- **Impact:** Badge outline now visible and theme-aware, fixing UAT Test 1 concern

**3. Remove all tailwind-scrollbar plugin classes**
- **Rationale:** Plugin is NOT installed, these classes are undefined/no-op
- **Impact:** Clean migration to CSS-first approach using scrollbar-thin utility from globals.css

**4. Use scrollbar-thin exclusively for all scrollable areas**
- **Rationale:** Consistent pattern across codebase, CSS variables ensure theme awareness
- **Impact:** All scrollbars respond to theme changes via --scrollbar-thumb/track variables

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues. UAT diagnosis from 22-02-PLAN.md provided precise line numbers and fixes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 22 fully complete:**
- All 3 plans executed and verified
- UAT gaps closed (text readability + scrollbar migration)
- No hardcoded colors bypassing design token system
- No old plugin classes remaining
- All scrollbars use CSS-first approach with theme-aware variables

**Ready for Phase 23 (Theme Presets & Switching):**
- Token system verified through UAT and gap closure
- ThemeProvider infrastructure stable
- Components consistently use semantic tokens
- Scrollbar utilities proven theme-aware

**Blockers/Concerns:**
- None

---
*Phase: 22-theme-foundation-color-token-migration*
*Completed: 2026-01-25*
