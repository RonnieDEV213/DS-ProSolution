---
phase: 23-theme-presets-switching
plan: 01
subsystem: ui
tags: [css-variables, themes, oklch, view-transitions-api, next-themes, tailwindcss]

# Dependency graph
requires:
  - phase: 22-theme-foundation-color-token-migration
    provides: CSS variable architecture, ThemeProvider, scrollbar theming
provides:
  - 4 theme CSS variable presets (Midnight, Dawn, Slate, Carbon)
  - Theme metadata module with preview colors for picker UI
  - View transition utility for smooth theme switching
  - Global CSS utility styles (::selection, accent-color, view transitions)
affects: [23-02, 23-03, 23-04, all-future-theme-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-theme CSS with data-theme attribute selectors"
    - "Theme metadata hardcoded for inline preview styles"
    - "View Transitions API wrapper with progressive enhancement"

key-files:
  created:
    - apps/web/src/lib/themes.ts
    - apps/web/src/lib/view-transitions.ts
  modified:
    - apps/web/src/app/globals.css

key-decisions:
  - "Each theme has unique accent color (Midnight=blue, Dawn=indigo, Slate=teal, Carbon=purple)"
  - "Carbon theme uses true #000000 black for OLED battery savings"
  - "Preview colors are hex values (not CSS vars) for inline styles in theme picker"
  - "View Transitions API with progressive enhancement (fallback to instant change)"
  - "::selection uses relative color syntax for 40% opacity primary accent"

patterns-established:
  - "Theme presets: [data-theme='name'] selector with complete token override"
  - "Theme metadata: separate .ts module with preview colors and labels"
  - "Transition wrapper: withViewTransition(callback) with flushSync"

# Metrics
duration: 7min
completed: 2026-01-26
---

# Phase 23 Plan 01: Theme Presets & Utilities Summary

**4 distinct theme CSS presets (Midnight blue, Dawn indigo, Slate teal, Carbon purple) with View Transitions API cross-fade and theme metadata module**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-26T04:39:46Z
- **Completed:** 2026-01-26T04:47:14Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments
- Extended globals.css with 4 complete theme variable sets, each with unique accent colors and full shadcn + app token coverage
- Added global utility styles: accent-color for native form controls, ::selection theming, View Transitions API animation CSS
- Created theme metadata module (lib/themes.ts) with 5 entries (system + 4 named themes), preview colors, and helper functions
- Created view transition utility (lib/view-transitions.ts) with progressive enhancement fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 4 theme CSS presets and global utility styles** - `80f206c` (feat)
2. **Task 2: Create theme metadata and view transition utilities** - `df62ec4` (feat)

## Files Created/Modified

### Created
- `apps/web/src/lib/themes.ts` - Theme configuration metadata with preview colors, labels, descriptions for picker UI
- `apps/web/src/lib/view-transitions.ts` - View Transitions API wrapper with flushSync and progressive enhancement

### Modified
- `apps/web/src/app/globals.css` - Extended with 4 theme presets (midnight, dawn, slate, carbon), updated @custom-variant dark to include new dark themes, added ::selection/accent-color/view-transition CSS

## Decisions Made

**Theme color identities:**
- Midnight (blue undertone dark): Deep ocean mood with blue accents (hue 250)
- Dawn (clean light): Vercel/Linear inspired with indigo accents (hue 264)
- Slate (warm gray-green dark): Positioned between Midnight warmth and Carbon starkness, teal accents (hue 175)
- Carbon (true black OLED): Brutalist #000000 with purple accents (hue 300) for maximum battery savings

**Progressive enhancement:**
- View Transitions API used where supported (Chrome 126+), falls back to instant theme change
- No JS cost for unsupported browsers, smooth 250ms cross-fade for supported

**Preview color strategy:**
- Hardcoded hex values in themes.ts (not CSS variables) so preview cards can show any theme's colors regardless of current active theme
- Enables accurate visual preview before switching

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 23-02:** ThemeProvider configuration with multi-theme support
- Theme metadata module available for import
- CSS variable presets defined and ready to activate via data-theme attribute
- View transition wrapper ready for use in theme change handlers

**Ready for 23-03:** Theme picker UI implementation
- Preview colors available in THEMES array for preview card rendering
- Theme labels, descriptions, accent labels available for UI display
- getThemeConfig helper ready for theme lookups

**No blockers:** All foundation pieces in place for theme switching implementation.

---
*Phase: 23-theme-presets-switching*
*Completed: 2026-01-26*
