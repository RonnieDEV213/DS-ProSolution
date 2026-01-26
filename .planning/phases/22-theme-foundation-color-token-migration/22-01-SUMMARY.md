---
phase: 22-theme-foundation-color-token-migration
plan: 01
subsystem: ui
tags: [css, tailwind-v4, theme, design-tokens, scrollbar, oklch, next-themes]

# Dependency graph
requires:
  - phase: none
    provides: Pre-existing globals.css with shadcn/ui tokens
provides:
  - Semantic CSS variable token system with @theme inline
  - Data-theme attribute selector pattern for theme switching
  - 9 application-level semantic tokens (app-bg, sidebar, scrollbar, table)
  - Type scale system with 6 sizes and 3 font weights
  - Theme-aware scrollbar utilities (standards-first with webkit fallback)
  - scrollbar-gutter-stable and scrollbar-auto-hide utility classes
affects: [22-02, 22-03, 23-*, 24-*, 25-*, 26-*]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@theme inline for semantic token registration"
    - "@layer base for theme value definitions"
    - "data-theme attribute selector pattern (hydration-safe)"
    - "@custom-variant dark with :where() for zero-specificity"
    - "scrollbar-color/scrollbar-width as primary, webkit as fallback"
    - "@supports selector(::-webkit-scrollbar) guard pattern"

key-files:
  created: []
  modified:
    - apps/web/src/app/globals.css

key-decisions:
  - "Use data-theme attribute instead of .dark class for hydration safety"
  - "Use :where() in @custom-variant for zero-specificity to prevent component style conflicts"
  - "Standards-first scrollbar approach: scrollbar-color/scrollbar-width primary, webkit fallback"
  - "scrollbar-gutter-stable as separate utility (not forced on all scrollbar-thin elements)"
  - "6px default scrollbar width expanding to 10px on hover for easier grabbing"
  - "Type scale using 1.2 ratio (minor third) for harmonious progression"

patterns-established:
  - "@theme inline + CSS variable reference pattern for semantic tokens"
  - "Light/dark value pairs in :root and [data-theme='dark'] within @layer base"
  - "Progressive enhancement: standard properties first, @supports guard for vendor-specific"
  - "Scrollbar auto-hide using scrollbar-color: transparent with transitions"

# Metrics
duration: 133s
completed: 2026-01-25
---

# Phase 22 Plan 01: Theme Foundation & Color Token Migration Summary

**Semantic CSS token system with data-theme selector, 9 application-level tokens, type scale, and standards-first theme-aware scrollbars**

## Performance

- **Duration:** 2 min 13 sec
- **Started:** 2026-01-25T21:49:28Z
- **Completed:** 2026-01-25T21:51:41Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Migrated dark theme from `.dark` class to `[data-theme="dark"]` attribute selector for hydration safety
- Established semantic token system with 9 application-level tokens (app-bg, app-sidebar, app-sidebar-hover, scrollbar-thumb, scrollbar-thumb-hover, scrollbar-track, table-header-bg, table-row-hover, table-border)
- Added type scale system with 6 sizes and 3 font weight conventions
- Replaced hardcoded hex scrollbar colors with CSS variable references
- Implemented standards-first scrollbar styling (scrollbar-color/scrollbar-width primary, webkit as fallback)
- Created scrollbar-gutter-stable and scrollbar-auto-hide utility classes

## Task Commits

Each task was committed atomically:

1. **Tasks 1-2: Migrate token system and scrollbar styles** - `698076a` (feat)

_Note: Both tasks modified the same file and were completed together, resulting in a single atomic commit_

**Plan metadata:** (pending - will be created after SUMMARY and STATE updates)

## Files Created/Modified
- `apps/web/src/app/globals.css` - Complete semantic token system, data-theme selector migration, theme-aware scrollbar utilities

## Decisions Made

**1. Data-theme attribute instead of .dark class**
- **Rationale:** Hydration safety with next-themes (ThemeProvider will manage attribute dynamically in Plan 02)
- **Impact:** Enables server-safe theme switching without hydration mismatches

**2. :where() in @custom-variant dark for zero-specificity**
- **Rationale:** Prevents custom variant from adding specificity that would conflict with component styles
- **Impact:** Component classes can override dark: variants without !important

**3. Standards-first scrollbar approach**
- **Rationale:** scrollbar-color and scrollbar-width are now Baseline 2024, webkit is legacy fallback
- **Impact:** Simpler syntax, future-proof, progressive enhancement for older browsers

**4. scrollbar-gutter-stable as separate utility**
- **Rationale:** Not all scrollable containers need gutter reservation (only those where scrollbar appears/disappears dynamically)
- **Impact:** Developers apply .scrollbar-gutter-stable only where layout shift prevention is needed

**5. 6px→10px hover expansion for scrollbars**
- **Rationale:** Slim default (6px) for visual polish, wider on hover (10px) for easier grabbing
- **Impact:** Better UX - aesthetics when idle, usability when interacting

**6. 1.2 ratio for type scale (minor third)**
- **Rationale:** Harmonious progression that's neither too subtle (1.125) nor too dramatic (1.333)
- **Impact:** 6 sizes from ~11px to ~28px cover all common UI needs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02 (ThemeProvider):**
- CSS foundation complete with semantic tokens and data-theme selector pattern
- globals.css expects data-theme attribute to be set on root element
- Scrollbar utilities ready for use in components

**Expected behavior until Plan 02:**
- App will show light theme only (no .dark class on HTML anymore, data-theme attribute not yet managed)
- This is temporary - Plan 02 adds ThemeProvider which sets data-theme="dark" based on user preference
- Build succeeds, no CSS errors

**Blockers/Concerns:**
- None

---
*Phase: 22-theme-foundation-color-token-migration*
*Completed: 2026-01-25*
