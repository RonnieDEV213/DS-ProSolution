---
phase: 22-theme-foundation-color-token-migration
plan: 04
subsystem: ui
tags: [next-themes, turbopack, css-variables, dark-mode, gap-closure]

# Dependency graph
requires:
  - phase: 22-02
    provides: ThemeProvider with next-themes
provides:
  - Dark CSS variables activate in both dev (Turbopack) and production builds
  - Dual class+attribute strategy for theme selector compatibility
affects: [23-*, 24-*, 25-*, 26-*]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual attribute={['class', 'data-theme']} for Turbopack compatibility"

key-files:
  created: []
  modified:
    - apps/web/src/app/layout.tsx

key-decisions:
  - "Use array attribute prop instead of switching from data-theme to class — preserves both selectors"

patterns-established:
  - "ThemeProvider dual-selector strategy: class for Turbopack dev, data-theme for production"

# Metrics
duration: 2min
completed: 2026-01-25
---

# Phase 22 Plan 04: Turbopack Dark Theme Fix Summary

**Dual class+attribute ThemeProvider strategy fixes Turbopack CSS variable mismatch in dev mode**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-01-25T22:20:00Z
- **Completed:** 2026-01-25T22:22:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed dark CSS variables not activating in dev mode (Turbopack)
- Changed ThemeProvider attribute from `"data-theme"` to `{["class", "data-theme"]}`
- HTML element now gets both `class="dark"` and `data-theme="dark"`
- Dev mode: `.dark {}` matches via class="dark"
- Production: `[data-theme=dark] {}` matches via data-theme="dark"

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dual class+attribute strategy to ThemeProvider** - `e858276` (fix)

**Plan metadata:** (pending)

## Files Created/Modified
- `apps/web/src/app/layout.tsx` - ThemeProvider attribute changed from string to array

## Decisions Made

**1. Dual attribute array instead of switching to class-only**
- **Rationale:** Preserves data-theme attribute for CSS that directly references `[data-theme="dark"]` selector in production builds, while adding class="dark" for Turbopack's .dark{} rewrite
- **Impact:** Both dev and production selectors work without any changes to globals.css

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 22 fully complete:**
- All 4 plans executed (01: CSS tokens, 02: ThemeProvider, 03: scrollbar/badge fixes, 04: Turbopack fix)
- Dark CSS variables activate in both dev and production
- Components using semantic tokens (bg-popover, text-foreground, border-border) now render correctly in dark mode
- Ready for Phase 23 (Theme Presets & Switching)

**Blockers/Concerns:**
- None

---
*Phase: 22-theme-foundation-color-token-migration*
*Completed: 2026-01-25*
