---
phase: 33-collection-keyboard-shortcuts
plan: 01
subsystem: keyboard-shortcuts
tags: [shortcuts, registry, scope, collection, page-contextual]

dependency-graph:
  requires: [26-polish-micro-interactions]
  provides: [collection-shortcut-definitions, page-contextual-shortcuts-reference, hint-storage-key]
  affects: [33-02]

tech-stack:
  added: []
  patterns: [scoped-shortcuts-registry, page-contextual-component-filtering]

key-files:
  created: []
  modified:
    - apps/web/src/lib/shortcuts.ts
    - apps/web/src/lib/storage-keys.ts
    - apps/web/src/components/command-palette/shortcuts-reference.tsx

decisions:
  - id: scope-field-approach
    choice: "Optional scope field on ShortcutDefinition filtered via usePathname"
    why: "Lightweight, no provider needed, auto-hides groups when no matching shortcuts"

metrics:
  duration: "~2 minutes"
  completed: "2026-01-28"
---

# Phase 33 Plan 01: Shortcuts Registry & Page-Contextual Reference Summary

**One-liner:** Extended SHORTCUTS registry with 8 collection-scoped entries and made ShortcutsReference dialog page-contextual via usePathname filtering

## What Was Done

### Task 1: Extend shortcuts registry with collection shortcuts and storage key
- Added "Collection" to `SHORTCUT_GROUPS` array (4th group after Navigation, Actions, Command Palette)
- Added 8 collection-scoped shortcut definitions to `SHORTCUTS` array, each with `scope: "collection"`:
  - `Delete` - Delete selected sellers
  - `f` - Flag selected sellers (toggle)
  - `e` - Export sellers (selection-scoped)
  - `s` - Start run (open config dialog)
  - `Escape` - Clear selection
  - `mod+z` - Undo last bulk delete
  - `mod+a` - Select all visible sellers
  - `mod+c` - Copy selected seller names
- Added `COLLECTION_SHORTCUTS_HINT_DISMISSED` key to `STORAGE_KEYS` for first-visit hint persistence
- All existing global shortcuts left untouched (collection `f` and `e` coexist via scope filtering)

### Task 2: Make ShortcutsReference dialog page-contextual
- Added `usePathname` import from `next/navigation`
- Compute `activeScope` based on pathname: `"collection"` when on `/admin/automation`, `undefined` elsewhere
- Updated shortcut filter to: `(!s.scope || s.scope === activeScope)` -- global shortcuts always show, scoped shortcuts only show when scope matches
- Collection group heading auto-hidden on non-collection pages (existing `length === 0` guard handles this)
- Component already had `"use client"` directive so `usePathname` works without changes

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- TypeScript: `npx tsc --noEmit` passes clean
- Build: `npm run build` passes clean, all 21 routes generated
- 8 collection-scoped entries confirmed in shortcuts.ts
- `usePathname` and `activeScope` filtering confirmed in shortcuts-reference.tsx
- `COLLECTION_SHORTCUTS_HINT_DISMISSED` confirmed in storage-keys.ts

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `fbb3865` | feat(33-01): extend shortcuts registry with collection shortcuts and storage key |
| 2 | `428d10c` | feat(33-01): make ShortcutsReference dialog page-contextual |

## Next Phase Readiness

Plan 33-02 can proceed immediately. The registry infrastructure and page-contextual reference dialog are in place. Plan 02 will create the `useCollectionShortcuts` hook and wire it to existing handlers in `sellers-grid.tsx`.
