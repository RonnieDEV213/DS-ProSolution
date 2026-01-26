---
phase: 23-theme-presets-switching
plan: 03
subsystem: ui
tags: [next-themes, view-transitions, theme-switching, react, tailwind]

# Dependency graph
requires:
  - phase: 23-01
    provides: "Theme configuration with THEMES array and preview color definitions"
  - phase: 23-02
    provides: "ThemeProvider with next-themes integration and View Transitions support"
provides:
  - "ThemePicker component with visual preview cards for ProfileSettingsDialog"
  - "ThemePickerCompact component with accent dots for sidebar popover"
  - "Theme tab in ProfileSettingsDialog"
  - "Theme popover in AdminSidebar footer"
affects: [23-04-theme-css-variables, 24-custom-scrollbars, 25-semantic-token-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split preview design for System theme (dark/light halves)"
    - "Mini UI mockup preview cards showing theme colors with inline styles"
    - "Compact list variant with accent color dots for popovers"
    - "View Transitions API for smooth theme switching"

key-files:
  created:
    - apps/web/src/components/profile/theme-picker.tsx
  modified:
    - apps/web/src/components/profile/profile-settings-dialog.tsx
    - apps/web/src/components/admin/sidebar.tsx

key-decisions:
  - "System theme preview shows split card (dark left, light right) to visually communicate auto-detection"
  - "Preview cards use inline styles with hardcoded hex values so each card shows its own theme colors regardless of active theme"
  - "Theme tab renders independently of userData loading state to avoid dependency on profile data"
  - "Sidebar footer order: SyncStatusIndicator → Theme → Profile Settings"

patterns-established:
  - "Two-variant component pattern: Full (ThemePicker) for settings dialog, Compact (ThemePickerCompact) for popovers"
  - "Active state highlighting with border + ring + checkmark icon"
  - "withViewTransition wrapper for all theme change calls ensures smooth cross-fade"

# Metrics
duration: 10min
completed: 2026-01-26
---

# Phase 23 Plan 03: Theme Switcher UI Summary

**Theme picker with visual preview cards in ProfileSettingsDialog and compact popover in AdminSidebar, both using View Transitions API for smooth cross-fade**

## Performance

- **Duration:** 10 min
- **Started:** 2026-01-26T07:02:32Z
- **Completed:** 2026-01-26T07:12:08Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created ThemePicker component with 2-column grid showing 5 theme preview cards with mini UI mockups
- Created ThemePickerCompact component with vertical list showing accent color dots for sidebar popover
- System theme shows split preview (dark/light) to visually communicate OS preference detection
- Added Theme tab to ProfileSettingsDialog as 4th tab (Profile, Security, Extension, Theme)
- Added theme popover to AdminSidebar footer with palette icon and compact picker
- Both access points trigger smooth View Transitions API cross-fade on theme switch

## Task Commits

Each task was committed atomically:

1. **Task 1: Create theme picker component with preview cards** - `ab43535` (feat)
2. **Task 2: Add Theme tab and sidebar popover for theme switching** - `0131902` (feat)

## Files Created/Modified
- `apps/web/src/components/profile/theme-picker.tsx` - ThemePicker (full grid with preview cards) and ThemePickerCompact (vertical list with accent dots)
- `apps/web/src/components/profile/profile-settings-dialog.tsx` - Added "theme" tab type, Theme tab button, ThemePicker rendering independent of userData loading
- `apps/web/src/components/admin/sidebar.tsx` - Added Popover with ThemePickerCompact, palette icon, positioned before Profile Settings

## Decisions Made

**1. System theme split preview design**
- Rationale: Users need to understand that "System" means auto-detection, not a fixed theme. Split preview (dark left, light right) visually communicates this behavior.

**2. Preview cards use inline styles with hardcoded hex values**
- Rationale: Each preview card must show its OWN theme's colors regardless of which theme is currently active. Using inline `style={{ backgroundColor: theme.preview.xxx }}` ensures this, while card chrome uses semantic classes.

**3. Theme tab renders independently of userData**
- Rationale: Theme selection doesn't require user profile data. Rendering it outside the `loading ? ... : userData ? ...` conditional prevents unnecessary loading state for theme UI.

**4. Two-variant component pattern**
- Rationale: Settings dialog needs detailed preview cards for exploration, sidebar needs compact quick-switch. Exporting both variants from single file keeps them synchronized.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly with all dependencies (THEMES, withViewTransition, next-themes, Popover) already in place from prior plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 23-04 (Theme CSS Variables):**
- Theme picker UI complete and functional
- View Transitions API integration working
- Two access points (settings + sidebar) implemented
- next-themes managing theme state via localStorage

**Ready for 24 (Custom Scrollbars):**
- Theme switching infrastructure in place
- CSS variable cascade ready to receive scrollbar color tokens

**Ready for 25 (Semantic Token Migration):**
- Sidebar hardcoded gray classes identified and documented
- Theme picker uses bg-card/border-border pattern that will benefit from semantic tokens

**No blockers or concerns.**

---
*Phase: 23-theme-presets-switching*
*Completed: 2026-01-26*
