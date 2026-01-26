---
phase: 25-component-color-migration
plan: 04
subsystem: admin-automation-collection
tags: [semantic-tokens, color-migration, monospace-formatting, theme-aware, status-badges]
requires: [24-layout-consolidation]
provides: [automation-semantic-colors, collection-semantic-colors, status-badge-theme-pattern]
affects: [25-05, 25-06, 25-07]
tech-stack:
  added: []
  patterns: [semantic-token-migration, monospace-data-pill, status-badge-theming, popover-token-pattern]
key-files:
  created: []
  modified:
    - apps/web/src/components/admin/automation/agents-table.tsx
    - apps/web/src/components/admin/automation/jobs-table.tsx
    - apps/web/src/components/admin/automation/pairing-requests-table.tsx
    - apps/web/src/components/admin/automation/reject-dialog.tsx
    - apps/web/src/components/admin/collection/sellers-grid.tsx
    - apps/web/src/components/admin/collection/worker-card.tsx
    - apps/web/src/components/admin/collection/worker-detail-view.tsx
    - apps/web/src/components/admin/collection/worker-status-panel.tsx
key-decisions:
  - id: status-badge-semantic-mapping
    decision: "Status badges use semantic tokens: active=bg-primary/20, offline=bg-muted, running=bg-chart-1/20, failed=bg-destructive/20, pending=bg-chart-4/20"
    rationale: "Consistent status representation across all themes using CSS variable cascade"
  - id: dropdown-popover-tokens
    decision: "Dropdown menus use bg-popover/border-border instead of hardcoded gray-800/gray-700"
    rationale: "Popover semantic token adapts correctly across all 4 theme presets"
  - id: worker-color-preservation
    decision: "Worker color arrays (blue/green/purple/orange/pink/cyan) kept as intentional hardcoded colors"
    rationale: "Per-worker visual distinction is functional, not thematic - each worker needs unique color regardless of theme"
metrics:
  duration: 16m
  completed: 2026-01-26
---

# Phase 25 Plan 04: Admin Automation & Collection Component Migration Summary

Migrated 176 hardcoded gray-* classes to semantic tokens across 8 admin automation and collection worker/seller component files, with monospace data formatting and theme-harmonized status badges.

## What Was Done

### Task 1: Automation Table and Dialog Components (4 files, 112 occurrences)

**agents-table.tsx (45 occurrences):**
- Table container: `bg-gray-900` -> `bg-card`, `border-gray-800` -> `border-border`
- Group headers: `hover:bg-gray-800/50` -> `hover:bg-accent`
- Chevron icons: `text-gray-500` -> `text-muted-foreground`
- Account name parenthetical: `text-gray-400` -> `text-muted-foreground`
- Agent count badge: `bg-gray-700 text-gray-300` -> `bg-muted text-muted-foreground`
- Table headers: `text-gray-400` -> `text-muted-foreground`, added `font-mono` for data columns
- Agent ID: Added monospace pill (`font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10`)
- Account key: Monospace pill with `bg-primary/10`
- Status badges: `bg-green-600` -> `bg-primary/20 text-primary`, `bg-gray-600` -> `bg-muted text-muted-foreground`, etc.
- Dropdown menu: `bg-gray-800 border-gray-700` -> `bg-popover border-border`
- All 3 dialogs (edit, revoke, delete): `bg-gray-900 border-gray-800` -> `bg-card border-border`
- Dialog text/inputs: semantic foreground/muted tokens

**jobs-table.tsx (20 occurrences):**
- Status badges themed: QUEUED/CLAIMED=chart-4, RUNNING=chart-1, COMPLETED=primary, FAILED=destructive
- Select filter: `bg-gray-800 border-gray-700` -> `bg-muted border-border`
- eBay Order ID: Wrapped in monospace pill with `bg-primary/10`
- Attempt count badge: `bg-gray-700 text-gray-300` -> `bg-muted text-muted-foreground font-mono`
- Pagination: All borders and text to semantic tokens

**pairing-requests-table.tsx (40 occurrences):**
- Device IDs: Monospace pills with `bg-primary/10`
- Unknown type badge: `bg-gray-700 text-gray-300` -> `bg-muted text-muted-foreground`
- Detected account info panel: `bg-gray-800 border-gray-700` -> `bg-muted border-border`
- All Select dropdowns (6 instances): `bg-gray-800 border-gray-700` -> `bg-popover border-border`
- All SelectItems: `text-white focus:bg-gray-700` -> `text-popover-foreground focus:bg-accent`
- Expiry timer: Added `font-mono` for countdown display

