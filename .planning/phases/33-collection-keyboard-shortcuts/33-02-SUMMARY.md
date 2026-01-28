---
phase: 33-collection-keyboard-shortcuts
plan: 02
subsystem: keyboard-shortcuts
tags: [shortcuts, useHotkeys, collection, flag-toggle, export-scoping, toolbar, hint]

dependency-graph:
  requires:
    - phase: 33-01
      provides: [collection-shortcut-definitions, page-contextual-shortcuts-reference, hint-storage-key]
    - phase: 26-polish-micro-interactions
      provides: [react-hotkeys-hook, use-global-shortcuts, Kbd component, shortcuts-reference dialog]
  provides:
    - useCollectionShortcuts hook with 5 bindings (Delete, F, E, S, Escape)
    - Flag toggle handler with Google Docs Ctrl+B pattern
    - Selection-scoped export modal
    - Enhanced toolbar with action buttons and Kbd badges
    - First-visit shortcuts hint
    - S shortcut custom event bridge to RunConfigModal
  affects: []

tech-stack:
  added: []
  patterns: [page-scoped-shortcuts-hook, custom-event-bridge-for-cross-component-shortcuts, google-docs-toggle-pattern]

key-files:
  created:
    - apps/web/src/hooks/use-collection-shortcuts.ts
  modified:
    - apps/web/src/components/admin/collection/sellers-grid.tsx
    - apps/web/src/app/admin/automation/page.tsx

key-decisions:
  - "stopImmediatePropagation on F and E to prevent global handlers from also firing"
  - "Custom event (dspro:shortcut:startrun) for S shortcut since RunConfigModal lives in page.tsx"
  - "isDialogOpen gates ALL shortcuts to prevent Escape/action conflicts with open dialogs"
  - "Flag and Delete buttons with Kbd badges only appear when selection > 0; Export badge always visible"

patterns-established:
  - "Page-scoped hook pattern: useCollectionShortcuts encapsulates all page shortcuts with enabled/selectedCount/isDialogOpen gating"
  - "Cross-component shortcut bridge: CustomEvent dispatch when shortcut target lives in different component"
  - "Google Docs toggle pattern: any unflagged -> flag all; all flagged -> unflag all"

duration: ~5 minutes
completed: 2026-01-28
---

# Phase 33 Plan 02: Collection Keyboard Shortcuts Implementation Summary

**useCollectionShortcuts hook with Delete/F/E/S/Escape bindings, flag toggle via Google Docs pattern, selection-scoped export, enhanced toolbar with Kbd badges, and first-visit hint**

## Performance

- **Duration:** ~5 minutes
- **Started:** 2026-01-28T05:32:43Z
- **Completed:** 2026-01-28T05:38:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created useCollectionShortcuts hook with 5 keyboard bindings, all gated by enabled/selectedCount/isDialogOpen
- Wired flag toggle handler using Google Docs Ctrl+B pattern (any unflagged -> flag all; all flagged -> unflag all)
- Scoped export modal to selected sellers when selection exists (passes filtered sellers and selectedIds.size as totalCount)
- Enhanced toolbar: Flag [F] and Delete [Del] buttons appear when selection active; Export [E] badge always visible
- Added first-visit hint banner ("Press ? for keyboard shortcuts") with localStorage dismissal
- Connected S shortcut to RunConfigModal via custom event bridge (dspro:shortcut:startrun)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useCollectionShortcuts hook** - `26757e2` (feat)
2. **Task 2: Wire shortcuts into sellers-grid with flag toggle, export scoping, toolbar, and hint** - `4b4c47a` (feat)

## Files Created/Modified
- `apps/web/src/hooks/use-collection-shortcuts.ts` - New hook with 5 useHotkeys bindings (Delete, F, E, S, Escape), all with stopImmediatePropagation and enableOnFormTags: false
- `apps/web/src/components/admin/collection/sellers-grid.tsx` - Wired useCollectionShortcuts, added flag toggle handler, selection-scoped export, enhanced toolbar with Kbd badges, first-visit hint
- `apps/web/src/app/admin/automation/page.tsx` - Added dspro:shortcut:startrun event listener to open RunConfigModal on S key

## Decisions Made
- Used stopImmediatePropagation on F and E handlers to prevent global handlers (focus search, export dispatch) from also firing when collection shortcuts take precedence
- Custom event (dspro:shortcut:startrun) bridges the S shortcut from SellersGrid to page.tsx where RunConfigModal lives, avoiding prop drilling
- All shortcuts gated by isDialogOpen (deleteDialogOpen || exportModalOpen) to prevent Escape conflict with dialog close handlers and accidental actions while dialogs are open
- Flag and Delete toolbar buttons only render when selectedIds.size > 0; Export button always shows its Kbd badge for discoverability

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 33 is now complete. All collection keyboard shortcuts are functional:
- Delete/Backspace opens delete confirmation when sellers selected
- F toggles flags using Google Docs Ctrl+B pattern
- E opens export dialog scoped to selection (or all sellers if none selected)
- S opens run config dialog via custom event
- Escape clears selection when no dialog is open
- Ctrl+A, Ctrl+C, Ctrl+Z remain working (untouched)
- Global F (focus search) still works when no sellers are selected
- Toolbar shows action buttons with keyboard badges
- First-visit hint guides new users to the ? shortcut reference

---
*Phase: 33-collection-keyboard-shortcuts*
*Completed: 2026-01-28*
