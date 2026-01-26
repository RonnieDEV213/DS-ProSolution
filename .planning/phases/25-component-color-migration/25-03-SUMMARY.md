---
phase: 25
plan: 03
subsystem: ui-theming
tags: [semantic-tokens, admin, tables, dialogs, monospace, tailwind]
depends_on:
  requires: [25-01, 25-02]
  provides: [admin-core-semantic-tokens]
  affects: [25-04, 25-05, 25-06, 25-07]
tech-stack:
  added: []
  patterns: [semantic-color-tokens, monospace-data-formatting, primary-tab-nav]
key-files:
  created: []
  modified:
    - apps/web/src/components/admin/accounts-table.tsx
    - apps/web/src/components/admin/users-table.tsx
    - apps/web/src/components/admin/department-roles-table.tsx
    - apps/web/src/components/admin/invites-list.tsx
    - apps/web/src/components/admin/account-dialog.tsx
    - apps/web/src/components/admin/user-edit-dialog.tsx
    - apps/web/src/components/admin/department-role-dialog.tsx
    - apps/web/src/components/admin/invite-dialog.tsx
    - apps/web/src/components/admin/create-invite-form.tsx
    - apps/web/src/components/admin/transfer-ownership-dialog.tsx
decisions:
  - Tab navigation uses bg-primary/text-primary-foreground (not hardcoded blue-600)
  - Dialog sidebars use bg-muted/50 instead of bg-gray-950 for subtlety
  - Pagination buttons use default outline variant without gray overrides
  - Cancel buttons use default outline variant without gray overrides
  - Permission badges get font-mono for scanability
metrics:
  duration: ~19 minutes
  completed: 2026-01-26
---

# Phase 25 Plan 03: Admin Core Component Migration Summary

Migrated 10 admin core files from 157 hardcoded gray-* classes to semantic design tokens with monospace data formatting for tabular data.

## What Was Done

### Task 1: Admin Table Components (4 files, 77 occurrences)

Migrated `accounts-table.tsx`, `users-table.tsx`, `department-roles-table.tsx`, and `invites-list.tsx`:

- **Table surfaces:** `bg-gray-900` -> `bg-card`, `border-gray-800` -> `border-border`
- **Table headers:** `text-gray-400` -> `text-muted-foreground`, data columns get `font-mono`
- **Table rows:** `border-gray-800` -> `border-border`
- **Primary text:** `text-white` -> `text-foreground`
- **Secondary text:** `text-gray-300`/`text-gray-400` -> `text-muted-foreground`
- **Placeholder text:** `text-gray-500` -> `text-muted-foreground` or `text-muted-foreground/50`
- **Status badges:** `bg-gray-700 text-gray-400` -> `bg-muted text-muted-foreground`
- **Assignment counts:** `bg-blue-600` -> `bg-primary/20 text-primary` for active
- **Action buttons:** `text-gray-400 hover:text-white` -> `text-muted-foreground hover:text-foreground`
- **Pagination:** Removed gray overrides from outline buttons (inherit from variant)
- **Expanded rows:** `bg-gray-900/50` -> `bg-muted/30`
- **Monospace formatting:** Account codes, emails, dates, permission keys

### Task 2: Admin Dialog/Form Components (6 files, 80 occurrences)

Migrated `account-dialog.tsx`, `user-edit-dialog.tsx`, `department-role-dialog.tsx`, `invite-dialog.tsx`, `create-invite-form.tsx`, and `transfer-ownership-dialog.tsx`:

- **Dialog surfaces:** `bg-gray-900` -> `bg-card`, `border-gray-800` -> `border-border`
- **Dialog text:** `text-white` -> `text-foreground`
- **Sidebar panels:** `bg-gray-950` -> `bg-muted/50`
- **Tab navigation:** `bg-blue-600 text-white` -> `bg-primary text-primary-foreground` (active), `text-gray-300 hover:bg-gray-800` -> `text-muted-foreground hover:bg-accent` (inactive)
- **Form inputs:** `bg-gray-800 border-gray-700` -> `bg-muted border-input`
- **Helper text:** `text-gray-500` -> `text-muted-foreground`
- **Labels:** `text-gray-300` -> `text-muted-foreground`
- **List items:** `bg-gray-800 hover:bg-gray-750` -> `bg-muted hover:bg-accent`
- **Cancel buttons:** Removed `border-gray-700 text-gray-300 hover:bg-gray-800` overrides
- **Section dividers:** `border-gray-800` -> `border-border`

## Decisions Made

| Decision | Rationale |
|---|---|
| Tab nav uses `bg-primary` not hardcoded `bg-blue-600` | Respects theme accent color across all presets |
| Dialog sidebars use `bg-muted/50` not `bg-gray-950` | Subtle differentiation without forcing near-black |
| Removed all gray overrides from outline/cancel buttons | Let the variant system handle themed styling |
| Permission badges get `font-mono` | Improves scanability of technical permission keys |
| Data columns (dates, emails, codes) get `font-mono text-sm` | Monospace aligns numeric/code data for readability |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Zero `gray-*` classes in all 10 admin core files (verified via grep)
- TypeScript compilation passes with zero errors (`npx tsc --noEmit`)
- No functional logic changes - only className string replacements

## Commits

| Hash | Message |
|---|---|
| d0e22de | feat(25-03): migrate admin table components to semantic tokens |
| 3888eef | feat(25-03): migrate admin dialog and form components to semantic tokens |

## Next Phase Readiness

All 10 admin core components are now theme-compatible. Remaining phases (25-04 through 25-07) can proceed with their respective component groups.
