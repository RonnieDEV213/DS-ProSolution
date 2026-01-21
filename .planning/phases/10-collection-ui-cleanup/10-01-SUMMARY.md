---
phase: 10-collection-ui-cleanup
plan: 01
subsystem: ui
tags: [react, shadcn, framer-motion, progress-bar, two-phase-collection]

# Dependency graph
requires:
  - phase: 09-storage-export-ui
    provides: Collection UI components and polling hook
provides:
  - shadcn calendar, hover-card, popover components
  - @air/react-drag-to-select library for bulk selection
  - Two-phase progress display (Amazon collecting, eBay searching)
  - Phase-aware progress detail modal
affects: [10-02-history-panel, 10-03-run-config, 10-04-seller-grid]

# Tech tracking
tech-stack:
  added: ["@air/react-drag-to-select", "react-day-picker", "@radix-ui/react-hover-card", "@radix-ui/react-popover"]
  patterns: ["two-phase progress state machine", "phase-conditional rendering"]

key-files:
  created:
    - apps/web/src/components/ui/calendar.tsx
    - apps/web/src/components/ui/hover-card.tsx
    - apps/web/src/components/ui/popover.tsx
  modified:
    - apps/web/src/components/admin/collection/progress-bar.tsx
    - apps/web/src/components/admin/collection/progress-detail-modal.tsx
    - apps/web/src/hooks/use-collection-polling.ts
    - apps/web/package.json

key-decisions:
  - "Phase defaults to 'amazon' for backwards compatibility with existing backend"
  - "Orange color for Amazon phase, blue for eBay phase"
  - "Duration timer shown only in eBay phase"
  - "Products bar removed from modal in Amazon phase (only categories shown)"

patterns-established:
  - "Two-phase progress: phase field determines which metrics to show"
  - "Phase transition animation using Framer Motion AnimatePresence"
  - "Duration timer with setInterval updating every second"

# Metrics
duration: 6min
completed: 2026-01-21
---

# Phase 10 Plan 01: Progress Bar Rework Summary

**Two-phase progress display (Amazon collecting, eBay searching) with shadcn calendar/hover-card/popover components for upcoming UI features**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-21T23:44:37Z
- **Completed:** 2026-01-21T23:51:04Z
- **Tasks:** 3
- **Files modified:** 6 (plus package-lock.json)

## Accomplishments

- Installed shadcn calendar, hover-card, and popover components for Phase 10 UI features
- Added @air/react-drag-to-select library for upcoming bulk seller selection
- Reworked progress bar to show phase-appropriate metrics (no more invalid X/0 ratios)
- Updated progress detail modal with phase indicator and removed worker status clutter
- Added duration timer display using date-fns

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn components and drag selection library** - `8f58b65` (chore)
2. **Task 2: Rework progress bar for two-phase display** - `7ed9eb6` (feat)
3. **Task 3: Update progress detail modal for two-phase display** - `7e2dedc` (part of prior session overlap)

_Note: Task 3 changes were included in a prior session's commit (7e2dedc) due to session overlap._

## Files Created/Modified

- `apps/web/src/components/ui/calendar.tsx` - shadcn calendar component (react-day-picker wrapper)
- `apps/web/src/components/ui/hover-card.tsx` - shadcn hover-card for seller metadata preview
- `apps/web/src/components/ui/popover.tsx` - shadcn popover for positioned overlays
- `apps/web/src/components/admin/collection/progress-bar.tsx` - Two-phase progress with conditional rendering
- `apps/web/src/components/admin/collection/progress-detail-modal.tsx` - Phase indicator, removed workers
- `apps/web/src/hooks/use-collection-polling.ts` - Extended EnhancedProgress interface with phase/products_found

## Decisions Made

- **Phase defaults to "amazon"** - Backwards compatible with existing backend that may not send phase field yet
- **Orange for Amazon, blue for eBay** - Visual distinction between phases using existing color palette
- **Products Found (no denominator) in Amazon phase** - During Amazon collection, total isn't known yet, so show live count only
- **Products X/N only in eBay phase** - Total products is set after Amazon completes
- **Worker status removed from modal** - Per CONTEXT.md directive to simplify and remove clutter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated EnhancedProgress interface in hook**
- **Found during:** Task 2 (progress bar compilation)
- **Issue:** useCollectionPolling hook's EnhancedProgress type didn't include new phase/products_found fields
- **Fix:** Extended interface with phase, products_found, started_at, and checkpoint fields
- **Files modified:** apps/web/src/hooks/use-collection-polling.ts
- **Verification:** npm run build passes
- **Committed in:** 7ed9eb6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking issue)
**Impact on plan:** Essential for type safety. No scope creep.

## Issues Encountered

- Task 3 changes were found to already exist in HEAD from a prior session (7e2dedc). The progress-detail-modal.tsx was modified in the same direction by another execution. Verified final state matches plan requirements.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- shadcn components ready for calendar scheduling (10-03) and hover cards (10-04)
- @air/react-drag-to-select ready for bulk seller selection (10-04)
- Progress components support two-phase display
- Backend may need to expose phase field in progress endpoint for full functionality

---
*Phase: 10-collection-ui-cleanup*
*Completed: 2026-01-21*
