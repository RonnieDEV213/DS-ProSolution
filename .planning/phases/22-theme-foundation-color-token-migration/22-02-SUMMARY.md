---
phase: 22-theme-foundation-color-token-migration
plan: 02
subsystem: ui
tags: [next-themes, theme-provider, react, nextjs, dark-mode, data-theme]

# Dependency graph
requires:
  - phase: 22-01
    provides: CSS token system with data-theme selector pattern
provides:
  - ThemeProvider wrapper component using next-themes
  - Dynamic data-theme attribute management on HTML element
  - FOUC prevention via blocking inline script
  - suppressHydrationWarning for server-safe theme switching
affects: [23-*, 24-*, 25-*, 26-*]

# Tech tracking
tech-stack:
  added: [next-themes@4.0.11]
  patterns:
    - "ThemeProvider wrapper in components/providers/"
    - "attribute='data-theme' for CSS variable cascade"
    - "suppressHydrationWarning on HTML element"
    - "disableTransitionOnChange for instant theme switching"

key-files:
  created:
    - apps/web/src/components/providers/theme-provider.tsx
  modified:
    - apps/web/src/app/layout.tsx
    - apps/web/package.json

key-decisions:
  - "next-themes with attribute='data-theme' (not class-based) for CSS variable cascade"
  - "defaultTheme='dark' to preserve existing behavior"
  - "enableSystem=false for now (Phase 23 enables)"
  - "disableTransitionOnChange for instant CSS variable cascade"
  - "ThemeProvider as outermost provider wrapper"

patterns-established:
  - "Theme management via data-theme attribute on HTML element"
  - "Provider nesting order: ThemeProvider > TooltipProvider > DatabaseProvider > QueryProvider"

# Metrics
duration: 3min
completed: 2026-01-25
---

# Phase 22 Plan 02: ThemeProvider Integration Summary

**next-themes ThemeProvider with data-theme attribute, FOUC prevention, and zero-re-render theme switching infrastructure**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-01-25T21:52:00Z
- **Completed:** 2026-01-25T21:55:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments
- Installed next-themes and created ThemeProvider wrapper component
- Integrated ThemeProvider into root layout as outermost provider
- Removed hardcoded `className="dark"` from HTML element
- Added `suppressHydrationWarning` for hydration-safe theme switching
- Configured `attribute="data-theme"` matching CSS token system from Plan 01
- Dark theme active by default with no FOUC on page load
- Human-verified: theme switching works via data-theme attribute cascade

## Task Commits

Each task was committed atomically:

1. **Task 1: Install next-themes and create ThemeProvider component** - `7019e0c` (chore)
2. **Task 2: Integrate ThemeProvider into root layout** - `72a0e46` (feat)
3. **Task 3: Verify theme foundation works end-to-end** - Human checkpoint (approved)

## Files Created/Modified
- `apps/web/src/components/providers/theme-provider.tsx` - Client component wrapping NextThemesProvider with props spread
- `apps/web/src/app/layout.tsx` - ThemeProvider integration, suppressHydrationWarning, className="dark" removed
- `apps/web/package.json` - next-themes@4.0.11 added as dependency

## Decisions Made

**1. attribute="data-theme" instead of default class**
- **Rationale:** Matches globals.css `[data-theme="dark"]` selector from Plan 01
- **Impact:** CSS variable cascade works via data attribute, not className

**2. defaultTheme="dark" to preserve existing behavior**
- **Rationale:** App was previously hardcoded to dark; maintains visual consistency
- **Impact:** Phase 23 will add theme switching UI and system preference detection

**3. ThemeProvider as outermost provider**
- **Rationale:** Theme context must be available to all downstream providers and components
- **Impact:** Provider nesting: ThemeProvider > TooltipProvider > DatabaseProvider > QueryProvider

**4. disableTransitionOnChange enabled**
- **Rationale:** Theme switch should be instant via CSS variable cascade, not animated
- **Impact:** No jarring transition flicker when switching themes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 22 complete:**
- CSS token system established (Plan 01)
- ThemeProvider integrated with data-theme attribute (Plan 02)
- Dark theme active, zero FOUC, human-verified
- Ready for Phase 23 (Theme Presets & Switching)

**Blockers/Concerns:**
- None

---
*Phase: 22-theme-foundation-color-token-migration*
*Completed: 2026-01-25*
