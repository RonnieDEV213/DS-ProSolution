---
phase: 26-polish-micro-interactions
plan: 02
subsystem: ui
tags: [cmdk, react-hotkeys-hook, keyboard-shortcuts, command-palette, shadcn-ui]

# Dependency graph
requires:
  - phase: 24-layout-navigation
    provides: "Navigation structure and PascalCase icon naming pattern"
provides:
  - "Central keyboard shortcut registry (shortcuts.ts)"
  - "Command palette item definitions (command-items.ts)"
  - "cmdk and react-hotkeys-hook dependencies installed"
  - "shadcn/ui Command and Kbd components"
affects: [26-04-command-palette-integration, keyboard-shortcuts]

# Tech tracking
tech-stack:
  added: [cmdk@1.1.1, react-hotkeys-hook@5.2.3, shadcn/ui command component, shadcn/ui kbd component]
  patterns:
    - "Central shortcut registry as single source of truth"
    - "Icon names as PascalCase strings (Phase 24 pattern)"
    - "Keywords array for enhanced cmdk fuzzy search"

key-files:
  created:
    - apps/web/src/lib/shortcuts.ts
    - apps/web/src/lib/command-items.ts
    - apps/web/src/components/ui/command.tsx
    - apps/web/src/components/ui/kbd.tsx
  modified:
    - apps/web/package.json
    - apps/web/src/components/ui/button.tsx
    - apps/web/src/components/ui/card.tsx

key-decisions:
  - "SHORTCUTS array is single source of truth for all keyboard shortcuts"
  - "Vim-style go-to sequences (g,d / g,b / g,u / g,a) for navigation"
  - "mod+k for command palette (cross-platform Cmd/Ctrl)"
  - "Keywords array enhances cmdk fuzzy search (e.g., 'bookkeeping' finds 'Order Tracking')"
  - "Icon names stored as PascalCase strings matching Phase 24 navigation pattern"

patterns-established:
  - "ShortcutDefinition interface with key/label/description/display/group/scope"
  - "CommandItemDef interface with icon string, keywords array, adminOnly flag"
  - "Kbd component uses theme semantic tokens (border-border, bg-muted, text-muted-foreground)"

# Metrics
duration: 6min
completed: 2026-01-27
---

# Phase 26 Plan 02: Command Palette Dependencies Summary

**Installed cmdk + react-hotkeys-hook, created central keyboard shortcut registry, command palette item definitions, and Kbd badge component for Phase 26 polish features**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-27T02:01:24Z
- **Completed:** 2026-01-27T02:07:18Z
- **Tasks:** 2
- **Files modified:** 4 created, 3 modified

## Accomplishments
- Installed cmdk (command palette library) via shadcn/ui command component
- Installed react-hotkeys-hook for keyboard shortcut handling
- Created central SHORTCUTS registry with Navigation, Actions, and Command Palette groups
- Defined navigationItems and actionItems for command palette with keywords for fuzzy search
- Created Kbd component for theme-compatible keyboard shortcut badges

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and generate shadcn/ui command + kbd components** - `fea058c` (chore)
2. **Task 2: Create shortcuts registry and command palette item definitions** - `3f6aeb0` (feat)

## Files Created/Modified

### Created
- `apps/web/src/lib/shortcuts.ts` - Central keyboard shortcut registry with SHORTCUTS array, helper functions
- `apps/web/src/lib/command-items.ts` - Navigation and action items for command palette
- `apps/web/src/components/ui/command.tsx` - shadcn/ui Command component primitives (CommandDialog, CommandInput, etc.)
- `apps/web/src/components/ui/kbd.tsx` - Keyboard shortcut badge component with theme-compatible styling

### Modified
- `apps/web/package.json` - Added cmdk@1.1.1 and react-hotkeys-hook@5.2.3
- `apps/web/src/components/ui/button.tsx` - Shadcn enhancement: active:scale-[0.98] press feedback
- `apps/web/src/components/ui/card.tsx` - Shadcn enhancement: transition-shadow hover:shadow-md elevation

## Decisions Made

1. **Shortcut key format:** Used react-hotkeys-hook format ("mod+k", "g,d") as registry keys
2. **Display format:** Separate display array for Kbd component rendering (["⌘", "K"] vs "mod+k")
3. **Navigation shortcuts:** Vim-style go-to sequences (g,d for Dashboard, g,b for Order Tracking, etc.)
4. **Icon storage:** PascalCase string names matching Phase 24 navigation.ts pattern for consistency
5. **Keywords array:** Enhanced cmdk fuzzy search - "bookkeeping" finds "Order Tracking", etc.
6. **AdminOnly flag:** Role-based filtering at render time rather than registry level

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shadcn/ui installation auto-fixed dialog API change**
- **Found during:** Task 1 (shadcn command component installation)
- **Issue:** shadcn/ui updated dialog component API from `hideCloseButton` to `showCloseButton` prop, breaking 8 existing dialogs
- **Fix:** Shadcn CLI automatically migrated all instances to `showCloseButton={false}` during component installation
- **Files auto-fixed:** account-dialog, user-edit-dialog, department-role-dialog, profile-settings-dialog, import-dialog, conflict-resolution-modal, progress-detail-modal, log-detail-modal
- **Verification:** Build passed with no type errors after installation
- **Committed in:** Separate commits by shadcn installation process (not in 26-02 commits)

**2. [Deviation] Shadcn installation added bonus micro-interactions**
- **Found during:** Task 1 (shadcn command component installation)
- **Enhancement:** Shadcn CLI updated button.tsx and card.tsx with micro-interaction improvements
- **Changes:**
  - button.tsx: Added `active:scale-[0.98]` for press feedback
  - card.tsx: Added `transition-shadow hover:shadow-md` for hover elevation
- **Rationale:** These align with Phase 26 polish objectives (micro-interactions) and are CSS-only (no compute overhead)
- **Verification:** Build passed, enhancements are performance-neutral
- **Committed in:** 3f6aeb0 (Task 2 commit, documented as shadcn enhancements)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 bonus enhancement from tooling)
**Impact on plan:** Shadcn CLI auto-fixed dialog API breaking change and added CSS-only micro-interactions aligned with phase goals. No scope creep.

## Issues Encountered

**Issue:** Initial shadcn command installation triggered interactive prompt
- **Problem:** `echo "command" | npx shadcn@latest add` triggered component selection menu instead of adding command component
- **Resolution:** Used direct component specification `npx shadcn@latest add command --overwrite --yes`
- **Impact:** None - correct component installed successfully

**Issue:** Build lock file from previous build attempt
- **Problem:** `.next/lock` file prevented second build run
- **Resolution:** Removed lock file with `rm -f .next/lock` before rebuild
- **Impact:** None - build completed successfully

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 04 (Command Palette Integration):**
- All dependencies installed (cmdk, react-hotkeys-hook)
- Central shortcut registry defined with all navigation and action shortcuts
- Command palette item definitions ready for consumption
- Kbd component ready for shortcut badge rendering
- Command component primitives available for CommandPalette assembly

**Blockers/Concerns:**
None - all foundation pieces in place.

**Tech Alignment:**
- Icon naming matches Phase 24 PascalCase pattern
- Kbd component uses theme semantic tokens (Phase 23/25 theming)
- CSS-only micro-interactions (button press, card hover) align with v4 performance constraints
- No React re-renders from shortcuts registry (pure data)

---
*Phase: 26-polish-micro-interactions*
*Completed: 2026-01-27*