**reject-dialog.tsx (7 occurrences):**
- Dialog: `bg-gray-900 border-gray-800` -> `bg-card border-border`
- Labels: `text-gray-300` -> `text-foreground`
- Device ID: monospace pill with `bg-muted`
- Textarea: `bg-gray-800 border-gray-700 text-white` -> `bg-muted border-border text-foreground`
- Required asterisk: `text-red-400` -> `text-destructive`

### Task 2: Collection Worker and Seller Components (4 files, 64 occurrences)

**sellers-grid.tsx (26 occurrences):**
- Grid cell: `bg-gray-800 text-gray-200 hover:bg-gray-700` -> `bg-muted text-foreground hover:bg-accent`
- Edit input: `bg-gray-700 text-white` -> `bg-accent text-foreground`
- Index number: `text-gray-500` -> `text-muted-foreground`
- Hover detail panel: `bg-gray-800 border-gray-700` -> `bg-popover border-border`
- Detail values: Added `font-mono` for feedback%, review counts, times seen, dates
- Search textarea: `bg-gray-800 border-gray-700 text-white` -> `bg-muted border-border text-foreground`
- Selection checkbox: `border-gray-600` -> `border-border`
- Selection count: `text-gray-500` -> `text-muted-foreground`
- Export popover: `bg-gray-800 border-gray-700` -> `bg-popover border-border`
- Export inputs (3): `bg-gray-900 border-gray-600 text-white` -> `bg-card border-border text-foreground`
- Export preview count: Added `font-mono`
- Grid container: `bg-gray-900 border-gray-800` -> `bg-card border-border`

**worker-card.tsx (15 occurrences):**
- Idle state: `bg-gray-800/30` -> `bg-muted/30`
- Hover: `hover:bg-gray-800/50` -> `hover:bg-accent/50`
- Worker badge: `bg-gray-700 text-gray-400` / `bg-gray-800` -> `bg-muted text-muted-foreground` / `bg-card`, added `font-mono`
- Status text: `text-gray-500` / `text-white` -> `text-muted-foreground` / `text-foreground`
- Duration: `text-gray-500` -> `text-muted-foreground`, added `font-mono`
- Search query: `text-gray-300` -> `text-muted-foreground`
- Dividers: `text-gray-600` -> `text-border`
- Price values: Added `font-mono`
- Page indicator: Added `font-mono`
- Default state icon: `text-gray-500` -> `text-muted-foreground`

**worker-detail-view.tsx (22 occurrences):**
- Back button: `text-gray-400 hover:text-white` -> `text-muted-foreground hover:text-foreground`
- Worker badge: Added `font-mono`
- Section labels: `text-gray-500` / `text-gray-400` -> `text-muted-foreground`
- Metric values: `text-white` -> `text-foreground`, added `font-mono` throughout
- Results section: `bg-gray-800/50` -> `bg-muted/50`
- Activity label: `text-gray-300` -> `text-foreground`
- Select trigger: `bg-gray-800 border-gray-700` -> `bg-muted border-border`
- Log timestamps: Added `font-mono text-sm`
- Idle activity bg: `bg-gray-800/50` -> `bg-muted/50`
- No activity text: `text-gray-500` -> `text-muted-foreground`
- Duration in log: Added `font-mono`
- Dividers: `text-gray-600` -> `text-border`
- Error badge: Added `font-mono`

**worker-status-panel.tsx (1 occurrence):**
- Header: `text-gray-300` -> `text-foreground`

## Decisions Made

1. **Status badge semantic mapping**: Active/approved use `bg-primary/20 text-primary`, offline/idle use `bg-muted text-muted-foreground`, running uses `bg-chart-1/20 text-chart-1`, failed/error use `bg-destructive/20 text-destructive`, pending/queued use `bg-chart-4/20 text-chart-4`
2. **Dropdown/popover tokens**: All dropdown menus migrated to `bg-popover border-border` with `focus:bg-accent` for items
3. **Worker color arrays preserved**: The 6 worker colors (blue/green/purple/orange/pink/cyan) are intentional per-worker visual distinction, not theme-dependent, so kept as hardcoded values

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `grep -c "gray-"` on all 8 files: all 0
- `grep -c "font-mono" agents-table.tsx`: 8 matches (>= 3 threshold)
- `npx tsc --noEmit`: passes with no errors
- Polling/refresh logic: unchanged
- Animation classes: preserved (animate-spin on Loader2)
- Grid layout/responsive breakpoints: unchanged
- Reject dialog confirmation flow: unchanged
